import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../shared/i18n/t.pipe';

interface LinkItem {
  key: string;   // clave i18n, ej: 'links.section1'
  route: string; // ruta
  cls: string;   // clase de posición
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, TPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  videoAR = '16 / 9';
  fading = false;
  showImage = false;
  showLinks = false;

  onMeta(v: HTMLVideoElement) {
    if (v.videoWidth && v.videoHeight) {
      this.videoAR = `${v.videoWidth} / ${v.videoHeight}`;
    }
  }

  startFade(v: HTMLVideoElement) {
    v.pause();
    try { v.currentTime = Math.max(0, v.duration - 0.05); } catch { /* empty */ }
    this.showImage = true;
    this.fading = true;
  }

  onFadeEnd(ev: TransitionEvent) {
    const el = ev.target as HTMLElement;
    if (this.fading && el?.classList.contains('video') && ev.propertyName === 'opacity') {
      this.displayLinks = [...this.links].sort(() => Math.random() - 0.5);
      this.showLinks = true;
    }
  }

  private readonly links: LinkItem[] = [
    { key: 'links.section1', route: '/seccion-1', cls: 'l-top-left'  },
    { key: 'links.section2', route: '/seccion-2', cls: 'l-mid-left'  },
    { key: 'links.section3', route: '/seccion-3', cls: 'l-bot-left'  },
    { key: 'links.section4', route: '/seccion-4', cls: 'l-top-right' },
    { key: 'links.section5', route: '/seccion-5', cls: 'l-mid-right' },
    { key: 'links.section6', route: '/seccion-6', cls: 'l-bot-right' },
  ];

  displayLinks: LinkItem[] = [];
  baseDelay = 200;
  stagger   = 180;
}
