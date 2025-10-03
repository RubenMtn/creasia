/* eslint-disable @typescript-eslint/no-unused-vars */
// archivo: src/app/features/viajes/viajes-calendario.component.ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViajesApi } from './viajes.api';
// + Añade si no lo tienes:

/** Estructuras auxiliares para render mensual */
interface DiaCell {
    date: Date;
    iso: string;       // YYYY-MM-DD
    inMonth: boolean;  // pertenece al mes visible
    count: number;     // interesados
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
    styleUrls: ['./viajes-calendario.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViajesCalendarioComponent implements OnChanges {
    private api = inject(ViajesApi);

    // Estado
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly counts = signal<Record<string, number>>({}); // mapa YYYY-MM-DD -> interesados

    // Ventana de 18 meses: resto del mes actual + 17 meses
    private readonly today = new Date();
    private readonly start = new Date(this.today); // desde HOY
    private readonly end = (() => {
        const lastOfThisMonth = new Date(this.today.getFullYear(), this.today.getMonth() + 1, 0);
        const end = new Date(lastOfThisMonth);
        end.setMonth(end.getMonth() + 17);                  // +17 meses
        return new Date(end.getFullYear(), end.getMonth() + 1, 0); // último día del mes final
    })();

    // Meses generados a partir de counts
    readonly months = computed<MesView[]>(() => this.buildMonthsView(this.counts()));


    // Recibe si el usuario está logado (ya lo tenías)
@Input() isLoggedIn = false;

// Recibe estado del guardado para mostrar mensaje
@Input() saveState: 'ok' | 'error' | 'idle' = 'idle';

// Recibe si se está guardando para deshabilitar el botón
@Input() saving = false;


    ngOnChanges(ch: SimpleChanges) {
        if (ch['isLoggedIn']) {
            //console.debug('[PruebaPte][Cal] isLoggedIn:', ch['isLoggedIn'].previousValue, '->', ch['isLoggedIn'].currentValue);
            if (ch['isLoggedIn'].currentValue === true) this.loginNoticeMonthId.set(null);
        }
    }


    @Output() saveDates = new EventEmitter<{ from: string; to: string }>(); // emite el rango guardado

    private selectionStart = signal<Date | null>(null);
    private selectionEnd = signal<Date | null>(null);

    // Mes (YYYY-MM) donde mostrar el aviso de "no logado"
    loginNoticeMonthId = signal<string | null>(null);

    // Rango seleccionado listo para usar
    selectedRange = computed(() => {
        const a = this.selectionStart();
        const b = this.selectionEnd();
        if (!a || !b) return null;
        return a <= b ? { from: a, to: b } : { from: b, to: a };
    });

    constructor() {
        // Carga inicial
        const fromISO = this.toISO(this.start);
        const toISO = this.toISO(this.end);
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
            }

        });

        // Efecto de depuración (puedes quitarlo luego)
        effect(() => {
            // console.log('PruebaPte - months len:', this.months().length);
        });
    }

    // ngOnChanges(changes: SimpleChanges): void {
    //     if (changes['isLoggedIn']?.currentValue === true) {
    //         this.loginNoticeMonthId.set(null); // ocultar aviso al logarse
    //     }
    // }

    /** Construye la matriz de meses con semanas y celdas, aplicando counts. */
    private buildMonthsView(counts: Record<string, number>): MesView[] {
        const out: MesView[] = [];
        const firstMonth = new Date(this.start.getFullYear(), this.start.getMonth(), 1);
        const totalMonths = 18; // mes actual (resto) + 17 enteros

        for (let m = 0; m < totalMonths; m++) {
            const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + m, 1);
            const year = monthDate.getFullYear();
            const month = monthDate.getMonth();
            const monthName = this.monthNameEs(month);

            // Primer día de la cuadrícula (lunes a domingo)
            const firstGrid = this.startOfWeek(monthDate);
            // Último día del mes
            const lastOfMonth = new Date(year, month + 1, 0);
            // Último día de la cuadrícula
            const lastGrid = this.endOfWeek(lastOfMonth);

            const weeks: DiaCell[][] = [];
            let cursor = new Date(firstGrid);

            while (cursor <= lastGrid) {
                const week: DiaCell[] = [];
                for (let i = 0; i < 7; i++) {
                    const iso = this.toISO(cursor);
                    week.push({
                        date: new Date(cursor),
                        iso,
                        inMonth: cursor.getMonth() === month,
                        count: counts[iso] ?? 0
                    });
                    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
                }
                weeks.push(week);
            }

            out.push({ year, monthIndex: month, monthName, weeks });
        }
        return out;
    }

    /** Lunes como primer día de semana */
    private startOfWeek(d: Date): Date {
        const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const day = (tmp.getDay() + 6) % 7; // 0..6 con lunes=0
        tmp.setDate(tmp.getDate() - day);
        return tmp;
    }
    private endOfWeek(d: Date): Date {
        const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const day = (tmp.getDay() + 6) % 7;
        tmp.setDate(tmp.getDate() + (6 - day));
        return tmp;
    }

    private toISO(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    private monthNameEs(m: number): string {
        return [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ][m];
    }

    /** Convierte Date -> 'YYYY-MM-DD' (zona local, sin UTC) */
    private toISODate(d: Date): string {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${dd}`;
    }

    /** Id de mes (YYYY-MM) para anclar avisos bajo cada mes */
    monthId(year: number, monthIndexZeroBased: number): string {
        return `${year}-${(monthIndexZeroBased + 1).toString().padStart(2, '0')}`;
    }

    /** Normaliza fecha a medianoche local para comparar por día */
    private dayKey(d: Date): number {
        return +new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    isSelected(date: Date): boolean {
        const s = this.selectionStart();
        const e = this.selectionEnd();
        if (!s && !e) return false;
        if (s && !e) return this.dayKey(date) === this.dayKey(s);
        if (!s && e) return this.dayKey(date) === this.dayKey(e);
        const from = this.selectedRange()!.from;
        const to = this.selectedRange()!.to;
        const k = this.dayKey(date);
        return k >= this.dayKey(from) && k <= this.dayKey(to);
    }

    /** Para estilos del interior del rango (sin extremos) */
    isRangeMiddle(date: Date): boolean {
        const r = this.selectedRange();
        if (!r) return false;
        const k = this.dayKey(date);
        return k > this.dayKey(r.from) && k < this.dayKey(r.to);
    }

    /** Click en día */
    onDayClick(day: Date, monthId: string, inCurrentMonth = true): void {

       // console.debug('[PruebaPte][Cal] click', { day: day.toDateString?.() ?? day, monthId, inCurrentMonth, isLoggedIn: this.isLoggedIn });

        if (!inCurrentMonth) return; // no interactuar con días fuera de mes

        if (!this.isLoggedIn) {
            this.loginNoticeMonthId.set(monthId);
            return;
        }
        // ya logado → limpia cualquier aviso previo
        if (this.loginNoticeMonthId()) this.loginNoticeMonthId.set(null);


        if (!this.isLoggedIn) {
            this.loginNoticeMonthId.set(monthId);
           // console.debug('[PruebaPte] no logado, aviso mes', monthId);
            return;
        }

        // ⬇️ Si ya estás logado, asegúrate de limpiar el aviso
        if (this.loginNoticeMonthId()) {
            this.loginNoticeMonthId.set(null);
        }

        if (!this.isLoggedIn) {
            // Mostrar aviso SOLO en el mes clicado
            this.loginNoticeMonthId.set(monthId);
            return;
        }

        // Modo logado: selección por rango
        const s = this.selectionStart();
        const e = this.selectionEnd();

        if (!s) {
            // primer punto
            this.selectionStart.set(day);
            this.selectionEnd.set(null);
        } else if (!e) {
            // segundo punto
            if (this.dayKey(day) < this.dayKey(s)) {
                this.selectionEnd.set(s);
                this.selectionStart.set(day);
            } else {
                this.selectionEnd.set(day);
            }
        } else {
            // ya había rango completo -> empezar uno nuevo desde el día pulsado
            this.selectionStart.set(day);
            this.selectionEnd.set(null);
        }
    }

    /** Guardar rango (emite evento al padre; integraremos API más adelante) */
    emitSave(): void {

        const r = this.selectedRange();
        if (!r) return;
        const from = this.toISODate(r.from);
        const to = this.toISODate(r.to);
      //  console.debug('[PruebaPte] Guardar fechas ->', from, to);
        this.saveDates.emit({ from, to });

       // console.debug('[PruebaPte][Cal] emitSave', { from, to });
    }

    /** Permite limpiar selección si quisieras añadir un botón "Cancelar" */
    clearSelection(): void {
        this.selectionStart.set(null);
        this.selectionEnd.set(null);
    }

    isUserLoggedIn = /* lo que uses (servicio/selector/signal) */ false;

    onSaveDates(e: { from: string; to: string }) {
       // console.debug('[PruebaPte] Rango recibido en padre:', e);
        // Aquí llamas a tu API cuando la tengas lista:
        // this.viajesApi.saveRange(e.from, e.to).subscribe(...)
    }

    // ⬇️ Inserta en la clase (utilidades de mes/rango)
    rangeStartsInMonth(year: number, monthIndexZeroBased: number): boolean {
        const r = this.selectedRange();
        if (!r) return false;
        return r.from.getFullYear() === year && r.from.getMonth() === monthIndexZeroBased;
    }

    rangeLabel(): string | null {
        const r = this.selectedRange();
        if (!r) return null;
        const ymd = (d: Date) =>
            `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
                .getDate()
                .toString()
                .padStart(2, '0')}`;
        return `${ymd(r.from)} — ${ymd(r.to)}`;
    }

    /** Devuelve true si el rango seleccionado intersecta con ese mes (year, monthIndex 0–11) */
    rangeIntersectsMonth(year: number, monthIndexZeroBased: number): boolean {
        const r = this.selectedRange();
        if (!r) return false;

        // Inicio y fin de ese mes en zona local
        const monthStart = new Date(year, monthIndexZeroBased, 1);
        const monthEnd = new Date(year, monthIndexZeroBased + 1, 0); // último día del mes

        const fromKey = this.dayKey(r.from);
        const toKey = this.dayKey(r.to);
        return this.dayKey(monthStart) <= toKey && this.dayKey(monthEnd) >= fromKey;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Muestra acciones SOLO en el primer y último mes del rango seleccionado
    // - Caso rango en un único mes: muestra en ese mes (una sola vez).
    // - Caso rango cruzando varios meses: muestra en el mes de 'from' y en el mes de 'to'.
    // ────────────────────────────────────────────────────────────────────────────
    isEdgeOfRangeMonth(year: number, monthIndex: number): boolean {
        const r = this.selectedRange?.();
        if (!r) return false;

        // Normalizamos a “mes” de inicio y fin (año/mes)
        const firstMonthId = this.monthId(r.from.getFullYear(), r.from.getMonth());
        const lastMonthId = this.monthId(r.to.getFullYear(), r.to.getMonth());

        const current = this.monthId(year, monthIndex);

        // Si el rango está en un único mes, first == last -> muestra solo en ese mes
        if (firstMonthId === lastMonthId) {
            return current === firstMonthId;
        }

        // Si abarca varios meses -> muestra en extremos
        return current === firstMonthId || current === lastMonthId;
    }


    /* 🔧 Si aún no la tienes en el componente, añade esta utilidad (≈3 líneas):
    private dayKey(d: Date): number {
      return +new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    */


}
