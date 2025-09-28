/* Componente de galería (Angular 20)
   - Carga imágenes vía servicio
   - Controla estados de carga y vacío
   - Comentarios en español */
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from '../../services/gallery.service';

@Component({
  selector: 'app-galeria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './galeria.component.html',
})
export class GaleriaComponent implements OnInit {
  private gallery = inject(GalleryService);

  loading = true;        // estado de carga
  images: string[] = []; // inicializado → nunca undefined

  ngOnInit(): void {
    this.gallery.loadImages().subscribe({
      next: (list) => {
        this.images = list ?? [];
        this.loading = false;
      },
      error: () => {
        this.images = [];
        this.loading = false;
      }
    });
  }
}
