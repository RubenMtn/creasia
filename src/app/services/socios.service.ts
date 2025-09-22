import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface RegisterResponse { ok?: boolean; message?: string; error?: string; }
export interface LoginResponse {
  ok?: boolean;
  error?: string;
  socio?: { id: number; email: string; nombre: string; apellido1: string; apellido2: string | null };
}

@Injectable({ providedIn: 'root' })
export class SociosService {
  private http = inject(HttpClient);
  private API = 'https://creasia.es/api';

  // ⬇️ Ahora acepta nombre/apellidos/opt-in, pero sigue siendo compatible
  register(
    email: string,
    password: string,
    nombre = '',
    apellido1 = '',
    apellido2: string | null = null,
    quiere_mailing = false
  ) {
    const body = { email, password, nombre, apellido1, apellido2, quiere_mailing };
    console.log("email: " + email, "pass: " + password, "pass: " + nombre, "ap1: " + apellido1, "ap2: " + apellido2, "quieremail: " + quiere_mailing);
    return this.http.post<RegisterResponse>(`${this.API}/socios_register.php`, body);
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${this.API}/socios_login.php`, { email, password });
  }
}
