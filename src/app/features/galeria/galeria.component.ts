import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';

const importedImages = import.meta.glob('../../../assets/home/*.{jpg,jpeg,JPG,JPEG}', {
  eager: true,
  import: 'default'
}) as Record<string, string>;

const fallbackImages = [
  'assets/home/slide1.jpg',
  'assets/home/slide2.jpg',
  'assets/home/slide3.jpg',
  'assets/home/slide4.jpg',
  'assets/home/slide5.jpg',
  'assets/home/slide6.jpg',
  'assets/home/slide7.jpg'
];

const galleryImages = Object.entries(importedImages)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([, src]) => src);

@Component({
  selector: 'app-galeria',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './galeria.component.html',
  styleUrl: './galeria.component.scss'
})
export class GaleriaComponent {
  readonly images = galleryImages.length ? galleryImages : fallbackImages;
  selectedImage: string | null = null;

  open(image: string): void {
    this.selectedImage = image;
  }

  close(): void {
    this.selectedImage = null;
  }
}
