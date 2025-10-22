// src/app/shared/seo/seo.service.ts
// Servicio SEO: título, descripción, Open Graph/Twitter, canonical y hreflang.
// - Tipado estricto: sin "any"; usamos "unknown" + type guards.
// - Import correcto de isPlatformBrowser (@angular/common).
// - Sin APIs privadas (no ɵgetDOM); usamos DOCUMENT.
// - No dependemos de un API concreto del TranslationService: interfaz I18nLike.
// - Seguro para SSR.

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Observable, isObservable } from 'rxjs';
import { TranslationService } from '../i18n/translation.service';

/* Adaptador mínimo del servicio de i18n: sólo lo que necesitamos */
interface I18nLike {
  t?: (key: string) => string | null | undefined;
  langChanges$?: unknown;                  // puede ser Observable o Subscribable
  currentLang?: string;
  lang?: string;
  getCurrentLang?: () => string | null | undefined;
}

/* Tipo para fuentes "suscribibles" que no son Observable */
interface Subscribable { subscribe: (fn: () => void) => unknown }

/* Type guard para detectar objetos con .subscribe() */
function isSubscribable(x: unknown): x is Subscribable {
  return !!x && typeof (x as { subscribe?: unknown }).subscribe === 'function';
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly doc = inject(DOCUMENT) as Document;

  // Tipamos el servicio de traducción como I18nLike, evitando "{}"
  private readonly i18n = inject(TranslationService) as unknown as I18nLike;

  /** Arranca el refresco de metadatos en navegación y (si existe) al cambiar idioma */
  init(): void {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.applyForRoute());

    const stream = this.i18n.langChanges$;
    if (isObservable(stream)) {
      (stream as Observable<unknown>).subscribe(() => this.applyForRoute());
    } else if (isSubscribable(stream)) {
      stream.subscribe(() => this.applyForRoute());
    }

    this.applyForRoute();
  }

  /** Aplica metadatos en base a la ruta activa y al idioma detectado */
  private applyForRoute(): void {
    const route = this.findDeepest(this.router.routerState.root);
    const data = route?.snapshot?.data ?? {};

    const titleKey: string | undefined = data['seoTitleKey'];
    const descKey:  string | undefined = data['seoDescKey'];
    const image:    string = data['seoImage'] ?? 'assets/pics/slide1.jpg';

    const lang = this.getCurrentLang();
    this.setHtmlLang(lang);

    // Traductor seguro (si existe función t)
    const t = (k?: string) =>
      k && typeof this.i18n.t === 'function' ? String(this.i18n.t(k) ?? '') : '';

    const titleText = (t(titleKey) || 'Creasia').trim();
    const descText  = (t(descKey)  || 'Cultura entre oriente y occidente').trim();

    // <title> y description
    this.title.setTitle(titleText);
    this.meta.updateTag({ name: 'description', content: descText });

    // Open Graph / Twitter
    const url = this.currentUrl();
    this.meta.updateTag({ property: 'og:site_name', content: 'Creasia' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:title', content: titleText });
    this.meta.updateTag({ property: 'og:description', content: descText });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: titleText });
    this.meta.updateTag({ name: 'twitter:description', content: descText });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    // Canonical + hreflang
    this.setCanonical(url);
    this.setHreflang(url);
  }

  /** Devuelve la ruta más profunda (hoja) */
  private findDeepest(route: ActivatedRoute): ActivatedRoute {
    let r = route;
    while (r.firstChild) r = r.firstChild;
    return r;
  }

  /** Detecta idioma actual (servicio → <html lang> → ?lang → 'es') */
  private getCurrentLang(): string {
    const fromSvc =
      (typeof this.i18n.getCurrentLang === 'function' && this.i18n.getCurrentLang()) ||
      this.i18n.currentLang ||
      this.i18n.lang;
    if (typeof fromSvc === 'string' && fromSvc.length <= 10) return fromSvc;

    const htmlLang = this.doc?.documentElement?.getAttribute('lang')?.trim();
    if (htmlLang) return htmlLang;

    if (this.isBrowser()) {
      try {
        const p = new URLSearchParams(window.location.search).get('lang');
        if (p) return p;
      } catch { /* empty */ }
    }

    return 'es';
  }

  /** Fija <html lang="..."> */
  private setHtmlLang(lang: string): void {
    try {
      this.doc?.documentElement?.setAttribute('lang', lang || 'es');
    } catch { /* empty */ }
  }

  /** Actualiza/crea <link rel="canonical"> */
  private setCanonical(url: string): void {
    this.linkTag('canonical', url);
  }

  /** Inserta hreflang para es/en/zh + x-default */
  private setHreflang(currentUrl: string): void {
    const base = currentUrl.split('?')[0] || '/';
    this.linkTag('alternate', this.withLang(base, 'es'), 'es');
    this.linkTag('alternate', this.withLang(base, 'en'), 'en');
    this.linkTag('alternate', this.withLang(base, 'zh'), 'zh');
    this.linkTag('alternate', base, 'x-default');
  }

  /** Crea/actualiza un <link rel="..."> (y opcional hreflang) */
  private linkTag(rel: string, href: string, hreflang?: string): void {
    const sel = hreflang
      ? `link[rel="${rel}"][hreflang="${hreflang}"]`
      : `link[rel="${rel}"]`;
    let el = this.doc.head.querySelector(sel) as HTMLLinkElement | null;
    if (!el) {
      el = this.doc.createElement('link');
      el.rel = rel;
      if (hreflang) el.hreflang = hreflang;
      this.doc.head.appendChild(el);
    }
    el.href = href;
  }

  /** URL actual (en SSR devolvemos '/') */
  private currentUrl(): string {
    if (!this.isBrowser()) return '/';
    const { protocol, host, pathname, search } = window.location;
    return `${protocol}//${host}${pathname}${search}`;
  }

  /** Añade/actualiza ?lang=xx a una URL base */
  private withLang(base: string, lang: string): string {
    try {
      if (!this.isBrowser()) return `${base}?lang=${lang}`;
      const u = new URL(base, window.location.origin);
      u.searchParams.set('lang', lang);
      return u.toString();
    } catch {
      return `${base}?lang=${lang}`;
    }
  }

  /** true si estamos en navegador */
  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
