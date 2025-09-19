import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface RegisterResponse { ok?: boolean; message?: string; error?: string; }

@Injectable({ providedIn: 'root' })
export class SociosService {
  private http = inject(HttpClient);
  private API = 'https://creasia.es/api'; // ajusta si usas otro dominio

  register(email: string, password: string) {
    // Sólo enviamos email+password; el backend pondrá el resto a '' o 0
    const body = { email, password };
    return this.http.post<RegisterResponse>(`${this.API}/socios_register.php`, body);
  }
}
