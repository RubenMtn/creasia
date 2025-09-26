/* eslint-disable no-empty */
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
 * CONTINUIDAD SUAVE (FIX “retroceso”):
 * - Clones: [última] + imágenes + [primera] sólo si loop=true y hay ≥2.
 * - Índice visual (visIndex) arranca en 1 (primera real).
 * - Salto sin transición con forzado de reflow + flag isSnapping.
 * - Autoplay ignora ticks durante el “snap”.
 * - transitionend filtrado por transform y el propio track.
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

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarouselComponent implements OnInit, OnDestroy, OnChanges {
  // ====== Entradas ======
  @Input() images: CarouselImage[] = [];
  @Input() height: string = '420px';
  @Input() autoplayMs: number = 7000;
  @Input() loop: boolean = true;
  @Input() showIndicators: boolean = true;
  @Input() showArrows: boolean = true;
  @Input() pauseOnHover: boolean = true;

  // ====== Estado interno ======
  /** Índice visual sobre la lista extendida */
  visIndex = 0;
  /** Controla si aplicamos transición CSS en el track */
  enableTransition = true;
  /** Estamos realizando un “snap” sin transición */
  private isSnapping = false;

  private timer: any;
  private hovering = false;
  private touchStartX = 0;
  private touchDeltaX = 0;

  @ViewChild('trackEl', { static: false }) private trackEl?: ElementRef<HTMLDivElement>;

  // Inyección (API funcional)
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  // Índice lógico (0..n-1) para bullets/estado
  get current(): number {
    const n = this.images?.length ?? 0;
    if (n <= 1) return 0;
    if (!this.loop) {
      return Math.max(0, Math.min(this.visIndex, n - 1));
    }
    // loop=true con clones
    if (this.visIndex === 0) return n - 1;       // clone de última
    if (this.visIndex === n + 1) return 0;       // clone de primera
    return this.visIndex - 1;                    // 1..n -> 0..n-1
  }

  // Lista extendida con clones sólo si loop
  get extendedImages(): CarouselImage[] {
    const arr = this.images ?? [];
    if (this.loop && arr.length > 1) {
      const first = arr[0];
      const last = arr[arr.length - 1];
      return [last, ...arr, first];
    }
    return arr;
  }

  // Transform CSS del track
  get trackTranslate(): string {
    return `translateX(${-(100 * this.visIndex)}%)`;
  }

  // ====== Ciclo de vida ======
  ngOnInit(): void {
    this.normalizeIndicesOnImagesChange();
    this.startAutoplay();
    document.addEventListener('visibilitychange', this.onVisibility, false);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['images'] || changes['autoplayMs'] || changes['loop']) {
      this.normalizeIndicesOnImagesChange();
      this.restartAutoplayDefensive();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    document.removeEventListener('visibilitychange', this.onVisibility, false);
  }

  // ====== Helpers ======
  /** Asegura visIndex correcto al cambiar imágenes o loop */
  private normalizeIndicesOnImagesChange(): void {
    const n = this.images?.length ?? 0;
    if (this.loop && n > 1) {
      this.visIndex = 1; // primera real
    } else {
      this.visIndex = 0; // sin clones
    }
    this.enableTransition = true;
    this.isSnapping = false;
    this.cdr.markForCheck();
  }

  private forceReflow(): void {
    try {
      // Leer un layout prop fuerza el reflow del track
      void this.trackEl?.nativeElement.offsetHeight;
    } catch {}
  }

  // ====== Autoplay ======
  private onVisibility = () => {
    if (document.hidden) this.stopAutoplay();
    else this.startAutoplay();
  };

  private startAutoplay(): void {
    this.stopAutoplay();
    const n = this.images?.length ?? 0;
    if (this.autoplayMs > 0 && n > 1) {
      this.zone.runOutsideAngular(() => {
        this.timer = setInterval(() => {
          this.zone.run(() => {
            if (this.isSnapping) return; // no avanzar mientras “saltamos”
            if (!this.pauseOnHover || !this.hovering) {
              this.nextInternal();
            }
          });
        }, this.autoplayMs);
      });
    }
  }

  private stopAutoplay(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private restartAutoplayDefensive(): void {
    this.cdr.markForCheck();
    this.startAutoplay();
  }

  // ====== Navegación ======
  private prevInternal(): void {
    const n = this.images?.length ?? 0;
    if (n <= 1 || this.isSnapping) return;

    this.enableTransition = true;
    if (this.loop && n > 1) {
      this.visIndex -= 1;
    } else {
      this.visIndex = Math.max(0, this.visIndex - 1);
    }
    this.cdr.markForCheck();
  }

  private nextInternal(): void {
    const n = this.images?.length ?? 0;
    if (n <= 1 || this.isSnapping) return;

    this.enableTransition = true;
    if (this.loop && n > 1) {
      this.visIndex += 1;
    } else {
      this.visIndex = Math.min(n - 1, this.visIndex + 1);
    }
    this.cdr.markForCheck();
  }

  private goToInternal(index: number): void {
    const n = this.images?.length ?? 0;
    if (n === 0 || index < 0 || index >= n || this.isSnapping) return;

    this.enableTransition = true;
    this.visIndex = (this.loop && n > 1) ? (index + 1) : index;
    this.cdr.markForCheck();
  }

  // API pública
  prev(): void { this.prevInternal(); }
  next(): void { this.nextInternal(); }
  goTo(i: number): void { this.goToInternal(i); }

  // ====== Snap en clones ======
  onTrackTransitionEnd(ev: TransitionEvent): void {
    // Filtramos: sólo si el evento viene del track y por transform
    if (ev.propertyName !== 'transform') return;
    if (!this.trackEl || ev.target !== this.trackEl.nativeElement) return;

    const n = this.images?.length ?? 0;
    if (!(this.loop && n > 1)) return;

    // Si estamos en el clone de la primera (n+1), saltamos a la primera real (1).
    if (this.visIndex === n + 1) {
      this.snapWithoutTransition(1);
      return;
    }
    // Si estamos en el clone de la última (0), saltamos a la última real (n).
    if (this.visIndex === 0) {
      this.snapWithoutTransition(n);
      return;
    }
  }

  /** Salta a visIndex “target” sin transición y sin permitir ticks durante el salto */
  private snapWithoutTransition(targetVisIndex: number): void {
    this.isSnapping = true;           // ⛔ bloquear autoplay/navegación
    this.enableTransition = false;    // quitar transición
    this.visIndex = targetVisIndex;   // mover a la real
    this.cdr.markForCheck();
    this.forceReflow();               // 🔁 asegurar que el DOM aplica el cambio sin transición

    // Rehabilitar transición en el siguiente frame y liberar el snap
    requestAnimationFrame(() => {
      this.enableTransition = true;
      this.isSnapping = false;
      this.cdr.markForCheck();
    });
  }

  // ====== Accesibilidad (teclado) ======
  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.prevInternal(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); this.nextInternal(); }
  }

  // ====== Hover: pausa el autoplay (en escritorio) ======
  @HostListener('mouseenter') onEnter(): void { this.hovering = true; }
  @HostListener('mouseleave') onLeave(): void { this.hovering = false; }

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
    const threshold = 50;
    if (this.touchDeltaX > threshold) this.prevInternal();
    else if (this.touchDeltaX < -threshold) this.nextInternal();
    this.touchDeltaX = 0;
  }
}
