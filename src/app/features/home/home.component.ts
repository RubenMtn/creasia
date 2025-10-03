/* eslint-disable @angular-eslint/prefer-inject */
// [01] Dependencias externas y utilidades que usa el hero de la home.
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  HostListener
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { fromEvent } from 'rxjs';
import { TPipe } from '../../shared/i18n/t.pipe';
import { CarouselComponent } from "../../shared/ui/carousel/carousel.component";
import { AnimationPhase, LinkAnchor, LinkItem, FacePoint, HERO_FRAME_ASPECT, HERO_TIMING, HERO_FACE_POINTS, HERO_LINKS, HERO_SLIDES } from './home-hero.config';


// [02] Tipos derivados internos que usan la configuracion importada.
interface ScaledFacePoint extends FacePoint {
  left: number;
  top: number;
}

interface Connector {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  progress: number;
}

// [03] Declaracion del componente standalone que orquesta el hero animado.
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, TPipe, CarouselComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mediaWrap', { static: true })
  private readonly mediaWrapRef!: ElementRef<HTMLDivElement>;

  @ViewChild('vid', { static: true })
  private readonly videoRef?: ElementRef<HTMLVideoElement>;

  @ViewChildren('facePoint')
  private readonly pointRefs!: QueryList<ElementRef<HTMLSpanElement>>;

  @ViewChildren('linkEl')
  private readonly linkRefs!: QueryList<ElementRef<HTMLAnchorElement>>;

  frameAR: string = HERO_FRAME_ASPECT.cssAspectRatio;
  private frameRatio = HERO_FRAME_ASPECT.numericFrameRatio;
  private readonly imageRatio = HERO_FRAME_ASPECT.referenceImageRatio;

  private resizeObserver?: ResizeObserver;
  private pendingFrame = -1;
  private pointsTimeout: number | null = null;
  private connectorsTimeout: number | null = null;
  private trackingHandle: number | null = null;

  private connectorsReady = false;
  private pendingConnectorUpdate = false;
  private connectorProgress = 0;
  private animationDone = false;

  private readonly hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
  private readonly supportsResizeObserver = this.hasDOM && typeof window.ResizeObserver !== 'undefined';

  private phaseQueue: AnimationPhase[] = [];
  private runningPhase: AnimationPhase | null = null;

  private readonly POINTS_DELAY = HERO_TIMING.POINTS_DELAY;
  private readonly LINES_LEAD = HERO_TIMING.LINES_LEAD;
  // prueba
  //private readonly LINES_DRAW_DURATION = 540;
  private readonly LINES_DRAW_DURATION = HERO_TIMING.LINES_DRAW_DURATION;
  private readonly LINKS_DURATION = HERO_TIMING.LINKS_DURATION;
  private readonly LINKS_BUFFER = HERO_TIMING.LINKS_BUFFER;

  homeSlides = [...HERO_SLIDES];

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

  // [04] Constructor: calcula la geometria inicial, maneja rutas de retorno y registra eventos globales.
  constructor(
    private readonly zone: NgZone,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.updatePoints();

    const encodedReturn = this.route.snapshot.queryParamMap.get('returnUrl');
    if (encodedReturn) {
      const decoded = this.decodeReturnUrl(encodedReturn);
      if (decoded && decoded !== '/') {
        this.returnUrl = decoded;
      }
    }

    if (typeof window !== 'undefined') {
      fromEvent(window, 'homeSkipToEnd')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.zone.run(() => {
            this.returnUrl = null;
            this.finalizeAnimation(true);
          });
        });
    }
  }

  // [05] Hook tras el render inicial: conecta observadores y decide si saltar la animacion.
  ngAfterViewInit(): void {
    if (!this.hasDOM) {
      // ?? Defer para evitar NG0100 en el primer chequeo
      Promise.resolve().then(() => {
        this.connectorsReady = true;
        this.requestConnectorUpdate(true);
      });
      return;
    }

    this.pointRefs.changes.subscribe(() => this.requestConnectorUpdate());
    this.linkRefs.changes.subscribe(() => this.requestConnectorUpdate());

    if (this.supportsResizeObserver) {
      this.zone.runOutsideAngular(() => {
        this.resizeObserver = new ResizeObserver(() => {
          this.zone.run(() => this.requestConnectorUpdate());
        });
        this.resizeObserver.observe(this.mediaWrapRef.nativeElement);
      });
    }

    const skipAnimations = this.route.snapshot.queryParamMap.get('skip') === '1';
    if (skipAnimations) {
      // ?? Defer: el finalize + navigate cambian bindings/URL
      Promise.resolve().then(() => {
        this.finalizeAnimation(true);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { skip: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      });
    }
  }

  // [06] Limpia timeouts, RAF y observers cuando el componente se destruye.
  ngOnDestroy(): void {
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

    this.resizeObserver?.disconnect();
    this.phaseQueue = [];
    this.runningPhase = null;
    this.pendingConnectorUpdate = false;
    this.connectorsReady = false;
    this.connectorProgress = 0;
  }

  // [07] Ajusta la relacion de aspecto y recalcula puntos cuando llega metadata del video.
  onMeta(video: HTMLVideoElement): void {
    if (video.videoWidth && video.videoHeight) {
      this.frameRatio = video.videoWidth / video.videoHeight;
      this.frameAR = `${video.videoWidth} / ${video.videoHeight}`;
      this.updatePoints();
    }
  }

  // [08] Gestiona el desvanecimiento del video y prepara las fases posteriores.
  startFade(video: HTMLVideoElement): void {
    video.pause();

    if (this.animationDone) {
      return;
    }
    try {
      video.currentTime = Math.max(0, video.duration - 0.05);
    } catch {
      // ignored
    }

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

  // [09] Al terminar el fade del video dispara la cadena de fases (lineas, puntos, enlaces).
  onFadeEnd(event: TransitionEvent): void {
    const element = event.target as HTMLElement | null;
    if (!element || event.propertyName !== 'opacity') {
      return;
    }

    if (this.fading && !this.animationDone && element.classList.contains('video')) {
      this.preparePhases(['connectors', 'points']);
    }
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.shouldHandleGlobalClick(event)) {
      return;
    }

    this.finalizeAnimation(true);
  }

  @HostListener('window:keydown', ['$event'])
  onDocumentKey(event: KeyboardEvent): void {
    if (!this.shouldHandleGlobalKey(event)) {
      return;
    }

    this.finalizeAnimation(true);
  }

  private shouldHandleGlobalClick(event: MouseEvent): boolean {
    if (!this.hasDOM || this.animationDone) {
      return false;
    }

    const element = event.target instanceof Element ? event.target : null;
    if (!element) {
      return true;
    }

    return !this.isInteractiveTarget(element);
  }

  private shouldHandleGlobalKey(event: KeyboardEvent): boolean {
    if (!this.hasDOM || this.animationDone) {
      return false;
    }

    const element = event.target instanceof Element ? event.target : null;
    if (this.isInteractiveTarget(element)) {
      return false;
    }

    return true;
  }

  private isInteractiveTarget(element: Element | null): boolean {
  if (!element) return false;

  // Considera interactivo TODO lo que ocurra dentro del carrusel:
  if (element.closest('app-carousel, .carousel, .img-slide, .slide-link-overlay, [role="button"]')) {
    return true;
  }

  // El resto: elementos naturalmente interactivos
  return !!element.closest('a, button, input, textarea, select, [contenteditable], [role="link"]');
}

  
  // [11] Administra la cola de fases (conectores/puntos) y asegura su ejecucion ordenada.
  private preparePhases(order: AnimationPhase[]): void {
    this.phaseQueue = [...order];
    this.runningPhase = null;
    this.advancePhase();
  }

  private advancePhase(): void {
    if (this.runningPhase !== null) {
      return;
    }

    const next = this.phaseQueue.shift();
    if (!next) {
      return;
    }

    this.runningPhase = next;

    if (next === 'points') {
      this.runPointsPhase();
    } else {
      this.runConnectorsPhase();
    }
  }

  private finishPhase(expected: AnimationPhase): void {
    if (this.runningPhase !== expected) {
      return;
    }

    this.runningPhase = null;
    this.advancePhase();

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

    this.pointsTimeout = this.scheduleTimeout(this.pointsTimeout, () => {
      this.finishPhase('points');
    }, this.POINTS_DELAY);
  }

  // [12] Desordena enlaces, mide distancias y lanza el dibujo gradual de las lineas.
  private runConnectorsPhase(): void {
    this.displayLinks = [...this.links].sort(() => Math.random() - 0.5);
    this.showLinks = true;
    this.showPoints = false;
    this.showConnectors = false;
    this.connectorProgress = 0;
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

  // [13] Consolida el estado final: muestra overlays, fija conectores y lanza navegacion diferida.
  private finalizeAnimation(force = false): void {
    if (this.animationDone && !force) {
      return;
    }

    if (force && this.hasDOM) {
      const video = this.videoRef?.nativeElement;
      if (video) {
        try {
          video.pause();
          if (!Number.isNaN(video.duration) && Number.isFinite(video.duration)) {
            video.currentTime = video.duration;
          }
        } catch {
          // ignored
        }
      }
    }

    if (force) {
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

      this.phaseQueue = [];
      this.runningPhase = null;
      this.skipToEnd = true;

      if (!this.displayLinks.length) {
        this.displayLinks = [...this.links].sort(() => Math.random() - 0.5);
      }

      this.showLinks = true;
      this.showPoints = true;
      this.linksPhaseOffset = 0;
    }

    this.animationDone = true;
    this.fading = true;
    this.showImage = true;
    this.showLinks = true;
    this.showPoints = true;
    this.showConnectors = true;
    this.connectorProgress = 1;
    this.connectorsReady = true;
    this.pendingConnectorUpdate = false;

    if (this.hasDOM) {
      this.requestConnectorUpdate(true);
    } else {
      this.updateConnectors();
    }

    this.handleReturnNavigation();
  }

  // [14] Navega a la ruta de retorno almacenada en cuanto la animacion ha finalizado.
  private handleReturnNavigation(): void {
    if (!this.returnUrl || this.returnNavigationTriggered || !this.hasDOM) {
      return;
    }

    this.returnNavigationTriggered = true;
    const target = this.returnUrl;
    this.returnUrl = null;

    this.zone.run(() => {
      void this.router.navigateByUrl(target, { replaceUrl: true });
    });
  }

  private decodeReturnUrl(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  // [15] Normaliza las coordenadas de los puntos faciales segun el tamano del contenedor.
  private updatePoints(): void {
    const ratio = this.frameRatio / this.imageRatio;
    this.scaledPoints = this.facePoints.map((point) => {
      let left = point.x;
      let top = point.y;

      if (ratio < 1) {
        const offset = (1 - ratio) * 50;
        top = offset + point.y * ratio;
      } else if (ratio > 1) {
        const invRatio = 1 / ratio;
        const offset = (1 - invRatio) * 50;
        left = offset + point.x * invRatio;
      }

      return { ...point, left, top };
    });

    this.requestConnectorUpdate();
  }

  // [16] Programa un recalculo de conectores evitando hacer trabajo cuando no hay DOM o esta en cola.
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

  // [17] Coordina el recalculo con requestAnimationFrame para alinear el trazo con el repintado.
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

  // [18] Calcula la geometria de cada linea conectando puntos faciales con enlaces.
  private updateConnectors(): void {
    if (!this.showLinks) {
      this.connectors = [];
      return;
    }

    const wrapEl = this.mediaWrapRef?.nativeElement;
    if (!wrapEl) {
      return;
    }

    const wrapRect = wrapEl.getBoundingClientRect();
    if (!wrapRect.width || !wrapRect.height) {
      return;
    }

    const points = new Map<string, { x: number; y: number }>();
    const pointRefs = this.pointRefs;
    if (pointRefs && pointRefs.length) {
      pointRefs.forEach((ref) => {
        const el = ref.nativeElement;
        const id = el.dataset['point'];
        if (!id) {
          return;
        }
        const rect = el.getBoundingClientRect();
        const x = ((rect.left + rect.right) / 2 - wrapRect.left) / wrapRect.width * 100;
        const y = ((rect.top + rect.bottom) / 2 - wrapRect.top) / wrapRect.height * 100;
        points.set(id, { x, y });
      });
    } else {
      this.scaledPoints.forEach(({ id, left, top }) => {
        points.set(id, { x: left, y: top });
      });
    }

    const connectors: Connector[] = [];
    this.linkRefs.forEach((ref) => {
      const el = ref.nativeElement;
      const id = el.getAttribute('data-point');
      if (!id) {
        return;
      }
      const target = points.get(id);
      if (!target) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const anchor = (el.getAttribute('data-anchor') as LinkAnchor | null) ?? null;
      const centerX = ((rect.left + rect.right) / 2 - wrapRect.left) / wrapRect.width * 100;
      const centerY = ((rect.top + rect.bottom) / 2 - wrapRect.top) / wrapRect.height * 100;
      let x1 = centerX;
      let y1 = centerY;

      switch (anchor) {
        case 'top':
          y1 = (rect.top - wrapRect.top) / wrapRect.height * 100;
          break;
        case 'bottom':
          y1 = (rect.bottom - wrapRect.top) / wrapRect.height * 100;
          break;
        case 'left':
          x1 = (rect.left - wrapRect.left) / wrapRect.width * 100;
          break;
        case 'right':
          x1 = (rect.right - wrapRect.left) / wrapRect.width * 100;
          break;
      }

      const { x: x2, y: y2 } = target;
      const length = Math.hypot(x2 - x1, y2 - y1);
      connectors.push({ id, x1, y1, x2, y2, length, progress: 0 });
    });

    const progress = this.showConnectors ? this.connectorProgress : 0;
    this.connectors = connectors.map(conn => ({ ...conn, progress }));
  }

  // [19] Wrapper sobre setTimeout para reutilizar manejadores y actuar igual en SSR.
  private scheduleTimeout(handle: number | null, callback: () => void, delay: number): number | null {
    if (!this.hasDOM) {
      callback();
      return null;
    }

    if (handle !== null) {
      window.clearTimeout(handle);
    }

    return window.setTimeout(callback, delay);
  }

  // [20] Complemento que cancela timeouts y devuelve null para reasignar el manejador.
  private clearTimeout(handle: number | null): number | null {
    if (handle !== null && this.hasDOM) {
      window.clearTimeout(handle);
    }
    return null;
  }
}
