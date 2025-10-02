import { ChangeDetectionStrategy, Component, Input, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-scroll-top-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scroll-top-button.component.html',
  styleUrl: './scroll-top-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollTopButtonComponent {
  private readonly platformId = inject(PLATFORM_ID);

  @Input() targetId?: string;
  @Input() ariaLabel = 'Volver arriba';
  @Input() iconSrc = 'assets/icons/flecha.png';
  @Input() iconAlt = 'Volver arriba';

  scrollToTop(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const target = this.targetId ? document.getElementById(this.targetId) : null;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
