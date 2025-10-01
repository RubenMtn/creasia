/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
/**
 * GaleriaComponent (Angular 20)
 * - Muestra una rejilla de miniaturas.
 * - Al hacer clic abre un VISOR en ventana nueva (Blob URL) con:
 *    • Zoom del navegador SOLO en esa ventana.
 *    • Swipe (izq/der) + flechas ← → para navegar.
 *    • Botón “Cerrar” robusto:
 *        - window.close(); si no puede, postMessage al padre para que cierre la referencia,
 *          y como último recurso navega a about:blank para que el usuario cierre fácil.
 *
 * Notas:
 * - Hemos eliminado el lightbox embebido para evitar conflictos de zoom global.
 * - La plantilla NO debe referenciar selectedIndex / onTouchStart/Move/End / close / onImageClick.
 */

import { Component, OnInit, HostListener, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from '../../services/gallery.service';

@Component({
  selector: 'app-galeria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './galeria.component.html',
  styleUrls: ['./galeria.component.scss'],
})
export class GaleriaComponent implements OnInit, OnDestroy {
  /* -------------------------- Estado de datos -------------------------- */
  loading = true;
  images: string[] = [];

  /* Referencia a la ventana hija (visor) para poder cerrarla vía postMessage */
  private winRef: Window | null = null;

  /* Servicios */
  private readonly gallery = inject(GalleryService);

  /* ------------------------------ Ciclo de vida ------------------------------ */
  ngOnInit(): void {
    // Carga de imágenes (usa tu servicio actual; devuelve rutas relativas o absolutas)
    this.gallery.loadImages().subscribe({
      next: (list) => {
        this.images = list ?? [];
        this.loading = false;
      },
      error: () => {
        this.images = [];
        this.loading = false;
      },
    });
  }

  /* ------------------------------- Acción UI ------------------------------- */
  /**
   * Abre el visor en ventana nueva empezando por la imagen 'index'.
   * Lo exponemos público para enlazarlo desde la plantilla: (click)="open($index)".
   */
  open(index: number): void {
    this.openInWindow(index);
  }

  /* ----------------------------- Ventana visor ----------------------------- */
  /**
   * Abre la ventana hija con un HTML auto-contenido (Blob URL).
   * - Normaliza rutas a absolutas para que funcionen dentro del Blob.
   * - Guarda la referencia (winRef) para poder cerrarla desde el padre si hace falta.
   */



  private openInWindow(i: number): void {
    if (!this.images?.length) return;
    // Sólo ejecuta en navegador
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const startIndex = Math.max(0, Math.min(i, this.images.length - 1));

    // 1) Normaliza rutas a absolutas tomando baseURI o el origin como base.
    const base = document.baseURI || location.origin + '/';
    const absImages = this.images.map((u) => {
      try {
        return new URL(u, base).toString();
      } catch {
        return u; // si ya es válida, la dejamos como está
      }
    });

    // 2) Genera el HTML del visor (incluye swipe, flechas, botón cerrar).
    const html = this.buildViewerHtml(
      absImages,
      startIndex,
      `Imagen ${startIndex + 1} / ${absImages.length}`
    );

    // 3) Blob URL para el visor
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Abrimos SIN 'noopener' para poder usar postMessage (el visor no navega a externos).
    this.winRef = window.open(url, 'creasiaViewer', 'popup,resizable');

    // Limpieza del Blob pasado un rato
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  ngOnDestroy(): void {
    this.safeCloseViewer();
  }

  private safeCloseViewer(): void {
    try {
      if (this.winRef && !this.winRef.closed) {
        this.winRef.close();
      }
    } catch { }
    // Por si el cierre directo no procede, intenta avisar a la hija:
    try {
      if (this.winRef) {
        this.winRef.postMessage({ type: 'creasia-parent-close' }, '*');
      }
    } catch { }
    this.winRef = null;
  }

  @HostListener('window:beforeunload')
  @HostListener('window:pagehide')
  onWindowTeardown(): void {
    this.safeCloseViewer();
  }

  /* ------------------- Mensajería: cierre desde la hija ------------------- */
  /**
   * Recibe 'creasia-close-me' desde el visor y cierra la referencia si sigue viva.
   */
  @HostListener('window:message', ['$event'])
  onMessage(ev: MessageEvent): void {
    try {
      if (!ev?.data || typeof ev.data !== 'object') return;
      const { type } = ev.data as { type?: string };
      if (type !== 'creasia-close-me') return;

      if (this.winRef && !this.winRef.closed) {
        try { this.winRef.close(); } catch { }
      }
      this.winRef = null;
    } catch { }
  }

  /* ---------------------- Construcción del visor HTML ---------------------- */
  /**
   * Devuelve un HTML auto-contenido con:
   * - Botón cerrar robusto
   * - Navegación por swipe y flechas
   * - Imagen ajustada a viewport (max-width/height)
   */
  private buildViewerHtml(images: string[], index: number, title: string): string {
    const safeTitle = title.replace(/[<>&"]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string)
    );
    const jsonImages = JSON.stringify(images ?? []);
    const jsonIndex = JSON.stringify(index);

    return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    html, body { height: 100%; margin: 0; background: #000; color: #fff; }
    .viewer {
      position: relative; height: 100%;
      display: flex; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box; touch-action: manipulation;
    }
    img {
      max-width: 100%; max-height: 100%; object-fit: contain;
      user-select: none; -webkit-user-drag: none; will-change: transform;
      transition: transform 180ms ease;
    }
    .close-btn {
      position: fixed; top: 12px; right: 12px; z-index: 10;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.4);
      color: #fff; padding: 6px 10px; border-radius: 8px;
      font: 600 16px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Noto Sans";
      cursor: pointer;
    }
    .close-btn:focus-visible { outline: 2px solid rgba(255,255,255,0.6); outline-offset: 2px; }
    .nav-zone {
      position: fixed; top: 0; bottom: 0; width: 25%;
      background: transparent; border: 0; padding: 0; margin: 0;
      cursor: pointer; opacity: 0; z-index: 5;
    }
    .nav-left  { left: 0;  }
    .nav-right { right: 0; }
  </style>
</head>
<body>
  <button type="button" class="close-btn" aria-label="Cerrar (Esc)" title="Cerrar (Esc)">×</button>
  <button type="button" class="nav-zone nav-left"  aria-label="Anterior"></button>
  <button type="button" class="nav-zone nav-right" aria-label="Siguiente"></button>

  <div class="viewer" role="img" aria-label="${safeTitle}">
    <img id="photo" alt="">
  </div>

  <script>
    (function () {
      var IMAGES = ${jsonImages};
      var idx = ${jsonIndex};

      var imgEl    = document.getElementById('photo');
      var closeBtn = document.querySelector('.close-btn');
      var leftBtn  = document.querySelector('.nav-left');
      var rightBtn = document.querySelector('.nav-right');

      // --- Cierre robusto ---
      function tryClose() {
        try { window.close(); return; } catch (e) {}
        try {
          if (window.opener && typeof window.opener.postMessage === 'function') {
            window.opener.postMessage({ type: 'creasia-close-me' }, '*');
            return;
          }
        } catch (e) {}
        try { location.replace('about:blank'); } catch (e) {}
      }

      // --- Render imagen ---
      function render() {
        imgEl.src = IMAGES[idx] || '';
        document.title = 'Imagen ' + (idx + 1) + ' / ' + IMAGES.length;
      }

      function clampIndex(i) {
        if (!IMAGES.length) return 0;
        if (i < 0) return IMAGES.length - 1;
        if (i >= IMAGES.length) return 0;
        return i;
      }

      function next() { idx = clampIndex(idx + 1); render(); }
      function prev() { idx = clampIndex(idx - 1); render(); }

      // Botón cerrar + teclado
      if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); tryClose(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); tryClose(); }
        else if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft')  prev();
      });

      // Click zonas laterales (escritorio)
      if (leftBtn)  leftBtn.addEventListener('click', prev);
      if (rightBtn) rightBtn.addEventListener('click', next);

      // Gestos táctiles (1 dedo = swipe)
      var startX = 0, startY = 0, deltaX = 0, swiping = false;
      var SWIPE_THRESHOLD = 40; // px
      var MAX_ANGLE_DEG   = 30; // tolerancia angular

      document.addEventListener('touchstart', function (ev) {
        if (ev.touches.length !== 1) { swiping = false; return; }
        var t = ev.touches[0];
        startX = t.clientX; startY = t.clientY; deltaX = 0; swiping = false;
      }, { passive: true });

      document.addEventListener('touchmove', function (ev) {
        if (ev.touches.length !== 1) return;
        var t = ev.touches[0];
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        var angleDeg = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);

        if (Math.abs(dx) > 10 && (angleDeg <= MAX_ANGLE_DEG || angleDeg >= 180 - MAX_ANGLE_DEG)) {
          swiping = true;
          deltaX = dx;
          imgEl.style.transform = 'translateX(' + (dx * 0.1) + 'px)';
          ev.preventDefault();
          ev.stopPropagation();
        }
      }, { passive: false });

      document.addEventListener('touchend', function (ev) {
        imgEl.style.transform = '';
        if (!swiping) return;
        var absDx = Math.abs(deltaX);
        if (absDx >= SWIPE_THRESHOLD) {
          if (deltaX < 0) next(); else prev();
          ev.preventDefault(); ev.stopPropagation();
        }
        deltaX = 0; swiping = false;
      });

      // Inicial
      render();
    })();
  </script>
</body>
</html>`;
  }
}
