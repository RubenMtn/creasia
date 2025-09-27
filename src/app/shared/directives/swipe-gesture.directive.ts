/* eslint-disable @angular-eslint/prefer-inject */
// Directiva minimalista para detectar swipe izquierda/derecha con Pointer Events.
// Comentarios en español. Standalone para importarla directo en el componente.
import { Directive, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Directive({
  selector: '[appSwipeGesture]',
  standalone: true,
})
export class SwipeGestureDirective {
  // Umbrales configurables
  @Input() swipeThresholdPx = 40;     // desplazamiento mínimo horizontal
  @Input() maxOffAxisRatio = 0.5;     // tolerancia a desvío vertical (0 = estrictamente horizontal)

  // Eventos públicos
  @Output() swipeLeft = new EventEmitter<void>();
  @Output() swipeRight = new EventEmitter<void>();
  @Output() swiped = new EventEmitter<void>(); // genérico (para desactivar el click si procede)

  private startX = 0;
  private startY = 0;
  private tracking = false;

  constructor(private host: ElementRef<HTMLElement>) {
    // Recomendación táctil: permitir scroll vertical y capturar horizontal
    const el = this.host.nativeElement;
    el.style.touchAction ||= 'pan-y'; // evita bloquear el scroll vertical
  }

  // Inicio de gesto
  @HostListener('pointerdown', ['$event'])
  onPointerDown(ev: PointerEvent) {
    // solo botón principal / contacto primario
    if (ev.button !== 0) return;
    this.tracking = true;
    this.startX = ev.clientX;
    this.startY = ev.clientY;
  }

  // Fin de gesto
  @HostListener('pointerup', ['$event'])
  onPointerUp(ev: PointerEvent) {
    if (!this.tracking) return;
    this.tracking = false;

    const dx = ev.clientX - this.startX;
    const dy = ev.clientY - this.startY;

    // 1) Comprobar desvío vertical aceptable
    if (Math.abs(dy) > Math.abs(dx) * this.maxOffAxisRatio) return;

    // 2) Umbral horizontal
    if (Math.abs(dx) < this.swipeThresholdPx) return;

    // 3) Emitir eventos
    this.swiped.emit();
    if (dx < 0) this.swipeLeft.emit();
    else this.swipeRight.emit();
  }

  // Cancelaciones
  @HostListener('pointercancel')
  @HostListener('pointerleave')
  onCancel() { this.tracking = false; }
}
