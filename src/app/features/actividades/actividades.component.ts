import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-actividades',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './actividades.component.html',
  styleUrl: './actividades.component.scss'
})
export class ActividadesComponent {
  
  // Subir suavemente al ancla "...-top"
  scrollToTopAnchor(): void {
    const el = document.getElementById('actividades-top');
    if (el && 'scrollIntoView' in el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
