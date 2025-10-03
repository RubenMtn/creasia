/* eslint-disable @typescript-eslint/no-unused-vars */
// archivo: src/app/features/viajes/viajes.api.ts
// Servicio de acceso a la API de Viajes (conteo por día + rangos del usuario + guardar rango)

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getApiBase } from '../../core/api-base';

export interface ViajesCountsResponse {
  ok: boolean;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  counts: Record<string, number>;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}


export interface SaveRangePayload {
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string;    // YYYY-MM-DD
  nota?: string | null;
  tipo?: string | null; // 'flexible' | 'fijo' | ...
}

export interface SaveRangeResponse {
  ok: boolean;
  id?: number;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ViajesApi {
  private http = inject(HttpClient);

  // En prod: '/api', en dev: 'https://creasia.es/api'
  private readonly API_BASE = getApiBase();
  // Prefijo del módulo "viajes"
  private readonly BASE = `${this.API_BASE}/viajes`;

  /** Obtiene conteos por día en la ventana indicada (fechas ISO). */
  getCounts(fromISO?: string, toISO?: string) {
    const params: Record<string, string> = {};
    if (fromISO) params['from'] = fromISO;
    if (toISO) params['to'] = toISO;

    // ✅ Ojo: SIN duplicar "/viajes"
    return this.http.get<ViajesCountsResponse>(`${this.BASE}/fechas_counts.php`, {
      params,
      withCredentials: true,
    });
  }

  /** Obtiene los rangos guardados por el usuario logado dentro de una ventana. */
  getMyRanges(fromISO: string, toISO: string) {
    const params = { from: fromISO, to: toISO };

    // ✅ Ojo: SIN duplicar "/viajes"
    return this.http.get<{ ok: boolean; ranges: DateRange[] }>(
      `${this.BASE}/fechas_my_ranges.php`,
      { params, withCredentials: true }
    );
  }

  /**
   * Guarda un rango de fechas del usuario (requiere sesión).
   * Envía: { fecha_inicio, fecha_fin, nota?, tipo? }
   */
  saveRange(payload: SaveRangePayload) {
    return this.http.post<SaveRangeResponse>(
      `${this.BASE}/fechas_save_range.php`,
      payload,
      { withCredentials: true }
    );
  }
}
