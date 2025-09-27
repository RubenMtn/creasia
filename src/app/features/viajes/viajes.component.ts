import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-viajes',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './viajes.component.html',
  styleUrl: './viajes.component.scss'
})
export class ViajesComponent {

  // Subir suavemente al ancla "...-top"
  scrollToTopAnchor(): void {
    const el = document.getElementById('viajes-top');
    if (el && 'scrollIntoView' in el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}



