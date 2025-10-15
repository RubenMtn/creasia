// archivo: src/app/features/viajes/viajes-calendario.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  PLATFORM_ID,
  HostListener,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ViajesApi } from './viajes.api';

/** Estructuras auxiliares para render mensual */
interface DiaCell {
  date: Date;
  iso: string;       // YYYY-MM-DD
  inMonth: boolean;  // pertenece al mes visible
  count: number;     // interesados
  isPast: boolean;
  isToday: boolean;
}
interface MesView {
  year: number;
  monthIndex: number;     // 0..11
  monthName: string;      // 'enero', ...
  weeks: DiaCell[][];     // filas de 7 días
}

@Component({
  selector: 'app-viajes-calendario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './viajes-calendario.component.html',
  styleUrls: ['./viajes-calendario.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViajesCalendarioComponent implements OnChanges {

  private platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private api = inject(ViajesApi);

  // ── Estado ───────────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly counts = signal<Record<string, number>>({}); // YYYY-MM-DD -> interesados

  // Ventana de 18 meses: resto del mes actual + 17 meses
  private readonly today = new Date();
  private readonly start = new Date(this.today);
  private readonly end = (() => {
    const lastOfThisMonth = new Date(this.today.getFullYear(), this.today.getMonth() + 1, 0);
    const end = new Date(lastOfThisMonth);
    end.setMonth(end.getMonth() + 17);
    return new Date(end.getFullYear(), end.getMonth() + 1, 0);
  })();

  // Meses generados a partir de counts
  readonly months = computed<MesView[]>(() => this.buildMonthsView(this.counts()));

  // Helpers de fecha en zona Europe/Madrid (ISO yyyy-mm-dd sin UTC shift)
  private toISO(d: Date): string {
    return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }); // "YYYY-MM-DD"
  }
  private todayISO(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  }


  // ── Inputs del padre ─────────────────────────────────────────────────────────
  @Input() isLoggedIn = false;
  @Input() saveState: 'ok' | 'error' | 'idle' | 'deleted' = 'idle';

  @Input() myRanges: { from: string; to: string }[] = []; // rangos propios (borde amarillo)
  @Input() saving = false;

  /** Ticks que puede emitir el padre para acciones explícitas */
  @Input() clearSelectionTick = 0; // fuerza limpiar selección (para que no reaparezca el botón)
  @Input() reloadCountsTick = 0;   // fuerza recargar counts desde el backend

  @Input() lastSavedRange: { from: string; to: string } | null = null;


  // ── Salidas ──────────────────────────────────────────────────────────────────
  @Output() saveDates = new EventEmitter<{ from: string; to: string }>();


  // Hay selección en curso (aunque sea solo el día inicial)
  private hasAnySelection = false; // ← NUEVO

  // Selección actual
  private selectionStart = signal<Date | null>(null);
  private selectionEnd = signal<Date | null>(null);

  // Aviso “debe iniciar sesión” por mes
  loginNoticeMonthId = signal<string | null>(null);

  // Rango seleccionado listo para usar
  selectedRange = computed(() => {
    const a = this.selectionStart();
    const b = this.selectionEnd();
    if (!a || !b) return null;
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  });

  /** Regla UX: mínimo 2 días salvo que el único día toque un rango propio (fusión) */
  readonly minTwoDaysViolation = computed<boolean>(() => {
    const r = this.selectedRange();
    if (!r) return false;

    const a = this.dayKey(r.from);
    const b = this.dayKey(r.to);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);

    // Días inclusivos
    const lenDays = Math.round((hi - lo) / 86_400_000) + 1;
    if (lenDays >= 2) return false;

    // Selección de 1 día: ¿toca alguno de mis rangos a izquierda o derecha?
    const prev = lo - 86_400_000;
    const next = lo + 86_400_000;
    const touchesMine = this.myRangesNorm.some(iv =>
      (iv.from <= prev && prev <= iv.to) || (iv.from <= next && next <= iv.to)
    );

    return !touchesMine;
  });


  // Rango propio normalizado a números (para pintar borde amarillo)
  private myRangesNorm: { from: number; to: number }[] = [];

  // Últimos ticks aplicados
  private lastClearTick = 0;
  private lastReloadTick = 0;

  constructor() {
    // Carga inicial de counts
    this.reloadCounts();

    // (opcional) efecto de depuración
    effect(() => {
      // console.log('months:', this.months().length);
    });
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    // 1) Normaliza rangos propios cuando cambia el input
    if (changes['myRanges']) {
      this.myRangesNorm = (this.myRanges ?? []).map((r) => {
        const f = new Date(r.from + 'T00:00:00').getTime();
        const t = new Date(r.to + 'T00:00:00').getTime();
        return { from: Math.min(f, t), to: Math.max(f, t) };
      });
    }

    // 2) Tick para limpiar selección (evita que el botón reaparezca)
    if (changes['clearSelectionTick'] && this.clearSelectionTick !== this.lastClearTick) {
      this.lastClearTick = this.clearSelectionTick;
      this.clearSelection();
    }

    // 3) Tick para recargar counts (pinta relleno y nº interesados)
    if (changes['reloadCountsTick'] && this.reloadCountsTick !== this.lastReloadTick) {
      this.lastReloadTick = this.reloadCountsTick;
      this.reloadCounts();
    }
  }

  /** Limpia la selección si se hace clic fuera de la tabla/calendario (no en botones) */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    if (!this.isLoggedIn) return;
    const el = ev.target as HTMLElement | null;
    // No limpiar si haces clic dentro del grid o en las acciones (botón Guardar/Eliminar)
    if (el && (el.closest('.cal-table') || el.closest('.cal-actions'))) return;

    if (this.hasAnySelection) this.clearSelection();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.isLoggedIn && this.hasAnySelection) this.clearSelection();
  }



  // ── API pública para el padre (optimismo / consolidación) ────────────────────
  /** Limpia la selección actual (para que no vuelva a salir el botón) */
  public clearSelection(): void {
    this.selectionStart.set(null);
    this.selectionEnd.set(null);
    this.hasAnySelection = false;
  }

  /** Sustituye los conteos desde el padre (tras relectura del servidor) */
  public setCountsFromParent(newCounts: Record<string, number>): void {
    this.counts.set(newCounts ?? {});
  }

  /** Parche optimista: +1 a cada día del rango guardado */
  public applyOptimisticSave(fromISO: string, toISO: string): void {
    const start = this.parseISO(fromISO);
    const end = this.parseISO(toISO);
    if (!start || !end) return;

    const a = +new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const b = +new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const from = Math.min(a, b);
    const to = Math.max(a, b);

    const map = { ...this.counts() };
    for (let t = from; t <= to; t += 24 * 60 * 60 * 1000) {
      const d = new Date(t);
      const iso = this.toISO(d);
      map[iso] = (map[iso] ?? 0) + 1;
    }
    this.counts.set(map);
  }

  // ── Render mensual ───────────────────────────────────────────────────────────
  /** Construye la matriz de meses */
  private buildMonthsView(counts: Record<string, number>): MesView[] {
    const todayISO = this.toISO(new Date()); // Europe/Madrid, formato ISO estable
    const out: MesView[] = [];
    const firstMonth = new Date(this.start.getFullYear(), this.start.getMonth(), 1);
    const totalMonths = 18;

    for (let m = 0; m < totalMonths; m++) {
      const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + m, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const monthName = this.monthNameEs(month);

      const firstGrid = this.startOfWeek(monthDate);
      const lastOfMonth = new Date(year, month + 1, 0);
      const lastGrid = this.endOfWeek(lastOfMonth);

      const weeks: DiaCell[][] = [];
      let cursor = new Date(firstGrid);

      while (cursor <= lastGrid) {
        const week: DiaCell[] = [];
        for (let i = 0; i < 7; i++) {
          const iso = this.toISO(cursor);
          week.push({
            isPast: iso < todayISO,
            isToday: iso === todayISO,
            date: new Date(cursor),
            iso,
            inMonth: cursor.getMonth() === month,
            count: counts[iso] ?? 0,
          });
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }
        weeks.push(week);
      }

      out.push({ year, monthIndex: month, monthName, weeks });
    }
    return out;
  }

  // ── Utilidades de fechas y formato ───────────────────────────────────────────
  private startOfWeek(d: Date): Date {
    const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (tmp.getDay() + 6) % 7; // lunes=0
    tmp.setDate(tmp.getDate() - day);
    return tmp;
  }
  private endOfWeek(d: Date): Date {
    const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (tmp.getDay() + 6) % 7;
    tmp.setDate(tmp.getDate() + (6 - day));
    return tmp;
  }

  private toISODate(d: Date): string {
    return this.toISO(d);
  }

  private parseISO(yyyyMmDd: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
    if (!m) return null;
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    return new Date(y, mo, d);
  }
  monthId(year: number, monthIndexZeroBased: number): string {
    return `${year}-${(monthIndexZeroBased + 1).toString().padStart(2, '0')}`;
  }
  private dayKey(d: Date): number {
    return +new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  private monthNameEs(m: number): string {
    return [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ][m];
  }

  // ── Selección visual ─────────────────────────────────────────────────────────
  isSelected(date: Date): boolean {
    const s = this.selectionStart();
    const e = this.selectionEnd();
    if (!s && !e) return false;
    if (s && !e) return this.dayKey(date) === this.dayKey(s);
    if (!s && e) return this.dayKey(date) === this.dayKey(e);
    const r = this.selectedRange()!;
    const k = this.dayKey(date);
    return k >= this.dayKey(r.from) && k <= this.dayKey(r.to);
  }
  isRangeMiddle(date: Date): boolean {
    const r = this.selectedRange();
    if (!r) return false;
    const k = this.dayKey(date);
    return k > this.dayKey(r.from) && k < this.dayKey(r.to);
  }

  // ── Interacción ──────────────────────────────────────────────────────────────
  onDayClick(day: Date, monthId: string, inCurrentMonth = true): void {
    if (!inCurrentMonth) return;

    if (!this.isLoggedIn) {
      this.loginNoticeMonthId.set(monthId);
      return;
    }
    if (this.loginNoticeMonthId()) this.loginNoticeMonthId.set(null);

    const s = this.selectionStart();
    const e = this.selectionEnd();

    // Tras establecer el inicio o actualizar el rango:
    this.hasAnySelection = true; // ← NUEVO

    if (!s) {
      this.selectionStart.set(day);
      this.selectionEnd.set(null);
    } else if (!e) {
      if (this.dayKey(day) < this.dayKey(s)) {
        this.selectionEnd.set(s);
        this.selectionStart.set(day);
      } else {
        this.selectionEnd.set(day);
      }
    } else {
      this.selectionStart.set(day);
      this.selectionEnd.set(null);
    }
  }

  emitSave(): void {
    const r = this.selectedRange();
    if (!r) return;
    const from = this.toISODate(r.from);
    const to = this.toISODate(r.to);
    this.saveDates.emit({ from, to });
  }

  // ── Días propios del usuario (borde amarillo) ───────────────────────────────
  isOwnDay(d: Date): boolean {
    if (!this.myRangesNorm.length) return false;
    const k = this.dayKey(d);
    return this.myRangesNorm.some((r) => k >= r.from && k <= r.to);
  }
  /** ¿La selección actual está totalmente cubierta por mis rangos? */
  selectionFullyMine(): boolean {
    const r = this.selectedRange(); if (!r || !this.myRangesNorm.length) return false;
    const a = this.dayKey(r.from), b = this.dayKey(r.to), lo = Math.min(a, b), hi = Math.max(a, b);
    return this.myRangesNorm.some(iv => iv.from <= lo && iv.to >= hi);
  }

  // ⇩⇩ dentro de export class ViajesCalendarioComponent { ... }
  isEdgeOfRangeMonth(year: number, monthIndex: number): boolean {
    const r = this.selectedRange?.();
    if (!r) return false;

    const firstMonthId = this.monthId(r.from.getFullYear(), r.from.getMonth());
    const lastMonthId = this.monthId(r.to.getFullYear(), r.to.getMonth());
    const current = this.monthId(year, monthIndex);

    if (firstMonthId === lastMonthId) return current === firstMonthId;
    return current === firstMonthId || current === lastMonthId;
  }

  // ── Relectura de counts (relleno y nº interesados) ───────────────────────────
  private reloadCounts(): void {
    const fromISO = this.toISO(this.start);
    const toISO = this.toISO(this.end);
    this.loading.set(true);
    if (!this.isBrowser) return; // Evita llamadas HTTP en SSR/prerender
    this.api.getCounts(fromISO, toISO).subscribe({
      next: (res) => {
        if (!res.ok) {
          this.error.set('No se pudo obtener la disponibilidad.');
        } else {
          this.counts.set(res.counts ?? {});
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error de red al obtener datos.');
        this.loading.set(false);
      },
    });
  }
}
