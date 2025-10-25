// Servicio: src/app/features/viajes/viajes-preferencias.service.ts
// ---------------------------------------------------------------
// - Preferencias de viaje (sliders 0–10) con nuevo orden y campos.
// - Persistencia en localStorage (clave 'creasia:viajes:prefs:v1').
// - Sin `any`; interface + BehaviorSubject.

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface PreferenciasViaje {
  grupoPersonas: number;        // 0: cuanto menos mejor, 10: cuanto más mejor
  ritmoActividad: number;       // 0: muy tranquilo, 10: muy intenso
  presupuesto: number;          // 0: ajustado, 10: alto
  gastronomia: number;          // 0: poco interés, 10: mucho interés
  naturaleza: number;           // 0: poco interés, 10: mucho interés
  culturaTradicion: number;     // 0: poco interés, 10: mucho interés
  vidaNocturna: number;         // 0: nada, 10: mucho
  compras: number;              // 0: nada, 10: mucho
  negocios: number;             // 0: nada, 10: mucho
  tradicionalVsModerno: number; // 0: China tradicional, 10: China tecnológica y moderna
}

const STORAGE_KEY = 'creasia:viajes:prefs:v1';

const DEFAULT_PREFS: PreferenciasViaje = {
  grupoPersonas: 5,
  ritmoActividad: 5,
  presupuesto: 5,
  gastronomia: 5,
  naturaleza: 5,
  culturaTradicion: 5,
  vidaNocturna: 5,
  compras: 5,
  negocios: 5,
  tradicionalVsModerno: 5,
};

@Injectable({ providedIn: 'root' })
export class ViajesPreferenciasService {
  private readonly subject = new BehaviorSubject<PreferenciasViaje>(this.leer());
  readonly prefs$ = this.subject.asObservable();

  get value(): PreferenciasViaje {
    return this.subject.value;
  }

  update(partial: Partial<PreferenciasViaje>): void {
    const next: PreferenciasViaje = { ...this.value, ...partial };
    this.subject.next(next);
    this.persistir(next);
  }

  setAll(all: PreferenciasViaje): void {
    this.subject.next(all);
    this.persistir(all);
  }

  private leer(): PreferenciasViaje {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      const parsed = JSON.parse(raw) as unknown as Partial<PreferenciasViaje>;
      // Fusión con defaults para cubrir nuevos campos y orden
      return { ...DEFAULT_PREFS, ...parsed };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  private persistir(prefs: PreferenciasViaje): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignoramos errores de almacenamiento (modo privado, etc.)
    }
  }
}
