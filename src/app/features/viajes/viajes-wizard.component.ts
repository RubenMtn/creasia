// Componente: src/app/features/viajes/viajes-wizard.component.ts
// -------------------------------------------------------------
// - Fase 0 (Intro) sin cabecera de progreso.
// - Pasos 1–3 con cabecera: línea + 3 hitos circulares (1–2–3) y reglas de avance visual.
// - Botón “Guardar preferencias” se bloquea al guardar; si el usuario navega o edita, se desbloquea.
// - Barra de progreso (nueva lógica):
//    * Paso 1: 25%
//    * Paso 2: 55%
//    * Paso 3: 90%
//    * Guardado final: 100% + los 3 hitos activos en dorado
// - Los círculos son clicables sólo para volver atrás (por ejemplo de 3 → 2 o 1).
// - Siempre que se cambia de paso (botones o click en círculo), se hace scroll al inicio.
// - Sin `any`; usamos inject(), signals y tipado estricto. SSR-safe.

import {
    Component,
    computed,
    signal,
    inject,
    effect,
    DestroyRef,
    ElementRef,
    ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViajesPreferenciasComponent } from './viajes-preferencias.component';
import { ViajesCalendarioComponent } from './viajes-calendario.component';
import {
    ViajesPreferenciasService,
    PreferenciasViaje
} from './viajes-preferencias.service';
import { UserSessionService } from '../../services/user-session.service';

type Paso = 0 | 1 | 2 | 3; // 0: Intro, 1–3: etapas "reales"

interface SessionLike {
    isLoggedIn: boolean | (() => boolean);
}

function readMaybeFnBoolean(v: boolean | (() => boolean)): boolean {
    return typeof v === 'function' ? !!v() : !!v;
}

@Component({
    selector: 'app-viajes-wizard',
    standalone: true,
    imports: [CommonModule, ViajesPreferenciasComponent, ViajesCalendarioComponent],
    templateUrl: './viajes-wizard.component.html',
    styleUrl: './viajes-wizard.component.scss'
})
export class ViajesWizardComponent {
    // Ancla visual para hacer scroll al inicio del wizard
    @ViewChild('topAnchor') private topAnchor?: ElementRef<HTMLDivElement>;

    // Servicios
    private readonly prefs = inject(ViajesPreferenciasService);
    private readonly session = inject(UserSessionService) as unknown as SessionLike;
    private readonly destroyRef = inject(DestroyRef);

    // Estado global
    readonly logged = computed<boolean>(() => readMaybeFnBoolean(this.session.isLoggedIn));
    readonly paso = signal<Paso>(0);
    readonly showLoginWarning = signal<boolean>(false);

    // Resumen de preferencias (suscripción a cambios para pintar el resumen en paso 3)
    readonly prefsSnapshot = signal<PreferenciasViaje>(this.prefs.value);

    // Nota libre (máx. 200 caracteres)
    readonly nota = signal<string>('');
    readonly notaRestante = computed<number>(() => 200 - this.nota().length);

    // Estado de guardado final (controla bloqueo del botón y 100% de progreso)
    readonly saved = signal<boolean>(false);

    // Habilitación “Siguiente”
    private readonly prefsListas = signal<boolean>(true);
    readonly puedeSiguiente = computed<boolean>(() => {
        const p = this.paso();
        if (p === 1) return this.prefsListas();
        if (p === 2) return true;
        return true;
    });

    // Posición del avión en la barra (puede ser diferente al % de la barra dorada)
    readonly planePct = computed<number>(() => {
        // Si está guardado, da igual el avión porque ya no se muestra (pero devolvemos 100 por coherencia)
        if (this.saved()) {
            return 100;
        }

        const p = this.paso();

        if (p === 1) return 25;
        if (p === 2) return 55;
        if (p === 3) return 80; // ⬅️ avión al 80% en la fase 3 antes de guardar
        return 0;               // fase 0 intro (no se muestra barra) o fallback
    });


    constructor() {
        // Mantener snapshot de preferencias sincronizado para el resumen del paso 3
        const sub = this.prefs.prefs$.subscribe(v => this.prefsSnapshot.set(v));
        this.destroyRef.onDestroy(() => sub.unsubscribe());

        // Si el usuario se loga estando en Intro y había aviso, lo ocultamos
        effect(() => {
            if (this.logged() && this.showLoginWarning()) {
                this.showLoginWarning.set(false);
            }
        });
    }

    // ------------------
    // Navegación por botones
    // ------------------

    /**
     * Ir al paso anterior:
     * - desbloquea estado "saved"
     * - mueve el scroll arriba
     */
    anterior(): void {
        const p = this.paso();
        if (p > 0) {
            this.paso.set((p - 1) as Paso);
            if (this.saved()) this.saved.set(false);
            this.scrollToTopDeferred();
        }
    }

    /**
     * Ir al paso siguiente:
     * - desbloquea estado "saved"
     * - mueve el scroll arriba
     */
    siguiente(): void {
        const p = this.paso();
        if (p > 0 && p < 3 && this.puedeSiguiente()) {
            this.paso.set((p + 1) as Paso);
            if (this.saved()) this.saved.set(false);
            this.scrollToTopDeferred();
        }
    }

    /**
     * Arrancar desde la intro:
     * - si no está logado, mostramos aviso inline
     * - si sí, vamos al paso 1
     * - resetea nota y saved
     * - scroll arriba
     */
    empezar(): void {
        if (!this.logged()) {
            this.showLoginWarning.set(true);
            return;
        }
        this.saved.set(false);
        this.nota.set('');
        this.paso.set(1);
        this.scrollToTopDeferred();
    }

    // ------------------
    // Navegación por clic en los hitos de la barra
    // ------------------

    /**
     * Permite volver atrás clicando en los círculos de la barra superior.
     * - Sólo deja ir a un paso anterior al actual (no puedes saltar hacia delante).
     * - Al volver atrás desbloquea "saved".
     * - Hace scroll arriba.
     */
    goToPasoFromMilestone(dest: 1 | 2 | 3): void {
        const current = this.paso();
        // Sólo permitimos retroceder a pasos ya cubiertos.
        if (dest < current && current > 0) {
            this.paso.set(dest as Paso);
            if (this.saved()) this.saved.set(false);
            this.scrollToTopDeferred();
        }
        // Si intentan ir hacia delante o quedarse igual, no hacemos nada.
    }

    // ------------------
    // Gestión de preferencias y nota final
    // ------------------

    /**
     * Se llama cuando el componente de preferencias emite cambios.
     * Cualquier cambio:
     * - actualiza las preferencias en el servicio
     * - marca que ya se pueden seguir
     * - si ya estaba "guardado", lo desmarca
     */
    onPreferenciasReady(v: PreferenciasViaje): void {
        this.prefs.setAll(v);
        this.prefsListas.set(true);
        if (this.saved()) this.saved.set(false);
    }

    /**
     * Gestiona el textarea del paso 3:
     * - recorta a 200 caracteres
     * - al modificar desbloquea el guardado final (barra vuelve al 90%)
     */
    onNotaInput(ev: Event): void {
        const el = ev.target as HTMLTextAreaElement | null;
        const value = (el?.value ?? '').slice(0, 200);
        this.nota.set(value);
        if (this.saved()) this.saved.set(false);
    }

    /**
     * Guardado final:
     * - marca saved=true
     * - bloquea el botón Guardar preferencias
     * - pone la barra al 100% y los tres hitos activos
     */
    guardarPreferencias(): void {
        this.saved.set(true);
        // Aquí en el futuro enviaremos prefsSnapshot() + nota() al backend.
    }

    // ------------------
    // Utilidad de scroll
    // ------------------

    /**
     * Hace scroll al inicio del wizard DESPUÉS de que Angular pinte el paso nuevo.
     * requestAnimationFrame anidado para asegurar que el DOM destino ya está en pantalla.
     * SSR-safe.
     */
    private scrollToTopDeferred(): void {
        if (typeof window === 'undefined') return;

        const doScroll = () => {
            const el = this.topAnchor?.nativeElement;
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'auto', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'auto' });
            }
        };

        if ('requestAnimationFrame' in window) {
            requestAnimationFrame(() => {
                requestAnimationFrame(doScroll);
            });
        } else {
            setTimeout(doScroll, 0);
        }
    }
}
