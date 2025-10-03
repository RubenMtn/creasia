/* eslint-disable @typescript-eslint/no-explicit-any */
// archivo: src/app/features/viajes/viajes.api.ts
// Servicio de acceso a la API de Viajes (conteo por día + guardar rango)

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/* ============================================================================
   Tipos de datos intercambiados con el backend
   ========================================================================== */

export interface ViajesCountsResponse {
  ok: boolean;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  counts: Record<string, number>;
}

export interface SaveRangePayload {
  // Nombres alineados con el backend final (PHP): fecha_inicio / fecha_fin
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string;    // YYYY-MM-DD
  nota?: string | null;
  tipo?: string | null; // p.ej. 'flexible' | 'fijo'
}

export interface SaveRangeResponse {
  ok: boolean;
  id?: number;    // devuelto por el insert
  error?: string; // mensaje de error (si ok=false)
}

/* ============================================================================
   Servicio
   ========================================================================== */

@Injectable({ providedIn: 'root' })
export class ViajesApi {
  private http = inject(HttpClient);

  // 🔐 Raíz de la API (sin /viajes). Úsala para endpoints generales.
  private API = 'https://creasia.es/api';

  // 📦 Base de endpoints específicos de "viajes"
  private base = `${this.API}/viajes`;

  /* ------------------------------------------------------------------------
   * Utilidades locales
   * ---------------------------------------------------------------------- */

  /** Convierte un Date a 'YYYY-MM-DD' (sin zonas horarias). */
  private toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /* ------------------------------------------------------------------------
   * Endpoints de lectura (conteos por día)
   * ---------------------------------------------------------------------- */

  /** Obtiene conteos por día en la ventana indicada (fechas ISO). */
  getCounts(fromISO?: string, toISO?: string) {
    const params: Record<string, string> = {};
    if (fromISO) params['from'] = fromISO;
    if (toISO) params['to'] = toISO;
    return this.http.get<ViajesCountsResponse>(`${this.base}/fechas_counts.php`, { params });
  }

  /* ------------------------------------------------------------------------
   * Endpoints de escritura (guardar rango)
   * ---------------------------------------------------------------------- */

  /**
   * Guarda un rango de fechas de interés del usuario.
   * Envía: { fecha_inicio: 'YYYY-MM-DD', fecha_fin: 'YYYY-MM-DD', ... }
   * Requiere sesión -> withCredentials: true
   */
  saveRange(payload: SaveRangePayload) {
    // ⚠️ El endpoint PHP final está en /api/fechas_save_range.php (no en /viajes)
    return this.http.post<SaveRangeResponse>(`${this.API}/fechas_save_range.php`, payload, {
      withCredentials: true,
    });
  }

  /**
   * Wrapper de conveniencia para cuando ya tienes Date objects en el componente.
   * - Mantiene compatibilidad con llamadas previas (this.api.saveSelectedRange(...))
   * - Internamente delega en saveRange() con HttpClient.
   */
  async saveSelectedRange(
    range: { from: Date; to: Date },
    opts?: { nota?: string | null; tipo?: 'flexible' | 'fijo' | string | null }
  ): Promise<SaveRangeResponse> {
    // Normaliza orden por si llegaran invertidas
    const from = range.from <= range.to ? range.from : range.to;
    const to   = range.from <= range.to ? range.to   : range.from;

    const payload: SaveRangePayload = {
      fecha_inicio: this.toYMD(from),
      fecha_fin: this.toYMD(to),
      nota: opts?.nota ?? null,
      tipo: opts?.tipo ?? null,
    };

    // Usamos HttpClient (con credenciales) para respetar cookies/sesión
    try {
      const resp = await this.saveRange(payload).toPromise();
      return resp ?? { ok: false, error: 'Respuesta vacía' };
    } catch (e: any) {
      // Intentamos extraer el error del backend si viene como {error: "..."}
      const msg = e?.error?.error || e?.message || 'Error al guardar';
      return { ok: false, error: msg };
    }
  }
}
