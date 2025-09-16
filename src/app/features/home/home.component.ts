import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../shared/i18n/t.pipe';

type LinkAnchor = 'top' | 'right' | 'bottom' | 'left';
type AnimationPhase = 'points' | 'connectors';

interface LinkItem {
  key: string;
  route: string;
  cls: string;
  pointId: FacePoint['id'];
  anchor: LinkAnchor;
}

interface FacePoint {
  id: string;
  x: number;
  y: number;
}

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

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, TPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mediaWrap', { static: true })
  private readonly mediaWrapRef!: ElementRef<HTMLDivElement>;

  @ViewChildren('facePoint')
  private readonly pointRefs!: QueryList<ElementRef<HTMLSpanElement>>;

  @ViewChildren('linkEl')
  private readonly linkRefs!: QueryList<ElementRef<HTMLAnchorElement>>;

  frameAR = '16 / 9';
  private frameRatio = 16 / 9;
  private readonly imageRatio = 1600 / 593;

  private resizeObserver?: ResizeObserver;
  private pendingFrame = -1;
  private pointsTimeout: number | null = null;
  private connectorsTimeout: number | null = null;
  private trackingHandle: number | null = null;

  private connectorsReady = false;
  private pendingConnectorUpdate = false;
  private connectorProgress = 0;
  
  private readonly hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
  private readonly supportsResizeObserver = this.hasDOM && typeof window.ResizeObserver !== 'undefined';

  private phaseQueue: AnimationPhase[] = [];
  private runningPhase: AnimationPhase | null = null;

  private readonly POINTS_DELAY = 120;
  private readonly LINES_LEAD = 180;
  // prueba
  //private readonly LINES_DRAW_DURATION = 540;
  private readonly LINES_DRAW_DURATION = 140;
  private readonly LINKS_DURATION = 900;
  private readonly LINKS_BUFFER = 160;

  fading = false;
  showImage = false;
  showPoints = false;
  showLinks = false;
  showConnectors = false;
  
  displayLinks: LinkItem[] = [];
  baseDelay = 200;
  stagger = 180;
  linksPhaseOffset = 0;

  readonly facePoints: FacePoint[] = [
    { id: 'eye-left', x: 34.5, y: 31.2 },
    { id: 'eye-right', x: 67, y: 31.2 },
    { id: 'nose-left', x: 40.3, y: 53.1 },
    { id: 'nose-right', x: 59.2, y: 58 },
    { id: 'mouth-left', x: 42, y: 85 },
    { id: 'mouth-right', x: 56.4, y: 90 }
  ];

  scaledPoints: ScaledFacePoint[] = [];
  connectors: Connector[] = [];

  private readonly links: LinkItem[] = [
    { key: 'links.section1', route: '/seccion-1', cls: 'l-top-left', pointId: 'eye-left', anchor: 'bottom' },
    { key: 'links.section2', route: '/seccion-2', cls: 'l-mid-left', pointId: 'nose-left', anchor: 'right' },
    { key: 'links.section3', route: '/seccion-3', cls: 'l-bot-left', pointId: 'mouth-left', anchor: 'top' },
    { key: 'links.section4', route: '/seccion-4', cls: 'l-top-right', pointId: 'eye-right', anchor: 'bottom' },
    { key: 'links.section5', route: '/seccion-5', cls: 'l-mid-right', pointId: 'nose-right', anchor: 'left' },
    { key: 'links.section6', route: '/seccion-6', cls: 'l-bot-right', pointId: 'mouth-right', anchor: 'top' }
  ];

  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(private readonly zone: NgZone) {
    this.updatePoints();
  }

  ngAfterViewInit(): void {
    if (!this.hasDOM) {
      this.connectorsReady = true;
      this.requestConnectorUpdate(true);
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
  }

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

  onMeta(video: HTMLVideoElement): void {
    if (video.videoWidth && video.videoHeight) {
      this.frameRatio = video.videoWidth / video.videoHeight;
      this.frameAR = `${video.videoWidth} / ${video.videoHeight}`;
      this.updatePoints();
    }
  }

  startFade(video: HTMLVideoElement): void {
    video.pause();
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
  }

  onFadeEnd(event: TransitionEvent): void {
    const element = event.target as HTMLElement | null;
    if (!element || event.propertyName !== 'opacity') {
      return;
    }

    if (this.fading && element.classList.contains('video')) {
      this.preparePhases(['connectors', 'points']);
    }
  }

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

  private clearTimeout(handle: number | null): number | null {
    if (handle !== null && this.hasDOM) {
      window.clearTimeout(handle);
    }
    return null;
  }
}


