import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterLink, TPipe],
  templateUrl: './legal.component.html',
  styleUrl: './legal.component.scss'
})
export class LegalComponent {
  // Subir suavemente al ancla "...-top"
  scrollToTopAnchor(): void {
    const el = document.getElementById('legal-top');
    if (el && 'scrollIntoView' in el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
