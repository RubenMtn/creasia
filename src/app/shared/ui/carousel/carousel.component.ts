/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Carrusel infinito con franja negra entre fotos (sin parada en la franja).
 * - BASE: [IMG, SEP, IMG, SEP, ...]  (SEP = franja negra de ancho ratio)
 * - EXTENDIDO: [BASE][BASE][BASE] y arrancamos en el bloque central.
 * - Avance IMG→IMG (salta SEP), franja sólo visible durante la transición.
 * - Animación en píxeles (cada slide tiene su ancho).
 *
 * CAMBIOS para eliminar “retroceso” y “movimiento raro” al abrir:
 * - CAMBIO: Posicionamiento inicial sin transición (disable → set index → detectChanges → reflow → enable).
 * - CAMBIO: Snap/recentrado sin transición con congelación total del autoplay.
 * - CAMBIO: Guards extra contra ticks durante snaps y mientras la transición está desactivada.
 */
import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  ViewChild,
  ElementRef,
  inject,
} from '@angular/core';

export interface CarouselImage {
  src: string;
  alt?: string;
  caption?: string;
  link?: string;
}

type Slide =
  | { kind: 'img'; idx: number; data: CarouselImage }
  | { kind: 'sep' };

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarouselComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  // ===== Inputs =====
  @Input() images: CarouselImage[] = [];
  @Input() height: string = '420px';
  @Input() autoplayMs: number = 5000;
  @Input() loop: boolean = true;
  @Input() showIndicators: boolean = true;
  @Input() showArrows: boolean = true;
  @Input() pauseOnHover: boolean = true;
  @Input() separatorRatio: number = 0.25;
  @Input() separatorColor: string = '#000';
  @Input() transitionMs: number = 600;

  // ===== Estado =====
  baseSlides: Slide[] = [];   // [IMG, SEP, IMG, SEP, ...]
  extSlides: Slide[] = [];    // [BASE][BASE][BASE] si loop=true y 2+ imgs; si no, solo BASE

  containerW = 0;
  slideW: number[] = [];
  offsets: number[] = [];

  visIndex = 0;
  enableTransition = true;

  // CAMBIO: flags para evitar animaciones “fantasma”
  private isSnapping = false;      // durante recentrado/snap
  private autoplayFrozen = false;  // congela ticks del autoplay en operaciones críticas
  private initialPositioned = false; // ya colocamos posición inicial sin transición

  private timer: any = null;
  private hovering = false;
  private resizeObs: ResizeObserver | null = null;

  @ViewChild('wrapEl', { static: false }) private wrapEl?: ElementRef<HTMLElement>;
  @ViewChild('trackEl', { static: false }) private trackEl?: ElementRef<HTMLDivElement>;

  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  // Índice lógico actual para bullets (0..n-1)
  get current(): number {
    const n = this.images.length;
    if (n === 0) return 0;
    const baseLen = this.baseSlides.length || 1;
    const basePos = this.loop && n > 1
      ? ((this.visIndex % baseLen) + baseLen) % baseLen
      : this.visIndex;
    return Math.floor(basePos / 2) % n;
  }

  // ===== Lifecycle =====
  ngOnInit(): void {
    this.rebuildSlides();
  }

  ngAfterViewInit(): void {
    // CAMBIO: colocar posición inicial SIN transición y sólo entonces arrancar autoplay
    this.placeInitialPositionNoTransition(); // <- clave para quitar el “movimiento raro” al abrir
    this.startAutoplay();
    const host = this.wrapEl?.nativeElement;
    if (host && 'ResizeObserver' in window) {
      this.resizeObs = new ResizeObserver(() => {
        // CAMBIO: en resize, re-medir y recolocar sin transición
        this.placeInitialPositionNoTransition();
      });
      this.resizeObs.observe(host);
    }
    document.addEventListener('visibilitychange', this.onVisibility, false);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['images'] || changes['separatorRatio'] || changes['loop'] ||
        changes['autoplayMs'] || changes['transitionMs']) {
      this.rebuildSlides();
      // CAMBIO: tras cambios, recolocar sin transición antes de reactivar autoplay
      this.placeInitialPositionNoTransition();
      this.restartAutoplay();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    if (this.resizeObs) { this.resizeObs.disconnect(); this.resizeObs = null; }
    document.removeEventListener('visibilitychange', this.onVisibility, false);
  }

  // ===== Construcción de secuencias =====
  private rebuildSlides(): void {
    const imgs = this.images ?? [];
    this.baseSlides = [];

    if (imgs.length === 0) {
      this.extSlides = [];
      this.visIndex = 0;
      return;
    }

    // BASE: IMG, SEP, IMG, SEP (si solo 1 imagen, sin SEP)
    imgs.forEach((im, i) => {
      this.baseSlides.push({ kind: 'img', idx: i, data: im });
      if (imgs.length > 1) this.baseSlides.push({ kind: 'sep' });
    });

    if (this.loop && imgs.length > 1) {
      // infinito suave: tres bloques BASE y arrancar en el central
      this.extSlides = [...this.baseSlides, ...this.baseSlides, ...this.baseSlides];
      this.visIndex = this.baseSlides.length; // centro
    } else {
      this.extSlides = [...this.baseSlides];
      this.visIndex = 0;
    }

    this.enableTransition = true;
    this.isSnapping = false;
    this.initialPositioned = false; // CAMBIO: forzaremos recolocación sin transición
    this.cdr.markForCheck();
  }

  // ===== Medidas / layout =====
  private measureAndLayout(): void {
    const host = this.wrapEl?.nativeElement;
    const w = host ? (host.clientWidth || host.getBoundingClientRect().width) : 0;

    if (!w || w < 1) {
      requestAnimationFrame(() => this.measureAndLayout());
      return;
    }

    this.containerW = w;
    const sepW = Math.max(0, Math.min(1, this.separatorRatio)) * this.containerW;

    this.slideW = this.extSlides.map(sl => sl.kind === 'img' ? this.containerW : sepW);

    this.offsets = new Array(this.slideW.length).fill(0);
    for (let i = 1; i < this.offsets.length; i++) {
      this.offsets[i] = this.offsets[i - 1] + this.slideW[i - 1];
    }

    if (this.visIndex > this.extSlides.length - 1) {
      this.visIndex = Math.max(0, this.extSlides.length - 1);
    }

    this.cdr.markForCheck();
  }

  // ===== Colocación inicial sin transición (FIX arranque) =====
  private placeInitialPositionNoTransition(): void {
    // CAMBIO: desactivar transición, medir, fijar índice de arranque y reflow antes de reactivar
    this.autoplayFrozen = true;          // congela ticks
    this.enableTransition = false;       // sin transición
    this.cdr.detectChanges();            // aplica [class.notransition] / [style.transition]

    this.measureAndLayout();

    // índice de arranque: centro si loop & 2+, si no 0
    this.visIndex = (this.loop && this.images.length > 1)
      ? this.baseSlides.length
      : 0;

    this.cdr.detectChanges();            // aplica nuevo transform (sin transición)
    this.forceReflow();                  // fija el frame actual

    // reactivar transición en el próximo frame
    requestAnimationFrame(() => {
      this.enableTransition = true;
      this.initialPositioned = true;     // a partir de aquí puede correr el autoplay
      this.autoplayFrozen = false;       // liberar
      this.cdr.markForCheck();
    });
  }

  private forceReflow(): void {
    try { void this.trackEl?.nativeElement.offsetHeight; } catch {}
  }

  // ===== Autoplay =====
  private onVisibility = () => {
    if (document.hidden) this.stopAutoplay();
    else this.startAutoplay();
  };

  private startAutoplay(): void {
    this.stopAutoplay();
    const n = this.images.length;
    if (this.autoplayMs > 0 && n > 1) {
      this.zone.runOutsideAngular(() => {
        this.timer = setInterval(() => {
          this.zone.run(() => {
            // CAMBIO: no avanzar si estamos congelados o “snapping”
            if (this.autoplayFrozen || this.isSnapping) return;
            if (!this.pauseOnHover || !this.hovering) this.nextInternal();
          });
        }, this.autoplayMs);
      });
    }
  }

  private stopAutoplay(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private restartAutoplay(): void {
    this.cdr.markForCheck();
    this.startAutoplay();
  }

  // ===== Navegación =====
  private stepSize(): number {
    return this.images.length > 1 ? 2 : 1; // IMG→IMG saltando SEP
  }

  private nextInternal(): void {
    if (!this.initialPositioned || this.images.length <= 1) return;
    if (this.autoplayFrozen || this.isSnapping || !this.enableTransition) return; // CAMBIO: más guards

    this.enableTransition = true;
    this.visIndex += this.stepSize();
    this.cdr.markForCheck();
  }

  private prevInternal(): void {
    if (!this.initialPositioned || this.images.length <= 1) return;
    if (this.autoplayFrozen || this.isSnapping || !this.enableTransition) return; // CAMBIO: más guards

    this.enableTransition = true;
    this.visIndex -= this.stepSize();
    this.cdr.markForCheck();
  }

  private goToInternal(imgIndex: number): void {
    if (imgIndex < 0 || imgIndex > this.images.length - 1) return;
    if (this.autoplayFrozen || this.isSnapping) return; // CAMBIO

    this.enableTransition = true;
    if (!this.loop || this.images.length <= 1) {
      this.visIndex = this.images.length > 1 ? imgIndex * 2 : 0;
    } else {
      // colocar en el bloque central
      this.visIndex = this.baseSlides.length + (imgIndex * 2);
    }
    this.cdr.markForCheck();
  }

  prev(): void { this.prevInternal(); }
  next(): void { this.nextInternal(); }
  goTo(i: number): void { this.goToInternal(i); }

  // ===== Fin de transición: recentrado invisible en el bloque central =====
  onTrackTransitionEnd(ev: TransitionEvent): void {
    if (ev.propertyName !== 'transform') return;
    if (!this.trackEl || ev.target !== this.trackEl.nativeElement) return;
    if (!(this.loop && this.images.length > 1)) return;

    const baseLen = this.baseSlides.length;

    // Si salimos por la derecha (tercer bloque), recentrar restando baseLen.
    if (this.visIndex >= baseLen * 2) {
      this.snapWithoutTransition(this.visIndex - baseLen);
      return;
    }
    // Si salimos por la izquierda (primer bloque), recentrar sumando baseLen.
    if (this.visIndex < baseLen) {
      this.snapWithoutTransition(this.visIndex + baseLen);
      return;
    }
  }

  private snapWithoutTransition(target: number): void {
    // CAMBIO: congelar autoplay y bloquear cambios mientras hacemos el snap.
    this.autoplayFrozen = true;
    this.isSnapping = true;

    this.enableTransition = false;   // sin transición
    this.cdr.detectChanges();        // aplicar “no transition”

    this.visIndex = target;          // mover a la posición equivalente del bloque central
    this.cdr.detectChanges();        // aplicar transform sin transición

    this.forceReflow();              // fijar el frame sin animación

    requestAnimationFrame(() => {
      this.enableTransition = true;  // reactivar transición
      this.isSnapping = false;
      this.autoplayFrozen = false;   // liberar autoplay
      this.cdr.markForCheck();
    });
  }

  // ===== Translate actual (px) =====
  get translateXPx(): number {
    if (!this.offsets.length) return 0;
    const i = Math.max(0, Math.min(this.visIndex, this.offsets.length - 1));
    return this.offsets[i] ?? 0;
  }

  // ===== Hover (pausa opcional) =====
  onMouseEnter(): void { this.hovering = true; }
  onMouseLeave(): void { this.hovering = false; }
}
