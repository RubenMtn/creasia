import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

videoAR = '16 / 9';      // valor por defecto; se ajusta al cargar
fading = false;
showImage = false;

onMeta(v: HTMLVideoElement) {
  if (v.videoWidth && v.videoHeight) {
    this.videoAR = `${v.videoWidth} / ${v.videoHeight}`;
  }
}

startFade(v: HTMLVideoElement) {
  v.pause();
  try { v.currentTime = Math.max(0, v.duration - 0.05); } catch { /* empty */ }
  this.showImage = true;   // aparece YA para el crossfade
  this.fading = true;      // el vídeo empieza a desvanecerse
}


  // onFadeEnd(ev: TransitionEvent) {
  //   if ((ev.target as HTMLElement)?.classList.contains('hero-video') && this.fading) {
  //     this.showImage = true; // solo cuando acaba el fade del vídeo
  //   }
  // }
}

