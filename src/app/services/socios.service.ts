/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

import { UserSessionService } from './user-session.service';
// ⤵️ helper de logs con marca "PruebaPte"
import { ppDebug } from '../core/prueba-pte-debug.helper';

export interface RegisterResponse {
  ok?: boolean;
  uid?: number;
  error?: string;
  message?: string;
}
export interface LoginResponse {
  ok?: boolean;
  error?: string;
  socio?: { id: number; email: string; nombre: string; apellido1: string; apellido2: string | null };
}

@Injectable({ providedIn: 'root' })
export class SociosService {
  private http = inject(HttpClient);
  private session = inject(UserSessionService);

  // 🔧 Unificado a ruta relativa para evitar CORS y compartir cookies en el mismo dominio
  private readonly API = '/api';

  /**
   * Registro de socio
   * - Envía exactamente el contrato que espera el backend: { email, password, nombre, apellido1, apellido2, optIn, lang }
   * - withCredentials:true para que viajes con cookies cuando toque
   * - Logs "PruebaPte" en request/response
   */
  register(
    email: string,
    password: string,
    nombre: string,
    apellido1: string,
    apellido2: string | null = null,
    optIn: boolean,
    lang: 'es' | 'en' | 'zh'
  ) {
    const body = {
      email,
      password,
      nombre,
      apellido1,
      apellido2: (apellido2 ?? '').trim(),
      optIn, // ⬅️ el backend espera "optIn"
      lang
    };

    ppDebug('PruebaPte ▶ SociosService.register body', body);

    return this.http.post<RegisterResponse>(`${this.API}/socios_register.php`, body, { withCredentials: true }).pipe(
      tap((res) => ppDebug('PruebaPte ▶ SociosService.register response', res)),
      catchError((err) => {
        ppDebug('PruebaPte ▶ SociosService.register error', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Login
   */
  login(email: string, password: string) {
    const body = { email, password };
    ppDebug('PruebaPte ▶ SociosService.login body', body);

    return this.http.post<LoginResponse>(`${this.API}/socios_login.php`, body, { withCredentials: true }).pipe(
      tap((res) => ppDebug('PruebaPte ▶ SociosService.login response', res)),
      catchError((err) => {
        ppDebug('PruebaPte ▶ SociosService.login error', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Cierre de sesión (limpia estado local)
   */
  logout(): void {
    this.session.clearLogin();
    ppDebug('PruebaPte ▶ SociosService.logout', { cleared: true });
  }

  /**
   * Datos del socio autenticado
   */
  me() {
    return this.http.get<{ ok: boolean; socio?: unknown }>(`${this.API}/socios_me.php`, {
      withCredentials: true
    }).pipe(
      tap((res) => ppDebug('PruebaPte ▶ SociosService.me response', res)),
      catchError((err) => {
        ppDebug('PruebaPte ▶ SociosService.me error', err);
        return throwError(() => err);
      })
    );
  }
}
