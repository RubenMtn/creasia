/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

import { getApiBase } from '../core/api-base';
import { UserSessionService } from './user-session.service';
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
  socio?: {
    id: number;
    email: string;
    nombre: string;
    apellido1: string;
    apellido2: string | null;
  };
}

@Injectable({ providedIn: 'root' })
export class SociosService {
  // ——— Inyecciones ———
  private http = inject(HttpClient);
  private session = inject(UserSessionService);

  // ——— Base de API dinámica ———
  // En creasia.es -> '/api' (mismo origen, cookies OK)
  // En localhost -> 'https://creasia.es/api' (evitamos connection refused)
  private readonly API = getApiBase();

  /**
   * Registro de socio
   * Enviamos el contrato que espera el backend: { email, password, nombre, apellido1, apellido2, optIn, lang }
   * Dejamos ?debug=1 temporalmente para ver cualquier error del backend en claro.
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
      optIn, // ← el backend espera esta clave, no "quiere_mailing"
      lang,
    };

    ppDebug('PruebaPte ▶ SociosService.register body', body);

    return this.http
      .post<RegisterResponse>(`${this.API}/socios_register.php?debug=1`, body, {
        withCredentials: true, // importante para cookies (sobre todo en prod)
      })
      .pipe(
        tap((res) => ppDebug('PruebaPte ▶ SociosService.register response', res)),
        catchError((err) => {
          ppDebug('PruebaPte ▶ SociosService.register error', err);
          return throwError(() => err);
        })
      );
  }

  /**
   * Login clásico (POST) — requiere withCredentials:true
   */
  login(email: string, password: string) {
    const body = { email, password };
    ppDebug('PruebaPte ▶ SociosService.login body', body);

    return this.http
      .post<LoginResponse>(`${this.API}/socios_login.php`, body, {
        withCredentials: true,
      })
      .pipe(
        tap((res) => ppDebug('PruebaPte ▶ SociosService.login response', res)),
        catchError((err) => {
          ppDebug('PruebaPte ▶ SociosService.login error', err);
          return throwError(() => err);
        })
      );
  }

  /**
   * Limpia estado local (la cookie de PHP se borra en el logout del backend)
   */
  logout(): void {
    this.session.clearLogin();
    ppDebug('PruebaPte ▶ SociosService.logout', { cleared: true });
  }

  /**
   * Perfil del socio autenticado
   */
  me() {
    return this.http
      .get<{ ok: boolean; socio?: unknown }>(`${this.API}/socios_me.php`, {
        withCredentials: true,
      })
      .pipe(
        tap((res) => ppDebug('PruebaPte ▶ SociosService.me response', res)),
        catchError((err) => {
          ppDebug('PruebaPte ▶ SociosService.me error', err);
          return throwError(() => err);
        })
      );
  }
}
