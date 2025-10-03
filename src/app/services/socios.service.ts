import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

import { getApiBase } from '../core/api-base';
import { UserSessionService } from './user-session.service';

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
  // Inyecciones
  private http = inject(HttpClient);
  private session = inject(UserSessionService);

  // Base de API dinámica:
  // - En creasia.es -> '/api' (mismo origen, cookies OK)
  // - En localhost -> 'https://creasia.es/api'
  private readonly API = getApiBase();

  /**
   * Registro de socio.
   * Enviamos el contrato que espera el backend: { email, password, nombre, apellido1, apellido2, optIn, lang }.
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
      optIn, // el backend espera esta clave
      lang,
    };

    return this.http
      .post<RegisterResponse>(`${this.API}/socios_register.php`, body, {
        withCredentials: true,
      })
      .pipe(
        // Propagamos el error al componente que consuma el servicio
        catchError((err) => throwError(() => err))
      );
  }

  /**
   * Login clásico (POST) — requiere withCredentials:true para enviar/recibir la cookie de sesión.
   */
  login(email: string, password: string) {
    const body = { email, password };

    return this.http
      .post<LoginResponse>(`${this.API}/socios_login.php`, body, {
        withCredentials: true,
      })
      .pipe(
        catchError((err) => throwError(() => err))
      );
  }

  /**
   * Limpia estado local (la cookie de PHP se borra en el logout del backend).
   */
  logout(): void {
    this.session.clearLogin();
  }

  /**
   * Perfil del socio autenticado.
   */
  me() {
    return this.http
      .get<{ ok: boolean; socio?: unknown }>(`${this.API}/socios_me.php`, {
        withCredentials: true,
      })
      .pipe(
        catchError((err) => throwError(() => err))
      );
  }
}
