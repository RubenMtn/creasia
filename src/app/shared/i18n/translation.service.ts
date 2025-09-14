import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';

export type Lang = 'es' | 'en' | 'zh';

/** Diccionario i18n: cada clave puede ser string o un sub-árbol (Dict). */
export interface Dict { [key: string]: string | Dict; }

/* Fallback ES en memoria (si aún no cargó el JSON, nunca verás “keys”) */
const ES_FALLBACK: Dict = {
  links: {
    section1: 'Actividades',
    section2: 'Socios',
    section3: 'Cultura',
    section4: 'Idiomas',
    section5: 'Viajes',
    section6: 'Puntos gourmet'
  },
  home: {
    caption: 'Una comunidad apasionada por el descubrimiento, el aprendizaje y el aporte entre culturas'
  }
};

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly currentLang$ = new BehaviorSubject<Lang>('es');
  private readonly dicts = new Map<Lang, Dict>([['es', ES_FALLBACK]]);

  constructor() {
    // Precarga español SOLO en navegador; al terminar, notifica para repintar
    if (isPlatformBrowser(this.platformId)) {
      void this.ensureLoaded('es');
    }
  }

  get lang(): Lang { return this.currentLang$.value; }
  get langChanges(): Observable<Lang> { return this.currentLang$.asObservable(); }

  async setLang(lang: Lang): Promise<void> {
    await this.ensureLoaded(lang);       // carga si falta
    this.currentLang$.next(lang);        // emite cambio de idioma
    this.bump();                         // fuerza reevaluación inmediata (por si hay coalescing)
  }

  /** Traduce 'a.b.c'; si no existe en el idioma activo, cae a 'es'. */
  t(key: string): string {
    const active = this.dicts.get(this.lang);
    const esDict = this.dicts.get('es');
    const valActive = active ? this.resolve(active, key) : undefined;
    if (valActive !== undefined) return valActive;
    const valEs = esDict ? this.resolve(esDict, key) : undefined;
    return valEs ?? key;
  }

  // -------- internos --------

  private bump(): void {
    // Re-emite el valor actual para que pipes/plantillas impuras reevaluen sin esperar a otro evento
    this.currentLang$.next(this.currentLang$.value);
  }

  private async ensureLoaded(lang: Lang): Promise<void> {
    if (this.dicts.has(lang)) return;
    try {
      const data = await firstValueFrom(this.http.get<Dict>(`assets/i18n/${lang}.json`));
      this.dicts.set(lang, data);
    } catch (err) {
      console.warn('[i18n] No se pudo cargar', lang, err);
      if (!this.dicts.has(lang)) this.dicts.set(lang, {}); // evita reintentos en bucle
    } finally {
      // si cargamos el idioma que ya está activo, avisa para repintar
      if (lang === this.lang) this.bump();
    }
  }

  private resolve(obj: Dict, path: string): string | undefined {
    let cur: string | Dict | undefined = obj;
    for (const part of path.split('.')) {
      if (cur && typeof cur === 'object') cur = (cur as Dict)[part];
      else return undefined;
    }
    return typeof cur === 'string' ? cur : undefined;
  }
}
