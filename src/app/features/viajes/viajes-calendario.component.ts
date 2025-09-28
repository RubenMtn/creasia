// archivo: src/app/features/viajes/viajes-calendario.component.ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViajesApi } from './viajes.api';

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
export class ViajesCalendarioComponent {
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
}
