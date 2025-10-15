// src/app/shared/i18n/t-html.pipe.ts
import { Pipe, PipeTransform, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { TranslationService } from './translation.service';

@Pipe({
  name: 'tHtml',
  standalone: true,
  pure: false,
})
export class THtmlPipe implements PipeTransform, OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private sub: Subscription;

  constructor() {
    this.sub = this.i18n.langChanges$.subscribe(() => this.cdr.markForCheck());
  }

  transform(key: string): SafeHtml {
    const html = this.i18n.t(key);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
