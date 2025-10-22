// src/app/shared/i18n/t-html.pipe.ts
import { Pipe, PipeTransform, inject, ChangeDetectorRef, OnDestroy, PLATFORM_ID } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';
import DOMPurify from 'dompurify';
import { Subscription } from 'rxjs';
import { TranslationService } from './translation.service';

/**
 * Pipe para traducir claves que devuelven HTML controlado.
 * Sanitiza con DOMPurify (whitelist) ANTES de confiar el HTML.
 */
@Pipe({ name: 'tHtml', standalone: true, pure: false })
export class THtmlPipe implements PipeTransform, OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);
  private sub: Subscription;

  constructor() {
    // Re-render al cambiar idioma
    this.sub = this.i18n.langChanges$.subscribe(() => this.cdr.markForCheck());
  }

  transform(key: string): SafeHtml {
    const raw = this.i18n.t(key) ?? '';
    // En SSR no hay ventana: devolvemos texto plano sin etiquetas por seguridad.
    if (!isPlatformBrowser(this.platformId)) {
      const stripped = raw.replace(/<[^>]*>/g, '');
      return this.sanitizer.bypassSecurityTrustHtml(stripped);
    }
    // En navegador: sanitizamos permitiendo solo etiquetas seguras.
    const clean = DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'br', 'a'],
      ALLOWED_ATTR: ['href', 'target', 'rel']
    });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }
}
