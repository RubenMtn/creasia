// Componente de galería (Angular 20) con swipe en lightbox
// - Grid de miniaturas y lightbox accesible
// - Cierra al clicar la imagen ampliada (tap)
// - Swipe izquierda/derecha para navegar entre imágenes
// - Accesibilidad con ESC (cerrar) y flechas ←/→ (navegar)

import { Component, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from '../../services/gallery.service';

@Component({
  selector: 'app-galeria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './galeria.component.html',
  styleUrl: './galeria.component.scss',
})
export class GaleriaComponent implements OnInit {
  private gallery = inject(GalleryService);

  loading = true;                      // estado de carga
  images: string[] = [];               // rutas de imágenes
  selectedIndex: number | null = null; // índice de la imagen abierta (lightbox)

  // --- Estado para gestos táctiles ---
  private touchStartX = 0;
  private touchStartY = 0;
  private touchDeltaX = 0;
  private swiping = false;             // si estamos en gesto de swipe (para no cerrar por click)
  private readonly SWIPE_THRESHOLD = 40; // px mínimos para considerar swipe
  private readonly MAX_ANGLE_DEG = 30;   // tolerancia en ángulo (para distinguir de scroll vertical)

  ngOnInit(): void {
    this.gallery.loadImages().subscribe({
      next: (list) => { this.images = list ?? []; this.loading = false; },
      error: () => { this.images = []; this.loading = false; }
    });
  }

  /** Abre el lightbox con la imagen i */
  open(i: number): void { this.selectedIndex = i; }

  /** Cierra el lightbox */
  close(): void { this.selectedIndex = null; }

  /** Navega a la siguiente imagen (wrap-around) */
  next(): void {
    if (this.selectedIndex === null || this.images.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.images.length;
  }

  /** Navega a la anterior (wrap-around) */
  prev(): void {
    if (this.selectedIndex === null || this.images.length === 0) return;
    // suma longitud para evitar negativo antes del módulo
    this.selectedIndex = (this.selectedIndex - 1 + this.images.length) % this.images.length;
  }

  /** Click en la imagen ampliada (tap) → cierra, salvo si venimos de un swipe */
  onImageClick(): void {
    if (this.swiping) return; // evita cerrar si justo fue un swipe
    this.close();
  }

  /** Permite cerrar con la tecla Escape y navegar con flechas */
  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.selectedIndex === null) return;
    if (e.key === 'Escape') this.close();
    else if (e.key === 'ArrowRight') this.next();
    else if (e.key === 'ArrowLeft') this.prev();
  }

  // ---------- Gestos táctiles en el overlay ----------

  /** Inicio del gesto táctil */
  onTouchStart(event: TouchEvent): void {
    if (this.selectedIndex === null) return;
    const t = event.touches[0];
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    this.touchDeltaX = 0;
    this.swiping = false;
  }

  /** Movimiento táctil: comprobamos que sea predominantemente horizontal */
  onTouchMove(event: TouchEvent): void {
    if (this.selectedIndex === null) return;
    const t = event.touches[0];
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;

    // Ángulo en radianes → grados
    const angleDeg = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);

    // Si el movimiento es lo bastante horizontal, marcamos swiping y evitamos scroll/click
    if (Math.abs(dx) > 10 && (angleDeg <= this.MAX_ANGLE_DEG || angleDeg >= 180 - this.MAX_ANGLE_DEG)) {
      this.swiping = true;
      this.touchDeltaX = dx;
      event.preventDefault(); // evita scroll/zoom y "click" fantasma
      event.stopPropagation();
    }
  }

  /** Fin del gesto táctil: decidimos si es swipe válido y navegamos */
  onTouchEnd(event: TouchEvent): void {
    if (this.selectedIndex === null) return;

    const dx = this.touchDeltaX;
    const absDx = Math.abs(dx);

    if (this.swiping && absDx >= this.SWIPE_THRESHOLD) {
      // dx < 0 → desliza hacia la izquierda → siguiente
      if (dx < 0) this.next();
      // dx > 0 → desliza hacia la derecha → anterior
      else this.prev();

      // evitamos que se dispare el click de cierre
      event.preventDefault();
      event.stopPropagation();
    }

    // resetea estado de gesto
    this.touchDeltaX = 0;
    this.swiping = false;
  }
}
