// archivo: src/app/features/viajes/viajes.api.ts
// Servicio de acceso a la API de Viajes (conteo por día)

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ViajesCountsResponse {
  ok: boolean;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  counts: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ViajesApi {
  private http = inject(HttpClient);
  // 👇 Absoluto para que funcione desde localhost sin proxy (ajusta si usas staging)
  private base = 'https://creasia.es/api/viajes';

  /** Obtiene conteos por día en la ventana indicada (fechas ISO). */
  getCounts(fromISO?: string, toISO?: string) {
    const params: Record<string,string> = {};
    if (fromISO) params['from'] = fromISO;
    if (toISO) params['to'] = toISO;
    return this.http.get<ViajesCountsResponse>(`${this.base}/fechas_counts.php`, { params });
  }
}
