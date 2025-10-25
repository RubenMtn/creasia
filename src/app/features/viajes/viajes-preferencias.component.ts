/**
 * Componente: src/app/features/viajes/viajes-preferencias.component.ts
 * -------------------------------------------------------------------
 * - 10 sliders 0–10 con NUEVO ORDEN y NUEVOS CAMPOS.
 * - Reactive Forms tipados (FormControl<number>), sin `any`.
 * - Persistencia inmediata en ViajesPreferenciasService (localStorage).
 * - Emite (ready) al padre con PreferenciasViaje.
 */

import {
  Component,
  EventEmitter,
  Output,
  OnInit,
  OnDestroy,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  NonNullableFormBuilder,
  FormGroup,
  FormControl
} from '@angular/forms';
import {
  ViajesPreferenciasService,
  PreferenciasViaje
} from './viajes-preferencias.service';
import { Subscription } from 'rxjs';

/** Controles tipados en el ORDEN solicitado */
interface PrefsFormControls {
  grupoPersonas: FormControl<number>;
  ritmoActividad: FormControl<number>;
  presupuesto: FormControl<number>;
  gastronomia: FormControl<number>;
  naturaleza: FormControl<number>;
  culturaTradicion: FormControl<number>;
  vidaNocturna: FormControl<number>;
  compras: FormControl<number>;
  negocios: FormControl<number>;
  tradicionalVsModerno: FormControl<number>;
}

@Component({
  selector: 'app-viajes-preferencias',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './viajes-preferencias.component.html',
  styleUrl: './viajes-preferencias.component.scss'
})
export class ViajesPreferenciasComponent implements OnInit, OnDestroy {
  @Output() readonly ready = new EventEmitter<PreferenciasViaje>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly prefs = inject(ViajesPreferenciasService);

  readonly form: FormGroup<PrefsFormControls>;
  private sub?: Subscription;

  readonly resumen = signal<string>('');

  constructor() {
    const v = this.prefs.value;

    this.form = this.fb.group<PrefsFormControls>({
      grupoPersonas: this.fb.control(v.grupoPersonas),
      ritmoActividad: this.fb.control(v.ritmoActividad),
      presupuesto: this.fb.control(v.presupuesto),
      gastronomia: this.fb.control(v.gastronomia),
      naturaleza: this.fb.control(v.naturaleza),
      culturaTradicion: this.fb.control(v.culturaTradicion),
      vidaNocturna: this.fb.control(v.vidaNocturna),
      compras: this.fb.control(v.compras),
      negocios: this.fb.control(v.negocios),
      tradicionalVsModerno: this.fb.control(v.tradicionalVsModerno),
    });
  }

  ngOnInit(): void {
    this.sub = this.form.valueChanges.subscribe(() => {
      const val = this.form.getRawValue(); // números no anulables en el orden correcto
      this.prefs.update(val as PreferenciasViaje);
      this.actualizarResumen(val as PreferenciasViaje);
      this.ready.emit(val as PreferenciasViaje);
    });

    this.actualizarResumen(this.form.getRawValue() as PreferenciasViaje);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Resumen compacto en el ORDEN solicitado */
  private actualizarResumen(v: PreferenciasViaje): void {
    this.resumen.set(
      `Grupo ${v.grupoPersonas}/10 · Ritmo ${v.ritmoActividad}/10 · Presu ${v.presupuesto}/10 · ` +
      `Gastro ${v.gastronomia}/10 · Natur ${v.naturaleza}/10 · Cultura ${v.culturaTradicion}/10 · ` +
      `Noche ${v.vidaNocturna}/10 · Compras ${v.compras}/10 · ` +
      `Negocios ${v.negocios}/10 · Trad↔Mod ${v.tradicionalVsModerno}/10`
    );
  }
}
