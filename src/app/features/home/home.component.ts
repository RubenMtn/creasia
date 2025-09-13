import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  // Aspect ratio del vídeo. Se ajusta al cargar metadatos para encajar imagen y vídeo al píxel.
  videoAR = '16 / 9';

  // Estados de la secuencia de intro
  fading = false;     // el vídeo está desvaneciéndose
  showImage = false;  // muestra imagen de fondo para el crossfade
  showLinks = false;  // muestra los 6 enlaces (después del fade del vídeo)

  // Al tener metadatos, fijamos el aspect-ratio real del vídeo (encaje perfecto con la imagen)
  onMeta(v: HTMLVideoElement) {
    if (v.videoWidth && v.videoHeight) {
      this.videoAR = `${v.videoWidth} / ${v.videoHeight}`;
    }
  }

  // Cuando finaliza el vídeo, iniciamos el fade e iluminamos la imagen por detrás
  startFade(v: HTMLVideoElement) {
    v.pause();
    try { v.currentTime = Math.max(0, v.duration - 0.05); } catch { /* noop */ }
    this.showImage = true;   // aparece ya para el crossfade
    this.fading = true;      // comienza el desvanecimiento del vídeo
  }

  // Al terminar la transición de opacidad del vídeo, mostramos los enlaces
  onFadeEnd(ev: TransitionEvent) {
    const el = ev.target as HTMLElement;
    if (this.fading && el?.classList.contains('video') && ev.propertyName === 'opacity') {
      this.showLinks = true;
    }
  }
}
