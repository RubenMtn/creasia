import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SeoService } from './shared/seo/seo.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('creasia');
  private readonly seo = inject(SeoService);

  constructor() {
    // Arranca observación de rutas + actualización de meta/OG/canonical/hreflang/lang
    this.seo.init();
  }
}
