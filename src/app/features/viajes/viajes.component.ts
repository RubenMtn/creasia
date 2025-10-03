/* eslint-disable @typescript-eslint/no-explicit-any */
// archivo: src/app/features/viajes/viajes.component.ts

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';
import { ViajesCalendarioComponent } from './viajes-calendario.component';
import { ScrollTopButtonComponent } from '../../shared/ui/scroll-top-button/scroll-top-button.component';
import { ViajesApi, SaveRangePayload } from './viajes.api';
import { UserSessionService } from '../../services/user-session.service';

type SaveState = 'idle' | 'ok' | 'error';

@Component({
  selector: 'app-viajes',
  standalone: true,
  imports: [CommonModule, TPipe, ViajesCalendarioComponent, ScrollTopButtonComponent],
  templateUrl: './viajes.component.html',
  styleUrl: './viajes.component.scss'
})
export class ViajesComponent {
  private viajesApi = inject(ViajesApi);
  private session = inject(UserSessionService);

  // Estado de login compartido (signal)
  readonly isLoggedInSig = this.session.isLoggedIn;

  // Estado de guardado (para mostrar mensaje en el hijo)
  saveState: SaveState = 'idle';
  private saveMsgTimer: any = null;

  // Flag de guardado (para deshabilitar botón y evitar que reaparezca)
  isSaving = false;

  // Rangos propios del socio logado (pintan borde amarillo)
  myRanges: { from: string; to: string }[] = [];

  // “Ticks” que el padre pasa al hijo para forzar acciones concretas
  clearSelectionTick = 0;  // limpiar selección en el hijo
  reloadCountsTick = 0;    // recargar counts (relleno + números)
  lastSavedRange: { from: string; to: string } | null = null; // opcional, por si deseas usarlo

  constructor() {
    // Cargamos rangos propios al entrar
    this.loadMyRanges();
  }

  /**
   * Recibe el rango del hijo y guarda en API.
   * Mapea { from, to } -> contrato backend { fecha_inicio, fecha_fin }.
   * Tras guardar: muestra OK, limpia selección, recarga counts y refresca myRanges.
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

    this.viajesApi.saveRange(payload).subscribe({
      next: (res) => {
        if (res?.ok) {
          this.setSaveState('ok');

          // Marca último guardado (si lo quieres para algo)
          this.lastSavedRange = { from: e.from, to: e.to };

          // 1) Limpia selección en el hijo (evita que vuelva a salir el botón)
          this.clearSelectionTick++;

          // 2) Recarga de counts para reflejar relleno + número de interesados
          this.reloadCountsTick++;

          // 3) Refresca mis rangos (borde amarillo) desde el backend
          this.loadMyRanges();
        } else {
          this.setSaveState('error');
        }
        this.isSaving = false;
      },
      error: () => {
        this.setSaveState('error');
        this.isSaving = false;
      },
    });
  }

  /**
   * Descarga los rangos del socio logado en la ventana del calendario
   * (mes actual hasta +18 meses).
   */
  private loadMyRanges() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to   = new Date(from.getFullYear(), from.getMonth() + 18, 0);

    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    this.viajesApi.getMyRanges(ymd(from), ymd(to)).subscribe({
      next: (res: any) => {
        this.myRanges = (res?.ok && Array.isArray(res.ranges)) ? res.ranges : [];
      },
      error: () => {
        this.myRanges = []; // si no hay sesión o fallo, no pintamos nada propio
      },
    });
  }

  /**
   * Cambia el estado de guardado y lo limpia automáticamente tras 4s.
   */
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
