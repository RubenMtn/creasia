// SEO básico por página: Title + Meta Description
import { Title, Meta } from '@angular/platform-browser';

// Componentes/Angular
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// i18n (tu pipe)
import { TPipe } from '../../shared/i18n/t.pipe';

// Carga de imágenes (Vite builder): importa todas las de /assets/home
const importedImages = import.meta.glob('../../../assets/home/*.{jpg,jpeg,JPG,JPEG}', {
  eager: true,
  import: 'default'
}) as Record<string, string>;

// Fallback por si no hay imágenes importadas
const fallbackImages = [
  'assets/home/slide1.jpg',
  'assets/home/slide2.jpg',
  'assets/home/slide3.jpg',
  'assets/home/slide4.jpg',
  'assets/home/slide5.jpg',
  'assets/home/slide6.jpg',
  'assets/home/slide7.jpg'
];

// Ordena y mapea a src
const galleryImages = Object.entries(importedImages)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([, src]) => src);

@Component({
  selector: 'app-galeria',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './galeria.component.html',
  styleUrls: ['./galeria.component.scss'] // ✅ plural correcto
})
export class GaleriaComponent implements OnInit {
  // ===== SEO services =====
  private title = inject(Title);
  private meta  = inject(Meta);

  // ===== Estado de la galería =====
  readonly images = galleryImages.length ? galleryImages : fallbackImages;
  selectedImage: string | null = null;

  // ===== Ciclo de vida =====
  ngOnInit(): void {
    // 🔹 SEO rápido y efectivo: título y meta descripción únicos
    this.title.setTitle('Galería | Creasia – Fotos y cultura asiática en Madrid');
    this.meta.updateTag({
      name: 'description',
      content: 'Explora la galería de Creasia: fotografías de cultura asiática en Madrid. '
             + 'Eventos, arte, gastronomía y mucho más.'
    });

    // (Opcional) Etiquetas sociales mínimas:
    this.meta.updateTag({ property: 'og:title', content: 'Galería | Creasia' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }

  // ===== Acciones UI =====
  open(image: string): void {
    this.selectedImage = image;
  }

  // En táctil: previene selección/zoom accidental antes de abrir
  openFromTouch(event: Event, image: string): void {
    event.preventDefault();
    this.open(image);
  }

  close(): void {
    this.selectedImage = null;
  }

  // En táctil: idem
  closeFromTouch(event: Event): void {
    event.preventDefault();
    this.close();
  }
}
