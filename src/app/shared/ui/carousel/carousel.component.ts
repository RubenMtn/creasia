/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Carrusel de imágenes sin dependencias externas.
 * - Standalone (no necesita módulo).
 * - Accesible (roles ARIA, teclado, focus).
 * - Autoplay con pausa al pasar el ratón (configurable) o si la pestaña no está visible.
 * - Swipe en móvil (gestos táctiles).
 * - Indicadores (bullets) opcionales.
 *
 * CAMBIOS CLAVE (para resolver el lint @angular-eslint/prefer-inject):
 * - Sustituida la inyección por constructor por `inject()`:
 *   • `private cdr = inject(ChangeDetectorRef)`
 *   • `private zone = inject(NgZone)`
 * - Mantiene OnPush y forzado de repintado con markForCheck().
 * - El temporizador corre fuera de Angular y solo entra al avanzar slide.
 */
import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectionStrategy,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  NgZone,
  inject, // ➕ usamos la API de inyección funcional
} from '@angular/core';

export interface CarouselImage {
  /** Ruta de la imagen (relativa a /assets o absoluta) */
  src: string;
  /** Texto alternativo para accesibilidad */
  alt?: string;
  /** Caption opcional (se muestra sobre la imagen) */
  caption?: string;
  /** Enlace opcional: si existe, la diapositiva se hace clicable */
  link?: string;
}

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarouselComponent implements OnInit, OnDestroy, OnChanges {
  // ====== Entradas configurables ======

  /** Lista de imágenes del carrusel */
  @Input() images: CarouselImage[] = [];

  /** Altura del carrusel (px, vh, etc.). Ej: '420px', '60vh' */
  @Input() height: string = '420px';

  /** Intervalo del autoplay (ms). 0 o negativo desactiva autoplay */
  @Input() autoplayMs: number = 5000;

  /** Si true, al llegar al final vuelve al inicio */
  @Input() loop: boolean = true;

  /** Muestra u oculta los “bullets” (indicadores) */
  @Input() showIndicators: boolean = true;

  /** Muestra u oculta los botones prev/next */
  @Input() showArrows: boolean = true;

  /** Si true (por defecto), el hover pausa el autoplay en desktop */
  @Input() pauseOnHover: boolean = true;

  // ====== Estado interno ======
  current = 0;          // índice actual
  private timer: any;   // id del setInterval del autoplay
  private hovering = false;
  private touchStartX = 0;
  private touchDeltaX = 0;

  // ➕ Inyección con inject() (resuelve el warning prefer-inject)
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  // ====== Ciclo de vida ======
  ngOnInit(): void {
    this.startAutoplay();
    // Pausar si la pestaña deja de estar visible (ahorra batería)
    document.addEventListener('visibilitychange', this.onVisibility, false);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reinicio defensivo si cambian imágenes o intervalo
    if (changes['images'] || changes['autoplayMs']) {
      this.restartAutoplayDefensive();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    document.removeEventListener('visibilitychange', this.onVisibility, false);
  }

  // ====== Autoplay ======

  /** Pausa/Reanuda según visibilidad de la pestaña */
  private onVisibility = () => {
    if (document.hidden) this.stopAutoplay();
    else this.startAutoplay();
  };

  /** Inicia el autoplay si procede (≥2 imágenes y autoplayMs > 0) */
  private startAutoplay(): void {
    this.stopAutoplay(); // limpia si ya había uno
    if (this.autoplayMs > 0 && this.images && this.images.length > 1) {
      // ✅ Ejecutar el temporizador fuera de Angular para no provocar CD constante
      this.zone.runOutsideAngular(() => {
        this.timer = setInterval(() => {
          // ↩️ Volvemos a Angular sólo para avanzar y marcar el repintado
          this.zone.run(() => {
            if (!this.pauseOnHover || !this.hovering) {
              this.nextInternal();
            }
          });
        }, this.autoplayMs);
      });
    }
  }

  /** Detiene el autoplay si existía */
  private stopAutoplay(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Reinicio defensivo del autoplay cuando:
   * - las imágenes cambian (p. ej., llegan asíncronas), o
   * - cambia el intervalo autoplayMs.
   * Además, si `current` se sale del rango al cambiar el array, lo reajustamos.
   */
  private restartAutoplayDefensive(): void {
    if (this.images && this.images.length > 0) {
      if (this.current > this.images.length - 1) this.current = 0;
    } else {
      this.current = 0;
    }
    // Forzamos repintado por si cambia inmediatamente el track
    this.cdr.markForCheck();
    this.startAutoplay();
  }

  // ====== Navegación (métodos internos que SIEMPRE marcan CD) ======
  private prevInternal(): void {
    const len = this.images?.length ?? 0;
    if (len <= 1) return;
    if (this.current > 0) this.current--;
    else if (this.loop) this.current = len - 1;
    this.cdr.markForCheck(); // asegura repintado en OnPush
  }

  private nextInternal(): void {
    const len = this.images?.length ?? 0;
    if (len <= 1) return;
    if (this.current < len - 1) this.current++;
    else if (this.loop) this.current = 0;
    this.cdr.markForCheck(); // asegura repintado en OnPush
  }

  private goToInternal(index: number): void {
    const len = this.images?.length ?? 0;
    if (len === 0 || index < 0 || index >= len) return;
    this.current = index;
    this.cdr.markForCheck(); // asegura repintado en OnPush
  }

  // ====== API pública (llama a los internos) ======
  prev(): void { this.prevInternal(); }
  next(): void { this.nextInternal(); }
  goTo(index: number): void { this.goToInternal(index); }

  // ====== Accesibilidad (teclado) ======
  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.prevInternal(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); this.nextInternal(); }
  }

  // ====== Hover: pausa el autoplay (en escritorio) ======
  @HostListener('mouseenter')
  onEnter(): void {
    this.hovering = true;
  }

  @HostListener('mouseleave')
  onLeave(): void {
    this.hovering = false;
  }

  // ====== Gestos táctiles (swipe) ======
  onTouchStart(ev: TouchEvent): void {
    this.touchStartX = ev.touches[0]?.clientX ?? 0;
    this.touchDeltaX = 0;
  }

  onTouchMove(ev: TouchEvent): void {
    const x = ev.touches[0]?.clientX ?? 0;
    this.touchDeltaX = x - this.touchStartX;
  }

  onTouchEnd(): void {
    const threshold = 50; // px mínimos para considerar swipe
    if (this.touchDeltaX > threshold) this.prevInternal();
    else if (this.touchDeltaX < -threshold) this.nextInternal();
    this.touchDeltaX = 0;
  }
}
