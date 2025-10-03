/* ============================================================
   Archivo: src/app/features/viajes/viajes.api.ts
   API de Viajes – guardar/borrar rangos, traer mis rangos y counts
   ============================================================ */
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface SaveRangePayload { fecha_inicio: string; fecha_fin: string; nota?: string | null; tipo?: string | null; }
export interface SaveRangeResp { ok?: boolean; error?: string; id?: number; from?: string; to?: string; merged?: number; }
export interface DeleteRangeResp { ok?: boolean; error?: string; deleted?: number; trimmed?: number; split?: number; from?: string; to?: string; }
export interface MyRangesResp { ok?: boolean; error?: string; ranges?: { from: string; to: string }[]; }
export interface CountsResp { ok?: boolean; error?: string; counts?: Record<string, number>; from?: string; to?: string; }

@Injectable({ providedIn: 'root' })
export class ViajesApi {
  private http = inject(HttpClient);
  private readonly API = 'https://creasia.es/api/viajes';

  saveRange(payload: SaveRangePayload) {
    const url = `${this.API}/fechas_save_range.php`;
    return this.http.post<SaveRangeResp>(url, payload, { withCredentials: true });
  }

  deleteRange(payload: { fecha_inicio: string; fecha_fin: string }) {
    const url = `${this.API}/fechas_delete_range.php`;
    return this.http.post<DeleteRangeResp>(url, payload, { withCredentials: true });
  }

  getMyRanges(fromISO: string, toISO: string) {
    const url = `${this.API}/fechas_my_ranges.php?from=${fromISO}&to=${toISO}`;
    return this.http.get<MyRangesResp>(url, { withCredentials: true });
  }

  /** Nuevo: counts por día en ventana [from,to] (ambos inclusive) */
  getCounts(fromISO: string, toISO: string) {
    const url = `${this.API}/fechas_counts.php?from=${fromISO}&to=${toISO}`;
    return this.http.get<CountsResp>(url, { withCredentials: true });
  }
}
