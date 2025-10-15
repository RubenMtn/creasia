// src/app/shared/i18n/t.pipe.ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslationService } from './translation.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false, // como lo tenías, para reaccionar al cambio de idioma
})
export class TPipe implements PipeTransform {
  private readonly i18n = inject(TranslationService);
  private readonly sanitizer = inject(DomSanitizer);

  private decodeEntities(str: string): string {
    // Desescapa las entidades más comunes si vinieran escapadas (&lt; &gt; &amp; &quot; &#39;)
    return str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'');
  }

  transform(key: string): string | SafeHtml {
    const raw = this.i18n.t(key);

    if (key.endsWith('_html')) {
      // Si viniera escapado, lo desescapamos antes de confiarlo
      const unescaped = this.decodeEntities(raw);
      return this.sanitizer.bypassSecurityTrustHtml(unescaped);
    }

    return raw;
  }
}
