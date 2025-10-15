// src/app/shared/i18n/t.pipe.ts
import { Pipe, PipeTransform, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslationService } from './translation.service';
import { Subscription } from 'rxjs';


@Pipe({
  name: 't',
  standalone: true,
  pure: false, // como lo tenías, para reaccionar al cambio de idioma
})
export class TPipe implements PipeTransform, OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub: Subscription;

  private decodeEntities(str: string): string {
    // Desescapa las entidades más comunes si vinieran escapadas (&lt; &gt; &amp; &quot; &#39;)
    return str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'');
  }

  constructor() {
    // Cuando cambie el idioma, marcamos para comprobar (OnPush friendly)
    this.sub = this.i18n.langChanges$.subscribe(() => this.cdr.markForCheck());
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
  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
