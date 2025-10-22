// src/app/shared/i18n/t.pipe.ts
import { Pipe, PipeTransform, inject, ChangeDetectorRef, OnDestroy, PLATFORM_ID } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { isPlatformBrowser } from '@angular/common';
import DOMPurify from 'dompurify';
import { TranslationService } from './translation.service';
import { Subscription } from 'rxjs';

/**
 * Pipe general de traducción:
 * - Claves terminadas en "_html" -> sanitizadas con DOMPurify y devueltas como SafeHtml.
 * - Resto -> string plano.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TPipe implements PipeTransform, OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private sub: Subscription;

  constructor() {
    this.sub = this.i18n.langChanges$.subscribe(() => this.cdr.markForCheck());
  }

  transform(key: string): string | SafeHtml {
    const raw = this.i18n.t(key) ?? '';
    if (!key.endsWith('_html')) return raw;

    if (!isPlatformBrowser(this.platformId)) {
      // SSR: sin DOM -> strip tags por seguridad
      const stripped = raw.replace(/<[^>]*>/g, '');
      return this.sanitizer.bypassSecurityTrustHtml(stripped);
    }
    const clean = DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'br', 'a'],
      ALLOWED_ATTR: ['href', 'target', 'rel']
    });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }
}
