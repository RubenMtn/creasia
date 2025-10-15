/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-empty */
/* eslint-disable @angular-eslint/prefer-inject */

/**
 * HomeComponent – Hero animado con vídeo + fases (conectores, puntos, enlaces)
 * ----------------------------------------------------------------------------
 * Cambios relevantes:
 *  1) Arranque del vídeo una sola vez con 'canplaythrough' (evita "saltitos")
 *  2) Permite saltar animaciones con '?skip=1' o '?homeState=static'
 *  3) Limpieza y comentarios; sin romper API usada por la plantilla
 */

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  HostListener,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { fromEvent } from 'rxjs';

import { TPipe } from '../../shared/i18n/t.pipe';
import { CarouselComponent } from '../../shared/ui/carousel/carousel.component';

import {
  AnimationPhase,
  LinkAnchor,
  LinkItem,
  FacePoint,
  HERO_FRAME_ASPECT,
  HERO_TIMING,
  HERO_FACE_POINTS,
  HERO_LINKS,
  HERO_SLIDES,
} from './home-hero.config';

/* ----------------------------- Tipos internos ----------------------------- */
interface ScaledFacePoint extends FacePoint {
  left: number;
  top: number;
}

interface Connector {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  length: number;
  progress: number;
  points?: string;   // 👈 polígono afilado
}

/* -------------------------------- Componente ------------------------------ */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, TPipe, CarouselComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  /* --------------------------- Referencias de vista --------------------------- */
  @ViewChild('mediaWrap', { static: true }) private readonly mediaWrapRef!: ElementRef<HTMLElement>;
  // ⬇️ Cambio: static:false para no resolver la ref antes de que exista en DOM
  @ViewChild('vid', { static: false }) private readonly videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChildren('facePoint') private readonly pointRefs!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('linkEl') private readonly linkRefs!: QueryList<ElementRef<HTMLElement>>;

  /* ------------------------------ Estado base UI ----------------------------- */
  frameAR: string = HERO_FRAME_ASPECT.cssAspectRatio;
  private frameRatio = HERO_FRAME_ASPECT.numericFrameRatio;
  private readonly imageRatio = HERO_FRAME_ASPECT.referenceImageRatio;

  /* ---------------------------- Infraestructura DOM --------------------------- */
  private resizeObserver?: ResizeObserver;
  private pendingFrame = -1;
  private pointsTimeout: number | null = null;
  private connectorsTimeout: number | null = null;
  private trackingHandle: number | null = null;

  /* ------------------------------- Fases/flags -------------------------------- */
  private connectorsReady = false;
  private pendingConnectorUpdate = false;
  private connectorProgress = 0;
  animationDone = false;

  // Grosor en unidades del viewBox (0..100). Más ancho en el botón → más fino hacia la cara.
  private readonly LINE_W_START = 5;  // ancho cerca del botón
  private readonly LINE_W_END = 0.9;  // ancho cerca de la cara

  // Disponibilidad DOM (SSR-safe)
  private readonly hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
  private readonly supportsResizeObserver = this.hasDOM && typeof (window as any).ResizeObserver !== 'undefined';
  // ⬇️ Nuevo: flag público por si quieres condicionar en el HTML que el <video> sólo exista en cliente
  public readonly isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  private phaseQueue: AnimationPhase[] = [];
  private runningPhase: AnimationPhase | null = null;

  /* ------------------------------- Timings (cfg) ------------------------------ */
  private readonly POINTS_DELAY = HERO_TIMING.POINTS_DELAY;
  private readonly LINES_LEAD = HERO_TIMING.LINES_LEAD;
  private readonly LINES_DRAW_DURATION = HERO_TIMING.LINES_DRAW_DURATION;
  private readonly LINKS_DURATION = HERO_TIMING.LINKS_DURATION;
  private readonly LINKS_BUFFER = HERO_TIMING.LINKS_BUFFER;

  /* -------------------------------- Contenido -------------------------------- */
  homeSlides = [...HERO_SLIDES];

  /* ----------------------------- Flags visuales ------------------------------ */
  fading = false;
  skipToEnd = false;
  showImage = false;
  showPoints = false;
  showLinks = false;
  showConnectors = false;

  displayLinks: LinkItem[] = [];
  baseDelay = HERO_TIMING.BASE_DELAY;
  stagger = HERO_TIMING.STAGGER;
  linksPhaseOffset = 0;

  readonly facePoints: FacePoint[] = HERO_FACE_POINTS;
  scaledPoints: ScaledFacePoint[] = [];
  connectors: Connector[] = [];

  private readonly destroyRef = inject(DestroyRef);
  private returnUrl: string | null = null;
  private returnNavigationTriggered = false;
  private readonly links: LinkItem[] = HERO_LINKS;

  /* ----------- NUEVO: control de arranque del vídeo para evitar saltos ------- */
  private videoStarted = false;

  /* -------------------------------- Constructor ------------------------------ */
  constructor(
    private readonly zone: NgZone,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    // Geometría inicial
    this.updatePoints();

    // returnUrl opcional (para volver a la página previa tras la intro)
    const encodedReturn = this.route.snapshot.queryParamMap.get('returnUrl');
    if (encodedReturn) {
      const decoded = this.decodeReturnUrl(encodedReturn);
      if (decoded && decoded !== '/') {
        this.returnUrl = decoded;
      }
    }

    // Evento global opcional para saltar al final (por ejemplo, desde header)
    if (this.hasDOM) {
      fromEvent<CustomEvent>(window, 'homeSkipToEnd')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.zone.run(() => {
            this.returnUrl = null;
            this.finalizeAnimation(true);
          });
        });
    }
  }

  /* --------------------------- Ciclo de vida / init --------------------------- */
  ngAfterViewInit(): void {
    // SSR: no hay DOM → dejar la vista en estado "final" razonable y salir.
    if (!this.hasDOM) {
      Promise.resolve().then(() => {
        this.connectorsReady = true;
        this.requestConnectorUpdate(true);
      });
      return;
    }

    // Quitar 'autoplay' si estuviera en el HTML para evitar dobles arranques (defensivo)
    try { this.videoRef?.nativeElement.removeAttribute('autoplay'); } catch { }

    // Recalcular conectores cuando cambia la lista de puntos/enlaces
    this.pointRefs.changes.subscribe(() => this.requestConnectorUpdate());
    this.linkRefs.changes.subscribe(() => this.requestConnectorUpdate());

    // Observador de tamaño para recalcular geometría del área media
    if (this.supportsResizeObserver) {
      this.zone.runOutsideAngular(() => {
        this.resizeObserver = new ResizeObserver(() => {
          this.zone.run(() => this.requestConnectorUpdate());
        });
        this.resizeObserver.observe(this.mediaWrapRef.nativeElement);
      });
    }

    /* ------------------------------------------------------------------------
     * A) Lógica inicial: saltar si ya se vio o si llegan flags por URL.
     *    - skip=1       → saltar animación
     *    - homeState=static → saltar animación (nuevo soporte)
     *    - intro=1      → forzar intro aunque ya se hubiese visto
     * ---------------------------------------------------------------------- */
    const params = this.route.snapshot.queryParamMap;
    // A) Lógica inicial: saltar si ya se vio o si viene ?skip=1 / ?homeState=static / pestaña oculta
    const skipAnimations =
      params.get('skip') === '1' ||
      params.get('homeState') === 'static' ||
      (document.visibilityState === 'hidden');

    let introSeen = false;
    try { introSeen = sessionStorage.getItem('creasia:introPlayed') === '1'; } catch { }

    let forceIntro = false;
    try { forceIntro = sessionStorage.getItem('creasia:forceIntro') === '1'; } catch { }

    const introForced = params.get('intro') === '1';

    if (forceIntro) {
      try { sessionStorage.removeItem('creasia:forceIntro'); } catch { }
    }

    if (skipAnimations || (introSeen && !introForced && !forceIntro)) {
      // ⬇️ Cambio: sólo aplicamos estado final; NO navegamos ni tocamos la URL aquí
      Promise.resolve().then(() => {
        this.finalizeAnimation(true);
      });
    } else {
      // No se salta: preparar arranque del vídeo SIN dobles inicios
      const video = this.videoRef?.nativeElement;
      if (video) this.setupVideoStart(video);
    }

    /* ------------------------------------------------------------------------
     * B) Si llega intro=1 mientras estamos en Home, reinicia la intro.
     * ---------------------------------------------------------------------- */
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((map) => {
        const wantIntro = map.get('intro') === '1';
        if (!wantIntro) return;

        // Quitar marca de "vista" y reiniciar con vídeo
        try { sessionStorage.removeItem('creasia:introPlayed'); } catch { }
        this.restartIntro();

        // Limpia ?intro de la URL (esto es posterior, no en el primer render)
        Promise.resolve().then(() => {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { intro: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        });
      });
  }

  /* ------------------------------ Ciclo de vida ------------------------------ */
  ngOnDestroy(): void {
    // Cancelar RAF/timeout pendientes
    if (this.pendingFrame !== -1 && this.hasDOM) {
      window.cancelAnimationFrame(this.pendingFrame);
    }
    this.pendingFrame = -1;

    this.pointsTimeout = this.clearTimeout(this.pointsTimeout);
    this.connectorsTimeout = this.clearTimeout(this.connectorsTimeout);

    if (this.trackingHandle !== null && this.hasDOM) {
      window.cancelAnimationFrame(this.trackingHandle);
    }
    this.trackingHandle = null;

    // Desconectar observer y limpiar fases
    this.resizeObserver?.disconnect();
    this.phaseQueue = [];
    this.runningPhase = null;

    this.pendingConnectorUpdate = false;
    this.connectorsReady = false;
    this.connectorProgress = 0;
  }

  /* ---------------------- Reinicio limpio de la intro (UI) -------------------- */
  private restartIntro(): void {
    // 1) Cancelar animaciones/RAF/timeout
    if (this.pendingFrame !== -1 && this.hasDOM) {
      window.cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = -1;
    }
    this.pointsTimeout = this.clearTimeout(this.pointsTimeout);
    this.connectorsTimeout = this.clearTimeout(this.connectorsTimeout);
    if (this.trackingHandle !== null && this.hasDOM) {
      window.cancelAnimationFrame(this.trackingHandle);
      this.trackingHandle = null;
    }

    // 2) Reset visual
    this.phaseQueue = [];
    this.runningPhase = null;
    this.fading = false;
    this.animationDone = false;
    this.skipToEnd = false;
    this.showImage = false;
    this.showLinks = false;
    this.showPoints = false;
    this.showConnectors = false;
    this.connectors = [];
    this.linksPhaseOffset = 0;
    this.connectorProgress = 0;
    this.connectorsReady = false;
    this.pendingConnectorUpdate = false;

    // 3) Rehidratar geometría
    this.updatePoints();

    // 4) Preparar reproducción del vídeo (sin doble arranque)
    const video = this.videoRef?.nativeElement;
    if (video) {
      try {
        video.pause();
        video.currentTime = 0;
        video.style.removeProperty('display'); // vuelve a mostrar el <video> para la nueva intro
        this.videoStarted = false; // ← importante para reinicio limpio
        this.setupVideoStart(video);
      } catch { }
    }
  }

  /* ---------------------- Vídeo: metadata → ajustar relación ------------------ */
  onMeta(video: HTMLVideoElement): void {
    if (video.videoWidth && video.videoHeight) {
      this.frameRatio = video.videoWidth / video.videoHeight;
      this.frameAR = `${video.videoWidth} / ${video.videoHeight}`;
      this.updatePoints();
    }
  }

  /* --------------------------- Vídeo: iniciar fade ---------------------------- */
  startFade(video: HTMLVideoElement): void {
    video.pause();
    if (this.animationDone) return;

    try {
      // Lleva el vídeo casi al final para un fundido limpio
      video.currentTime = Math.max(0, video.duration - 0.05);
    } catch { /* ignore */ }

    // Reset de fases visibles (prepara la cadena posterior)
    this.showImage = true;
    this.showPoints = false;
    this.showLinks = false;
    this.showConnectors = false;
    this.connectors = [];

    this.linksPhaseOffset = 0;
    this.connectorsReady = false;
    this.pendingConnectorUpdate = false;

    this.pointsTimeout = this.clearTimeout(this.pointsTimeout);
    this.connectorsTimeout = this.clearTimeout(this.connectorsTimeout);

    if (this.trackingHandle !== null && this.hasDOM) {
      window.cancelAnimationFrame(this.trackingHandle);
      this.trackingHandle = null;
    }

    this.phaseQueue = [];
    this.runningPhase = null;

    this.fading = true;
    this.animationDone = false;
    this.skipToEnd = false;
  }

  /* ---------------------- Vídeo: fin de fade → disparar fases ----------------- */
  onFadeEnd(event: TransitionEvent): void {
    const element = event.target as HTMLElement | null;
    if (!element || event.propertyName !== 'opacity') return;

    // Si el fade ha afectado al bloque del vídeo, iniciar cadena: conectores → puntos
    if (this.fading && !this.animationDone && element.classList.contains('video')) {
      const v = this.videoRef?.nativeElement;
      if (v) { v.style.display = 'none'; } // ocultar físicamente el <video>
      this.preparePhases(['connectors', 'points']);
    }

  }

  /* ------------------- Interacciones globales: saltar a final ----------------- */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.shouldHandleGlobalClick(event)) return;
    this.finalizeAnimation(true);
  }

  @HostListener('window:keydown', ['$event'])
  onDocumentKey(event: KeyboardEvent): void {
    if (!this.shouldHandleGlobalKey(event)) return;
    this.finalizeAnimation(true);
  }

  private shouldHandleGlobalClick(event: MouseEvent): boolean {
    if (!this.hasDOM || this.animationDone) return false;
    const element = event.target instanceof Element ? event.target : null;
    if (!element) return true;
    return !this.isInteractiveTarget(element);
  }

  private shouldHandleGlobalKey(event: KeyboardEvent): boolean {
    if (!this.hasDOM || this.animationDone) return false;
    const element = event.target instanceof Element ? event.target : null;
    if (this.isInteractiveTarget(element)) return false;
    return true;
  }

  private isInteractiveTarget(element: Element | null): boolean {
    if (!element) return false;
    if (element.closest('app-carousel, .carousel, .img-slide, .slide-link-overlay, [role="button"]')) {
      return true;
    }
    return !!element.closest('a, button, input, textarea, select, [contenteditable], [role="link"]');
  }

  /* ------------------------------- Cola de fases ------------------------------ */
  private preparePhases(order: AnimationPhase[]): void {
    this.phaseQueue = [...order];
    this.runningPhase = null;
    this.advancePhase();
  }

  private advancePhase(): void {
    if (this.runningPhase !== null) return;
    const next = this.phaseQueue.shift();
    if (!next) return;
    this.runningPhase = next;
    if (next === 'points') this.runPointsPhase();
    else this.runConnectorsPhase();
  }

  private finishPhase(expected: AnimationPhase): void {
    if (this.runningPhase !== expected) return;
    this.runningPhase = null;
    this.advancePhase();

    // Si ya no quedan fases, pasar a estado final
    if (this.runningPhase === null && this.phaseQueue.length === 0) {
      this.finalizeAnimation();
    }
  }

  private runPointsPhase(): void {
    this.showPoints = true;

    if (!this.hasDOM) {
      this.finishPhase('points');
      return;
    }

    this.pointsTimeout = this.scheduleTimeout(
      this.pointsTimeout,
      () => this.finishPhase('points'),
      this.POINTS_DELAY,
    );
  }

  /* --------------------------- Conectores / enlaces -------------------------- */
  private runConnectorsPhase(): void {
    // Mezclar enlaces para variar el orden
    this.displayLinks = [...this.links].sort(() => Math.random() - 0.5);

    this.showLinks = true;
    this.showPoints = false;
    this.showConnectors = false;
    this.connectorProgress = 0;

    // Los conectores arrancan tras un leve "lead" frente a los enlaces
    this.linksPhaseOffset = this.LINES_LEAD;
    this.connectorsReady = true;
    this.requestConnectorUpdate(true);

    if (!this.hasDOM) {
      this.showConnectors = true;
      this.finishPhase('connectors');
      return;
    }

    const duration = this.computeLinksAnimationDuration();
    this.startConnectorTracking(duration);
  }

  private computeLinksAnimationDuration(): number {
    const count = this.displayLinks.length;
    const lastDelay = count > 0 ? this.baseDelay + this.stagger * (count - 1) : 0;
    return this.LINKS_DURATION + lastDelay + this.LINKS_BUFFER + this.LINES_DRAW_DURATION;
  }

  private startConnectorTracking(duration: number): void {
    if (!this.hasDOM) {
      this.showConnectors = true;
      this.finishPhase('connectors');
      return;
    }

    if (this.trackingHandle !== null) {
      window.cancelAnimationFrame(this.trackingHandle);
    }

    const start = performance.now();
    const half = duration / 2;

    const step = () => {
      const elapsed = performance.now() - start;

      if (duration <= 0) {
        this.connectorProgress = 1;
      } else if (elapsed <= half) {
        this.connectorProgress = 0;
      } else {
        const span = duration - half || 1;
        this.connectorProgress = Math.min(1, (elapsed - half) / span);
      }

      if (!this.showConnectors && elapsed >= half) {
        this.showConnectors = true;
      }

      this.updateConnectors();

      if (elapsed < duration) {
        this.trackingHandle = window.requestAnimationFrame(step);
        return;
      }

      this.trackingHandle = null;
      this.showConnectors = true;
      this.updateConnectors();
      this.finishPhase('connectors');
    };

    this.trackingHandle = window.requestAnimationFrame(step);
  }

  /* ------------------------------ Estado final ------------------------------- */
  private finalizeAnimation(force = false): void {
    if (this.animationDone && !force) return;

    // En force=true, asegurar que el vídeo queda pausado y posicionado al final.
    if (force && this.hasDOM) {
      const video = this.videoRef?.nativeElement;
      if (video) {
        try {
          video.pause();
          const v2 = this.videoRef?.nativeElement;
          if (v2) { v2.style.display = 'none'; } // oculta el vídeo en salto directo

          if (!Number.isNaN(video.duration) && Number.isFinite(video.duration)) {
            video.currentTime = video.duration;
          }
        } catch { /* ignore */ }
      }
    }

    if (force) {
      // Cancelar animaciones/RAF/timeout en curso
      this.pointsTimeout = this.clearTimeout(this.pointsTimeout);
      this.connectorsTimeout = this.clearTimeout(this.connectorsTimeout);

      if (this.trackingHandle !== null && this.hasDOM) {
        window.cancelAnimationFrame(this.trackingHandle);
        this.trackingHandle = null;
      }
      if (this.pendingFrame !== -1 && this.hasDOM) {
        window.cancelAnimationFrame(this.pendingFrame);
        this.pendingFrame = -1;
      }

      // Configurar estado "todo visible"
      this.phaseQueue = [];
      this.runningPhase = null;
      this.skipToEnd = true;

      if (!this.displayLinks.length) {
        this.displayLinks = [...this.links].sort(() => Math.random() - 0.5);
      }

      this.showImage = true;
      this.showLinks = true;
      this.showPoints = true;
      this.showConnectors = true;
      this.linksPhaseOffset = 0;

      this.fading = false; // ← clave: no activar fade en final forzado
    } else {
      // Flujo normal (con fade)
      this.fading = true;
      this.showImage = true;
      this.showLinks = true;
      this.showPoints = true;
      this.showConnectors = true;
    }

    // Estado final común
    this.animationDone = true;
    this.connectorProgress = 1;
    this.connectorsReady = true;
    this.pendingConnectorUpdate = false;

    if (this.hasDOM) {
      this.requestConnectorUpdate(true);
    } else {
      this.updateConnectors();
    }

    // Marcar intro como vista (en esta pestaña)
    try { sessionStorage.setItem('creasia:introPlayed', '1'); } catch { }

    // Si había returnUrl, navegar ahora
    this.handleReturnNavigation();
  }

  /* -------------------- Navegación de retorno (returnUrl) -------------------- */
  private handleReturnNavigation(): void {
    if (!this.returnUrl || this.returnNavigationTriggered || !this.hasDOM) return;

    this.returnNavigationTriggered = true;
    const target = this.returnUrl;
    this.returnUrl = null;

    this.zone.run(() => {
      void this.router.navigateByUrl(target, { replaceUrl: true });
    });
  }

  private decodeReturnUrl(value: string): string {
    try { return decodeURIComponent(value); }
    catch { return value; }
  }

  /* -------------------- Reescalado de puntos faciales (AR) ------------------- */
  private updatePoints(): void {
    const ratio = this.frameRatio / this.imageRatio;

    this.scaledPoints = this.facePoints.map((point) => {
      let left = point.x;
      let top = point.y;

      if (ratio < 1) {
        // Marco más alto que la imagen → ajustar vertical
        const offset = (1 - ratio) * 50;
        top = offset + point.y * ratio;
      } else if (ratio > 1) {
        // Marco más ancho que la imagen → ajustar horizontal
        const invRatio = 1 / ratio;
        const offset = (1 - invRatio) * 50;
        left = offset + point.x * invRatio;
      }

      return { ...point, left, top };
    });

    this.requestConnectorUpdate();
  }

  /* --------------------------- Recalcular conectores ------------------------- */
  private requestConnectorUpdate(force = false): void {
    if (!this.showLinks) {
      this.pendingConnectorUpdate = true;
      return;
    }

    if (!this.hasDOM) {
      this.updateConnectors();
      return;
    }

    if (!this.connectorsReady && !force) {
      this.pendingConnectorUpdate = true;
      return;
    }

    this.pendingConnectorUpdate = false;
    this.scheduleUpdateConnectors();
  }

  /* ---------------------- Coordinar recálculo con RAF ------------------------ */
  private scheduleUpdateConnectors(): void {
    if (!this.hasDOM) {
      this.updateConnectors();
      return;
    }

    if (this.pendingFrame !== -1) {
      window.cancelAnimationFrame(this.pendingFrame);
    }

    this.pendingFrame = window.requestAnimationFrame(() => {
      this.pendingFrame = -1;
      this.updateConnectors();
    });
  }

  /* --------------- Geometría/posicionamiento de las líneas (UI) -------------- */
private updateConnectors(): void {
  if (!this.showLinks) { this.connectors = []; return; }

  const wrapEl = this.mediaWrapRef?.nativeElement;
  if (!wrapEl) return;

  const wrapRect = wrapEl.getBoundingClientRect();
  if (!wrapRect.width || !wrapRect.height) return;

  // 1) Mapear puntos
  const points = new Map<string, { x: number; y: number }>();

  const pointRefs = this.pointRefs;
  if (pointRefs && pointRefs.length) {
    pointRefs.forEach((ref) => {
      const el = ref.nativeElement;
      const id = el.dataset['point'];
      if (!id) return;

      const rect = el.getBoundingClientRect();
      const x = (((rect.left + rect.right) / 2) - wrapRect.left) / wrapRect.width * 100;
      const y = (((rect.top + rect.bottom) / 2) - wrapRect.top) / wrapRect.height * 100;
      points.set(id, { x, y });
    });
  } else {
    this.scaledPoints.forEach(({ id, left, top }) => {
      points.set(id, { x: left, y: top });
    });
  }

  // 2) Construir conectores
  const connectors: Connector[] = [];
  this.linkRefs.forEach((ref) => {
    const el = ref.nativeElement;
    const id = el.getAttribute('data-point');
    if (!id) return;

    const target = points.get(id);
    if (!target) return;

    const rect = el.getBoundingClientRect();
    const anchor = (el.getAttribute('data-anchor') as LinkAnchor | null) ?? null;

    const centerX = (((rect.left + rect.right) / 2) - wrapRect.left) / wrapRect.width * 100;
    const centerY = (((rect.top + rect.bottom) / 2) - wrapRect.top) / wrapRect.height * 100;

    let x1 = centerX, y1 = centerY;
    switch (anchor) {
      case 'top':    y1 = (rect.top    - wrapRect.top)  / wrapRect.height * 100; break;
      case 'bottom': y1 = (rect.bottom - wrapRect.top)  / wrapRect.height * 100; break;
      case 'left':   x1 = (rect.left   - wrapRect.left) / wrapRect.width  * 100; break;
      case 'right':  x1 = (rect.right  - wrapRect.left) / wrapRect.width  * 100; break;
    }

    const { x: x2, y: y2 } = target;
    const length = Math.hypot(x2 - x1, y2 - y1);

    connectors.push({ id, x1, y1, x2, y2, length, progress: 0 });
  });

  // 3) Aplicar progreso y construir polígono afilado
  const progress = this.showConnectors ? this.connectorProgress : 0;

  this.connectors = connectors.map(c => {
    const dx = c.x2 - c.x1;
    const dy = c.y2 - c.y1;
    const len = Math.hypot(dx, dy) || 1;

    // unitario y normal
    const ux = dx / len,  uy = dy / len;
    const nx = -uy,       ny = ux;

    // extremo actual (crece con progress)
    const px = c.x1 + dx * progress;
    const py = c.y1 + dy * progress;

    // grosor: más ancho en el botón → más fino hacia la cara
    const w1 = this.LINE_W_START;
    const w2 = this.LINE_W_END;
    const wAtEnd = w1 + (w2 - w1) * progress;

    const h1 = w1 / 2;
    const h2 = wAtEnd / 2;

    // 4 puntos del polígono (orden horario)
    const aX = c.x1 + nx * h1, aY = c.y1 + ny * h1;
    const bX =  px  + nx * h2, bY =  py  + ny * h2;
    const dX = c.x1 - nx * h1, dY = c.y1 - ny * h1;
    const eX =  px  - nx * h2, eY =  py  - ny * h2;

    const pts = `${aX},${aY} ${bX},${bY} ${eX},${eY} ${dX},${dY}`;
    return { ...c, progress, points: pts };
  });
}


  /* ----------------------------- Utilidades tiempo --------------------------- */
  private scheduleTimeout(handle: number | null, callback: () => void, delay: number): number | null {
    if (!this.hasDOM) { callback(); return null; }
    if (handle !== null) { window.clearTimeout(handle); }
    return window.setTimeout(callback, delay);
  }

  private clearTimeout(handle: number | null): number | null {
    if (handle !== null && this.hasDOM) {
      window.clearTimeout(handle);
    }
    return null;
  }

  /* --------------------------- NUEVO: vídeo sin saltos ------------------------ */
  /**
   * Prepara un arranque de vídeo estable:
   * - Garantiza muted + playsinline para autoplay móvil
   * - Arranca SOLO una vez, al alcanzar 'canplaythrough'
   * - Si ya está listo (readyState >= 4), reproduce inmediatamente
   */
  private setupVideoStart(video: HTMLVideoElement): void {
    try { video.muted = true; } catch { }
    try { video.setAttribute('playsinline', 'true'); } catch { }
    try { (video as any).webkitPlaysInline = true; } catch { }

    const playOnce = () => {
      if (this.videoStarted) return;
      this.videoStarted = true;
      try { void video.play(); } catch { }
    };

    // Si ya hay datos suficientes, reproducir ya; si no, esperar al evento.
    if (video.readyState >= 4 /* HAVE_ENOUGH_DATA */) {
      playOnce();
    } else {
      video.addEventListener('canplaythrough', playOnce, { once: true });
    }
  }
}
