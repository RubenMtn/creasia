import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';

export type Lang = 'es' | 'en' | 'zh';

/** Diccionario i18n: cada clave puede ser string o un sub-árbol (Dict). */
export interface Dict { [key: string]: string | Dict; }

/* Fallback ES en memoria: muestra español aunque el JSON tarde en llegar */
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
  private readonly dicts = new Map<Lang, Dict>([['es', ES_FALLBACK]]); // ← fallback listo

  constructor() {
    // Precarga español SOLO en navegador; al terminar, notifica para repintar
    if (isPlatformBrowser(this.platformId)) {
      void this.ensureLoaded('es');
    }
  }

  /** Idioma actual (lectura inmediata) */
  get lang(): Lang { return this.currentLang$.value; }

  /** Cambios de idioma (lo usa el pipe impuro si lo necesitaras) */
  get langChanges(): Observable<Lang> { return this.currentLang$.asObservable(); }

  /** Cambia idioma y asegura carga de su JSON */
  async setLang(lang: Lang): Promise<void> {
    await this.ensureLoaded(lang);
    this.currentLang$.next(lang);
  }

  /** Traduce 'a.b.c'; si no existe, devuelve la propia clave */
  t(key: string): string {
    const dict = this.dicts.get(this.lang);
    if (!dict) return key;
    const val = this.resolve(dict, key);
    return val ?? key;
  }

  // -------- internos --------

  /** Fuerza una emisión aunque el idioma no cambie (primer load o recarga) */
  private bump(): void {
    this.currentLang$.next(this.currentLang$.value);
  }

  /** Carga y cachea el JSON del idioma si aún no está */
  private async ensureLoaded(lang: Lang): Promise<void> {
    if (this.dicts.has(lang)) return;
    try {
      const data = await firstValueFrom(this.http.get<Dict>(`assets/i18n/${lang}.json`));
      this.dicts.set(lang, data);
    } catch (err) {
      // Si falla, deja el fallback de ES (u otro si fallara EN/ZH), y log suave
      console.warn('[i18n] No se pudo cargar', lang, err);
      if (!this.dicts.has(lang)) this.dicts.set(lang, {}); // evita reintentos en bucle
    } finally {
      // Si he cargado el idioma actual, notifica para repintar
      if (lang === this.lang) this.bump();
    }
  }

  /** Navega por el árbol usando 'a.b.c' y devuelve el string si existe */
  private resolve(obj: Dict, path: string): string | undefined {
    let cur: string | Dict | undefined = obj;
    for (const part of path.split('.')) {
      if (cur && typeof cur === 'object') cur = (cur as Dict)[part];
      else return undefined;
    }
    return typeof cur === 'string' ? cur : undefined;
  }
}
