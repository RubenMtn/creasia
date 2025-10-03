// src/app/features/viajes/viajes.api.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SaveRangePayload {
  fecha_inicio: string;
  fecha_fin: string;
  nota: string | null;
  tipo: string | null;
}
export interface SaveRangeResponse { ok: boolean; error?: string; }
export interface CountsResponse { ok: boolean; counts?: Record<string, number>; }
export interface MyRangesResponse { ok: boolean; ranges?: { from: string; to: string }[]; }

@Injectable({ providedIn: 'root' })
export class ViajesApi {
  private http = inject(HttpClient);

  private readonly API =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'https://creasia.es/api'
      : '/api';

  getCounts(from: string, to: string): Observable<CountsResponse> {
    return this.http.get<CountsResponse>(`${this.API}/viajes/fechas_counts.php`, {
      params: { from, to },
      withCredentials: true,               // ← coherencia
    });
  }

  getMyRanges(from: string, to: string): Observable<MyRangesResponse> {
    return this.http.get<MyRangesResponse>(`${this.API}/viajes/fechas_my_ranges.php`, {
      params: { from, to },
      withCredentials: true,               // ← importante
    });
  }

  saveRange(body: SaveRangePayload): Observable<SaveRangeResponse> {
    return this.http.post<SaveRangeResponse>(`${this.API}/viajes/fechas_save_range.php`, body, {
      withCredentials: true,               // ← IMPRESCINDIBLE
    });
  }

  deleteRange(body: SaveRangePayload): Observable<SaveRangeResponse> {
    return this.http.post<SaveRangeResponse>(`${this.API}/viajes/fechas_delete_range.php`, body, {
      withCredentials: true,               // ← IMPRESCINDIBLE
    });
  }
}
