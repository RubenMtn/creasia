/* eslint-disable @typescript-eslint/no-explicit-any */
// archivo: src/app/features/viajes/viajes.component.ts

import { Component, inject, OnDestroy } from '@angular/core';
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
export class ViajesComponent implements OnDestroy {
  // ——— Inyecciones ———
  private viajesApi = inject(ViajesApi);
  private session = inject(UserSessionService);

  // ——— Estado de login compartido (signal) ———
  readonly isLoggedInSig = this.session.isLoggedIn;

  // ——— Estado UI de guardado (para mostrar el mensaje OK/KO en el hijo) ———
  saveState: SaveState = 'idle';
  private saveMsgTimer: any = null;

  // ——— Flag para deshabilitar el botón mientras se guarda ———
  saving = false;

  /**
   * Maneja el evento del hijo, guarda en la API y actualiza el estado de UI.
   * - Mapea { from, to } -> { fecha_inicio, fecha_fin } que espera el backend.
   * - Controla "saving" para deshabilitar el botón.
   * - Fija saveState a 'ok' | 'error' y lo limpia a los 4s.
   */
  onSaveDates(e: { from: string; to: string }) {
    if (!e?.from || !e?.to) return;

    // Limpia mensajes previos
    this.setSaveState('idle');

    // Prepara payload backend
    const payload: SaveRangePayload = {
      fecha_inicio: e.from,
      fecha_fin: e.to,
      nota: null,
      tipo: null,
    };

    // Marca guardando
    this.saving = true;

    // Llamada a API
    this.viajesApi.saveRange(payload).subscribe({
      next: (res) => {
        this.setSaveState(res?.ok ? 'ok' : 'error');
      },
      error: () => {
        this.setSaveState('error');
      },
      complete: () => {
        // Rehabilita el botón
        this.saving = false;
      },
    });
  }

  /**
   * Cambia el estado de guardado y lo limpia automáticamente tras unos segundos.
   */
  private setSaveState(state: SaveState) {
    this.saveState = state;

    // Cancelar temporizador previo si existiera
    if (this.saveMsgTimer) {
      clearTimeout(this.saveMsgTimer);
      this.saveMsgTimer = null;
    }

    // Ocultar mensaje tras 4s (si no está en 'idle')
    if (state !== 'idle') {
      this.saveMsgTimer = setTimeout(() => {
        this.saveState = 'idle';
        this.saveMsgTimer = null;
      }, 4000);
    }
  }

  /**
   * Limpieza del temporizador para evitar fugas al destruir el componente.
   */
  ngOnDestroy(): void {
    if (this.saveMsgTimer) {
      clearTimeout(this.saveMsgTimer);
      this.saveMsgTimer = null;
    }
  }
}
