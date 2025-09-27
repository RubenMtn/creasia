/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Carrusel infinito con franja negra entre fotos (sin parada en la franja).
 * Mejora: arranque siempre sobre una IMAGEN, sin transición, y mostramos los velos de fade
 * sólo cuando al menos una imagen ha cargado (imagesReady = true).
 */
//import { SwipeGestureDirective } from 'src/app/shared/directives/swipe-gesture.directive';
import { SwipeGestureDirective } from './../../directives/swipe-gesture.directive';
import { Router } from '@angular/router';
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
  imports: [CommonModule, SwipeGestureDirective],
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

  // Velos de fade (bisel negro lateral durante la transición)
  @Input() fadeEdges: boolean = true;
  @Input() fadeEdgeWidth: number = 0.12;             // 12% por lado
  @Input() fadeColor: string = 'rgba(0,0,0,0.9)';    // opacidad del velo

  // ===== Estado =====
  baseSlides: Slide[] = [];   // [IMG, SEP, IMG, SEP, ...]
  extSlides: Slide[] = [];    // infinito: [BASE][BASE][BASE] o [BASE] si loop=false

  containerW = 0;
  slideW: number[] = [];
  offsets: number[] = [];

  visIndex = 0;
  enableTransition = true;

  private isSnapping = false;
  private autoplayFrozen = false;
  private initialPositioned = false;

  private router = inject(Router);

  /** ✅ Se activa cuando al menos una imagen ha cargado: habilita velos de fade */
  imagesReady = false;

  private timer: any = null;
  private hovering = false;
  private resizeObs: ResizeObserver | null = null;

  @ViewChild('wrapEl', { static: false }) private wrapEl?: ElementRef<HTMLElement>;
  @ViewChild('trackEl', { static: false }) private trackEl?: ElementRef<HTMLDivElement>;

  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  private _justSwiped = false; // flag para inhibir el click tras un swipe
  private _ignoreNextClick = false; // evita “click” fantasma tras navegar en pointerup
  private _tapStart: { x: number; y: number } | null = null;

  // Índice lógico actual (0..n-1) para bullets
  get current(): number {
    const n = this.images.length;
    if (n === 0) return 0;
    const baseLen = this.baseSlides.length || 1;
    const basePos = this.loop && n > 1
      ? ((this.visIndex % baseLen) + baseLen) % baseLen
      : this.visIndex;
    return Math.floor(basePos / 2) % n;
  }

  ngOnInit(): void {
    this.rebuildSlides();
  }

  ngAfterViewInit(): void {
    this.placeInitialPositionNoTransition();
    this.startAutoplay();
    const host = this.wrapEl?.nativeElement;
    if (host && 'ResizeObserver' in window) {
      this.resizeObs = new ResizeObserver(() => {
        this.placeInitialPositionNoTransition();
      });
      this.resizeObs.observe(host);
    }
    document.addEventListener('visibilitychange', this.onVisibility, false);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['images'] || changes['separatorRatio'] || changes['loop'] ||
      changes['autoplayMs'] || changes['transitionMs'] ||
      changes['fadeEdges'] || changes['fadeEdgeWidth'] || changes['fadeColor']) {
      this.rebuildSlides();
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

    // BASE: IMG, SEP, IMG, SEP... (si 1 imagen, sin SEP)
    imgs.forEach((im, i) => {
      this.baseSlides.push({ kind: 'img', idx: i, data: im });
      if (imgs.length > 1) this.baseSlides.push({ kind: 'sep' });
    });

    if (this.loop && imgs.length > 1) {
      // Triple BASE para infinito suave
      this.extSlides = [...this.baseSlides, ...this.baseSlides, ...this.baseSlides];
      // ✅ Arrancar en el bloque central **sobre la PRIMERA IMAGEN real** (no separador)
      const firstImgPosInBase = Math.max(0, this.baseSlides.findIndex(sl => sl.kind === 'img'));
      this.visIndex = this.baseSlides.length + firstImgPosInBase;
    } else {
      this.extSlides = [...this.baseSlides];
      this.visIndex = 0;
    }

    this.enableTransition = true;
    this.isSnapping = false;
    this.initialPositioned = false;
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

  // ===== Colocación inicial sin transición =====
  private placeInitialPositionNoTransition(): void {
    this.autoplayFrozen = true;
    this.enableTransition = false;
    this.cdr.detectChanges();

    this.measureAndLayout();

    // ✅ Asegurar que arrancamos sobre una IMAGEN real (no en un separador)
    if (this.extSlides[this.visIndex]?.kind !== 'img') {
      const baseLen = this.baseSlides.length;
      // Buscar la primera imagen en el bloque central
      const firstImgPosInBase = Math.max(0, this.baseSlides.findIndex(sl => sl.kind === 'img'));
      this.visIndex = (this.loop && this.images.length > 1)
        ? baseLen + firstImgPosInBase
        : firstImgPosInBase;
    }

    this.cdr.detectChanges();
    this.forceReflow();

    requestAnimationFrame(() => {
      this.enableTransition = true;
      this.initialPositioned = true;
      this.autoplayFrozen = false;
      this.cdr.markForCheck();
    });
  }

  private forceReflow(): void {
    try { void this.trackEl?.nativeElement.offsetHeight; } catch { }
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
    return this.images.length > 1 ? 2 : 1; // IMG→IMG (saltando SEP)
  }

  private nextInternal(): void {
    if (!this.initialPositioned || this.images.length <= 1) return;
    if (this.autoplayFrozen || this.isSnapping || !this.enableTransition) return;
    this.enableTransition = true;
    this.visIndex += this.stepSize();
    this.cdr.markForCheck();
  }

  private prevInternal(): void {
    if (!this.initialPositioned || this.images.length <= 1) return;
    if (this.autoplayFrozen || this.isSnapping || !this.enableTransition) return;
    this.enableTransition = true;
    this.visIndex -= this.stepSize();
    this.cdr.markForCheck();
  }

  private goToInternal(imgIndex: number): void {
    if (imgIndex < 0 || imgIndex > this.images.length - 1) return;
    if (this.autoplayFrozen || this.isSnapping) return;
    this.enableTransition = true;
    if (!this.loop || this.images.length <= 1) {
      this.visIndex = this.images.length > 1 ? imgIndex * 2 : 0;
    } else {
      this.visIndex = this.baseSlides.length + (imgIndex * 2);
    }
    this.cdr.markForCheck();
  }

  prev(): void { this.prevInternal(); }
  next(): void { this.nextInternal(); }
  goTo(i: number): void { this.goToInternal(i); }

  // ===== Fin de transición: recentrado invisible =====
  onTrackTransitionEnd(ev: TransitionEvent): void {
    if (ev.propertyName !== 'transform') return;
    if (!this.trackEl || ev.target !== this.trackEl.nativeElement) return;
    if (!(this.loop && this.images.length > 1)) return;

    const baseLen = this.baseSlides.length;
    if (this.visIndex >= baseLen * 2) {
      this.snapWithoutTransition(this.visIndex - baseLen);
      return;
    }
    if (this.visIndex < baseLen) {
      this.snapWithoutTransition(this.visIndex + baseLen);
      return;
    }
  }

  private snapWithoutTransition(target: number): void {
    this.autoplayFrozen = true;
    this.isSnapping = true;

    this.enableTransition = false;
    this.cdr.detectChanges();

    this.visIndex = target;
    this.cdr.detectChanges();

    this.forceReflow();

    requestAnimationFrame(() => {
      this.enableTransition = true;
      this.isSnapping = false;
      this.autoplayFrozen = false;
      this.cdr.markForCheck();
    });
  }

  // ===== Translate actual (px) =====
  get translateXPx(): number {
    if (!this.offsets.length) return 0;
    const i = Math.max(0, Math.min(this.visIndex, this.offsets.length - 1));
    return this.offsets[i] ?? 0;
  }

  // ===== Imagen cargada: habilita velos de fade =====
  onImgLoad(): void {
    if (!this.imagesReady) {
      this.imagesReady = true;
      this.cdr.markForCheck();
    }
  }

  goToGaleria(): void {
    if (this._justSwiped) return; // ignora clic si viene de swipe
    this.router.navigateByUrl('/cultura');
  }

  // Manejo del evento genérico de swipe para setear el flag unos ms
  onSwiped(): void {
    this._justSwiped = true;
    setTimeout(() => (this._justSwiped = false), 180); // ventana corta para evitar el click fantasma
  }

  onSlidePointerDown(ev: any): void {
    const x = ev?.clientX ?? ev?.changedTouches?.[0]?.clientX ?? 0;
    const y = ev?.clientY ?? ev?.changedTouches?.[0]?.clientY ?? 0;
    this._tapStart = { x, y };
  }

  onSlidePointerUp(ev: any): void {
    if (!this._tapStart) return;
    const x = ev?.clientX ?? ev?.changedTouches?.[0]?.clientX ?? 0;
    const y = ev?.clientY ?? ev?.changedTouches?.[0]?.clientY ?? 0;
    const dx = Math.abs(x - this._tapStart.x);
    const dy = Math.abs(y - this._tapStart.y);
    this._tapStart = null;

    // Umbral un poco mayor para Android: menos falsos negativos
    if (dx < 10 && dy < 10) {
      this._ignoreNextClick = true; // ignora el click fantasma posterior
      Promise.resolve().then(() => this.router.navigateByUrl('/galeria'));
    }
  }

  onSlideClick(): void {
    if (this._justSwiped || this._ignoreNextClick) { this._ignoreNextClick = false; return; }
    Promise.resolve().then(() => this.router.navigateByUrl('/galeria'));
  }

  onSlideAnchorClick(ev: Event): void {
    // Si venimos de swipe o ya navegamos en pointerup, NO navegamos por el anchor
    if (this._justSwiped || this._ignoreNextClick) {
      ev.preventDefault();
      this._ignoreNextClick = false;
      return;
    }
    // Evita la navegación del anchor y usa el router (diferido) para SPA
    ev.preventDefault();
    Promise.resolve().then(() => this.router.navigateByUrl('/galeria'));
  }

  onSlidePointerCancel(): void {
    // Si el SO cancela el gesto, anulamos el tap
    this._tapStart = null;
    this._ignoreNextClick = true;
    setTimeout(() => (this._ignoreNextClick = false), 150);
  }

  // ===== Hover =====
  onMouseEnter(): void { this.hovering = true; }
  onMouseLeave(): void { this.hovering = false; }
}
