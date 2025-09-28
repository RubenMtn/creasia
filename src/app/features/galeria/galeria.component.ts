// Componente de galería (Angular 20)
// - Grid de miniaturas y lightbox accesible
// - Comentarios en español, modular y claro

import { Component, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from '../../services/gallery.service';

@Component({
  selector: 'app-galeria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './galeria.component.html',
  // Antes: styleUrls: ['./galeria.component.css'],
  // Ahora: usamos el SCSS real que existe en disco.
  styleUrl: './galeria.component.scss',
})
export class GaleriaComponent implements OnInit {
  private gallery = inject(GalleryService);

  loading = true;                      // estado de carga
  images: string[] = [];               // miniaturas
  selectedIndex: number | null = null; // índice imagen abierta (lightbox)

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

  /** Permite cerrar con la tecla Escape */
  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.selectedIndex !== null) this.close();
  }
}
