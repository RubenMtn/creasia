/* eslint-disable @typescript-eslint/no-explicit-any */
// archivo: src/app/features/viajes/viajes.component.ts

import { Component, inject, effect, ViewChild, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';
import { ViajesCalendarioComponent } from './viajes-calendario.component';
import { ScrollTopButtonComponent } from '../../shared/ui/scroll-top-button/scroll-top-button.component';
import { ViajesApi, SaveRangePayload } from './viajes.api';
import { UserSessionService } from '../../services/user-session.service';
import { forkJoin } from 'rxjs';

type SaveState = 'idle' | 'ok' | 'deleted' | 'error';

@Component({
  selector: 'app-viajes',
  standalone: true,
  imports: [CommonModule, TPipe, ViajesCalendarioComponent, ScrollTopButtonComponent],
  templateUrl: './viajes.component.html',
  styleUrl: './viajes.component.scss'
})
export class ViajesComponent {

  // Detectar si estamos en navegador (no SSR/prerender)
  private platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private viajesApi = inject(ViajesApi);
  private session = inject(UserSessionService);

  // REFERENCIA AL HIJO (debe ir DENTRO de la clase)
  @ViewChild(ViajesCalendarioComponent) cal?: ViajesCalendarioComponent;

  // Estado de login compartido (signal)
  readonly isLoggedInSig = this.session.isLoggedIn;

  // Estado de guardado (para mensaje en el hijo)
  saveState: SaveState = 'idle';
  private saveMsgTimer: any = null;

  // Flag de guardado (para deshabilitar botón y evitar reaparición)
  isSaving = false;

  // Rangos propios del socio logado (borde amarillo)
  myRanges: { from: string; to: string }[] = [];

  // Ticks para comunicar acciones explícitas al hijo
  clearSelectionTick = 0;
  reloadCountsTick = 0;

  // opcional, info del último guardado/eliminado
  lastSavedRange: { from: string; to: string } | null = null;

constructor() {
  if (this.isBrowser) {
    this.loadMyRanges();

    /* PruebaPte: reactividad a login SOLO en navegador */
    effect(() => {
      const logged = this.isLoggedInSig();
      if (logged) this.loadMyRanges();
      else this.myRanges = [];
    });
  }
}

  /**
   * Recibe el rango del calendario y decide:
   *  - Si YA está totalmente cubierto por mis rangos -> ELIMINAR
   *  - Si NO está cubierto -> AÑADIR/MERGE
   */
  onSaveDates(e: { from: string; to: string }) {
    if (!e?.from || !e?.to) return;

    this.setSaveState('idle');
    this.isSaving = true;

    const payload: SaveRangePayload = {
      fecha_inicio: e.from,
      fecha_fin: e.to,
      nota: null,
      tipo: null,
    };

    const isCovered = this.isFullyCoveredByMine(e.from, e.to);

    const afterOk = (state: SaveState) => {
      this.setSaveState(state);
      this.lastSavedRange = { from: e.from, to: e.to };

      // 1) limpiamos selección del hijo
      this.clearSelectionTick++;

      // 2) definimos la misma ventana que usas en loadMyRanges()
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(from.getFullYear(), from.getMonth() + 18, 0);
      const ymd = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // 3) refrescamos en paralelo y SOLO entonces re-habilitamos la UI
      forkJoin({
        mine: this.viajesApi.getMyRanges(ymd(from), ymd(to)),
        cnts: this.viajesApi.getCounts(ymd(from), ymd(to)),
      }).subscribe({
        next: (r) => {
          // Mis rangos → Input del hijo
          this.myRanges = (r.mine?.ok && Array.isArray(r.mine.ranges)) ? r.mine.ranges : [];
          // Counts → setter público del hijo (evita depender del tick)
          this.cal?.setCountsFromParent(r.cnts?.counts ?? {});
        },
        error: () => {
          // Degradado: si falla la recarga, lo marcamos como error visual
          this.setSaveState('error');
        },
        complete: () => {
          this.isSaving = false;
        }
      });
    };

    const afterError = () => {
      this.setSaveState('error');
      this.isSaving = false;
    };

    if (isCovered) {
      // → BORRADO
      this.viajesApi.deleteRange(payload).subscribe({
        next: (res) => res?.ok ? afterOk('deleted') : afterError(),
        error: afterError,
      });
    } else {
      // → ALTA/MERGE
      this.viajesApi.saveRange(payload).subscribe({
        next: (res) => res?.ok ? afterOk('ok') : afterError(),
        error: afterError,
      });
    }
  }

  /**
   * Devuelve true si [from,to] está COMPLETAMENTE cubierto por la unión de myRanges.
   * (Incluye días con frontera; compara a medianoche local)
   */
  private isFullyCoveredByMine(from: string, to: string): boolean {
    if (!this.myRanges?.length) return false;

    // normaliza a [min,max] en milisegundos (medianoche local)
    const f = +new Date(from + 'T00:00:00');
    const t = +new Date(to + 'T00:00:00');
    const selFrom = Math.min(f, t);
    const selTo = Math.max(f, t);

    // merge de mis rangos (ordenados y unidos)
    const merged = this.mergeRanges(
      this.myRanges.map(r => {
        const a = +new Date(r.from + 'T00:00:00');
        const b = +new Date(r.to + 'T00:00:00');
        return { from: Math.min(a, b), to: Math.max(a, b) };
      })
    );

    // ¿algún intervalo unido cubre completamente [selFrom, selTo]?
    return merged.some(iv => iv.from <= selFrom && iv.to >= selTo);
  }

  /** Une rangos solapados/adyacentes (por día) */
  private mergeRanges(ranges: { from: number; to: number }[]) {
    if (!ranges.length) return ranges;
    const dayMs = 24 * 60 * 60 * 1000;
    const sorted = [...ranges].sort((a, b) => (a.from - b.from) || (a.to - b.to));
    const out: { from: number; to: number }[] = [];
    let cur = { ...sorted[0] };
    for (let i = 1; i < sorted.length; i++) {
      const r = sorted[i];
      // unimos si hay solape o continuidad de 1 día
      if (r.from <= cur.to + dayMs) {
        cur.to = Math.max(cur.to, r.to);
      } else {
        out.push(cur);
        cur = { ...r };
      }
    }
    out.push(cur);
    return out;
  }

  /** Descarga mis rangos en la misma ventana del calendario (mes actual + 18 meses) */
  private loadMyRanges() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 18, 0);
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    this.viajesApi.getMyRanges(ymd(from), ymd(to)).subscribe({
      next: (res: any) => {
        this.myRanges = (res?.ok && Array.isArray(res.ranges)) ? res.ranges : [];
      },
      error: () => {
        this.myRanges = []; // si no hay sesión/fallo, no pintamos
      },
    });
  }

  /** Maneja el estado del mensaje y lo limpia tras 4s */
  private setSaveState(state: SaveState) {
    this.saveState = state;

    if (this.saveMsgTimer) {
      clearTimeout(this.saveMsgTimer);
      this.saveMsgTimer = null;
    }
    if (state !== 'idle') {
      this.saveMsgTimer = setTimeout(() => {
        this.saveState = 'idle';
        this.saveMsgTimer = null;
      }, 4000);
    }
  }
}
