import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

export type Lang = 'es' | 'en' | 'zh';

export interface Dict {
  [key: string]: string | Dict;
}

const ES_FALLBACK: Dict = {
  header: {
    brand: 'Creasia',
    partners: 'Socios',
    home: 'Ir al inicio'
  },
  menu: {
    toggle: 'Abrir menú',
    title: 'Menú principal',
    home: 'Inicio',
    animation: 'Ver animación',
    legal: 'Legal'
  },
  links: {
    section1: 'Actividades',
    section2: 'Socios',
    section3: 'Cultura',
    section4: 'Pasaporte gourmet',
    section5: 'Viajes',
    section6: 'Idiomas'
  },
  home: {
    title: 'Un puente vivo entre España y China',
    caption: 'Somos una asociación creada por personas que han vivido en China y saben el vértigo de empezar de cero. Aquí lo que importa eres tú: tu curiosidad, tus ganas de aprender y conectar. Nos une construir un puente cultural y profesional, sin importar edad, origen, identidad u orientación'
  },
  socios: {
    title: 'Ventajas con Creasia y mucho más',
    caption: 'Regístrate con tu email y la contraseña que elijas (mínimo 8 caracteres y algún número) para obtener todos los beneficios que proporciona nuestra asociación: información exclusiva, descuentos, invitación a eventos y mucho más...',
    loginCaption: 'Si ya eres socio de Creasia, accede con tu usuario y contraseña y disfruta de todas las ventajas y novedades que tenemos para ti',
    actions: {
      register: 'Registro',
      login: 'Accede'
    },
    registerForm: {
      email: 'Email',
      password: 'Contraseña',
      optIn: 'Recibir informaciones periódicas',
      submit: 'Registro',
      alreadyRegistered: 'Ya estoy registrado'
    },
    loginForm: {
      email: 'Email',
      password: 'Contraseña',
      submit: 'Acceder',
      notRegistered: 'No estoy registrado'
    }
  }
};

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly currentLang$ = new BehaviorSubject<Lang>('es');
  private readonly dicts = new Map<Lang, Dict>([['es', ES_FALLBACK]]);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.ensureLoaded('es');
    }
  }

  get lang(): Lang {
    return this.currentLang$.value;
  }

  get langChanges(): Observable<Lang> {
    return this.currentLang$.asObservable();
  }

  async setLang(lang: Lang): Promise<void> {
    await this.ensureLoaded(lang);
    this.currentLang$.next(lang);
    this.bump();
  }

  t(key: string): string {
    const active = this.dicts.get(this.lang);
    const fallback = this.dicts.get('es');
    const activeValue = active ? this.resolve(active, key) : undefined;
    if (activeValue !== undefined) {
      return activeValue;
    }

    const fallbackValue = fallback ? this.resolve(fallback, key) : undefined;
    return fallbackValue ?? key;
  }

  private bump(): void {
    this.currentLang$.next(this.currentLang$.value);
  }

  private async ensureLoaded(lang: Lang): Promise<void> {
    if (this.dicts.has(lang)) {
      return;
    }

    try {
      const data = await firstValueFrom(this.http.get<Dict>(`assets/i18n/${lang}.json`));
      this.dicts.set(lang, data);
    } catch (err) {
      console.warn('[i18n] No se pudo cargar', lang, err);
      if (!this.dicts.has(lang)) {
        this.dicts.set(lang, {});
      }
    } finally {
      if (lang === this.lang) {
        this.bump();
      }
    }
  }

  private resolve(obj: Dict, path: string): string | undefined {
    let current: string | Dict | undefined = obj;
    for (const part of path.split('.')) {
      if (current && typeof current === 'object') {
        current = (current as Dict)[part];
      } else {
        return undefined;
      }
    }

    return typeof current === 'string' ? current : undefined;
  }
}

