import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';
import { ViajesCalendarioComponent } from './viajes-calendario.component';
import { ScrollTopButtonComponent } from '../../shared/ui/scroll-top-button/scroll-top-button.component';
import { ViajesApi} from './viajes.api';
import { UserSessionService } from '../../services/user-session.service';

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

  // 🔗 Misma señal que usa el header
  readonly isLoggedInSig = this.session.isLoggedIn;

  constructor() {
    // [PruebaPte] Traza reactiva del login (quita cuando quieras)
    effect(() => {
      console.debug('[PruebaPte][Viajes] isLoggedInSig ->', this.isLoggedInSig());
    });
  }

// Recibe el rango del hijo y guarda en API
onSaveDates(e: { from: string; to: string }) {
  console.debug('[PruebaPte][Viajes] Guardar fechas ->', e);

  // 🔁 Mapear al contrato del backend
  const payload = {
    fecha_inicio: e.from,
    fecha_fin: e.to,
    nota: null,  // o lo que toque
    tipo: null,  // 'flexible' | 'fijo' | null
  };

  this.viajesApi.saveRange(payload).subscribe({
    next: (res) => {
      if (res?.ok) {
        console.debug('[PruebaPte][Viajes] Rango guardado OK', res);
      } else {
        console.warn('[PruebaPte][Viajes] Error al guardar:', res?.error);
      }
    },
    error: (err) => {
      console.error('[PruebaPte][Viajes] Error HTTP al guardar rango', err);
    },
  });
}


}
