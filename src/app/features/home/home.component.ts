import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface LinkItem {
  label: string;
  route: string;
  cls: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  /* ====== Vídeo/imagen (sin cambios de comportamiento) ====== */
  videoAR = '16 / 9';
  fading = false;     // el vídeo está desvaneciéndose
  showImage = false;  // imagen visible para el crossfade
  showLinks = false;  // mostramos enlaces al terminar el fade

  onMeta(v: HTMLVideoElement) {
    if (v.videoWidth && v.videoHeight) {
      this.videoAR = `${v.videoWidth} / ${v.videoHeight}`; // encaje exacto
    }
  }

  startFade(v: HTMLVideoElement) {
    v.pause();
    try { v.currentTime = Math.max(0, v.duration - 0.05); } catch { /* noop */ }
    this.showImage = true;   // aparece imagen para el crossfade
    this.fading = true;      // comienza el desvanecimiento del vídeo
  }

  /* ====== Enlaces (aleatorizar orden de aparición) ====== */
  // Base de enlaces con su posición (la posición NO cambia; solo el orden de aparición)
  private readonly links: LinkItem[] = [
    { label: 'Actividades', route: '/seccion-1', cls: 'l-top-left'  },
    { label: 'Socios', route: '/seccion-2', cls: 'l-mid-left'  },
    { label: 'Cultura', route: '/seccion-3', cls: 'l-bot-left'  },
    { label: 'Idiomas', route: '/seccion-4', cls: 'l-top-right' },
    { label: 'Viajes', route: '/seccion-5', cls: 'l-mid-right' },
    { label: 'Gourmetpass', route: '/seccion-6', cls: 'l-bot-right' },
  ];

  // Array que se pinta en la vista (orden aleatorio)
  displayLinks: LinkItem[] = [];

  // Stagger del “pop” (ms)
  baseDelay = 200;  // retardo inicial antes del primer link
  stagger   = 180;  // separación entre un link y el siguiente

  onFadeEnd(ev: TransitionEvent) {
    const el = ev.target as HTMLElement;
    if (this.fading && el?.classList.contains('video') && ev.propertyName === 'opacity') {
      // 1) Aleatoriza orden de aparición
      this.displayLinks = [...this.links].sort(() => Math.random() - 0.5);
      // 2) Muestra los links (la animación usa animationDelay inline)
      this.showLinks = true;
    }
  }
}
