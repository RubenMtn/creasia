/* eslint-disable @typescript-eslint/no-empty-function */
// src/app/services/auth.service.ts
// Servicio de autenticación con soporte de refresh y fetch autorizado.
// Comentarios en español y sin cabeceras personalizadas para no chocar con CORS.

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken: string | null = null;
  private refreshing = false;
  private waiters: ((ok: boolean) => void)[] = [];

  /** Devuelve el token de acceso actual (si lo hay). */
  getAccess(): string | null { return this.accessToken; }

  /** Establece el token de acceso (puede ser null para limpiar). */
  setAccess(t: string | null) { this.accessToken = t; }

  /**
   * Hace refresh de la sesión (usa cookie HttpOnly en el backend).
   * Si ya hay un refresh en curso, espera a que termine.
   */
  async refresh(): Promise<boolean> {
    if (this.refreshing) {
      return new Promise(res => this.waiters.push(res));
    }

    this.refreshing = true;
    try {
      // Importante: credenciales incluidas para que viaje la cookie de sesión.
      const r = await fetch('/api/auth/refresh.php', {
        method: 'POST',
        credentials: 'include'
      });

      if (!r.ok) throw new Error('refresh_failed');

      const j = await r.json();
      if (j?.ok && (j.access_token || j.access)) {
        this.setAccess(j.access_token ?? j.access ?? null);
        return true;
      }

      // Si el backend decide no devolver token por el momento.
      throw new Error('no_token');
    } catch {
      // Si no hay sesión válida, limpiamos token en memoria.
      this.setAccess(null);
      return false;
    } finally {
      this.refreshing = false;
      // Notificar a los que estaban esperando el refresh.
      const ok = this.accessToken != null;
      this.waiters.splice(0).forEach(fn => fn(ok));
    }
  }

  /**
   * Cierra sesión en servidor y limpia el token en memoria.
   */
  async logout(): Promise<void> {
    this.setAccess(null);
    try {
      await fetch('/api/auth/logout.php', {
        method: 'POST',
        credentials: 'include'
      });
    } catch {
      // Silencioso: aunque falle el endpoint, limpiamos el estado local igualmente.
    }
  }

  /**
   * Hace un fetch autorizado:
   * - Añade Authorization: Bearer <token> si existe y el caller no lo puso.
   * - Envía por defecto credentials: 'include' (cookies) salvo que el caller lo sobrescriba.
   * - Si recibe 401, intenta refresh() y reintenta una vez con el nuevo token.
   */
  async authorizedFetch(u: string, i: RequestInit = {}): Promise<Response> {
    // 1) Preparar headers respetando los existentes
    const h = new Headers(i.headers || {});
    const t = this.getAccess();
    if (t && !h.has('Authorization')) {
      h.set('Authorization', `Bearer ${t}`);
    }

    // 2) Hacer la petición con credenciales por defecto (salvo que el caller lo indique)
    let r = await fetch(u, {
      ...i,
      headers: h,
      credentials: i.credentials ?? 'include'
    });

    // 3) Si falta autorización y el refresh tiene éxito, reintentamos una vez
    if (r.status === 401 && await this.refresh()) {
      const h2 = new Headers(i.headers || {});
      const t2 = this.getAccess();
      if (t2) h2.set('Authorization', `Bearer ${t2}`);

      r = await fetch(u, {
        ...i,
        headers: h2,
        credentials: i.credentials ?? 'include'
      });
    }

    return r;
  }
}
