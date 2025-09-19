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
    home: 'Ir al inicio',
    activities: 'ACTIVIDADES',
    culture: 'CULTURA',
    trips: 'VIAJES',
    gourmet: 'GOURMET PASS',
    legal: 'LEGAL',
    languages: 'IDIOMAS',
    networking: 'NETWORKING'
  },
  menu: {
    toggle: 'Abrir menú',
    title: 'Menú principal',
    home: 'Inicio',
    animation: 'Ver animación',
    activities: 'ACTIVIDADES',
    culture: 'CULTURA',
    trips: 'VIAJES',
    gourmet: 'GOURMET PASS',
    legal: 'LEGAL',
    languages: 'IDIOMAS',
    networking: 'NETWORKING'
  },
  links: {
    section1: 'Actividades',
    section2: 'Socios',
    section3: 'Cultura',
    section4: 'Gourmet Pass',
    section5: 'Viajes',
    section6: 'Idiomas',
    section7: 'Networking'
  },
  home: {
    title: 'Un puente vivo entre España y China',
    caption: 'Somos una asociación creada por personas que han vivido en China y saben el vértigo de empezar de cero. Aquí lo que importa eres tú: tu curiosidad, tus ganas de aprender y conectar. Nos une construir un puente cultural y profesional, sin importar edad, origen, identidad u orientación.'
  },
  socios: {
    title: 'Ventajas con Creasia y mucho más',
    caption: 'Regístrate con tu email y una contraseña para obtener todos los beneficios que proporciona nuestra asociación: información exclusiva, descuentos, invitaciones a eventos y mucho más...',
    loginCaption: 'Si ya eres socio de Creasia, accede con tu usuario y contraseña y disfruta de todas las ventajas y novedades que tenemos para ti.',
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
  },
  actividades: {
    title: 'Actividades'
  },
  cultura: {
    title: 'Cultura'
  },
  viajes: {
    title: 'Viajes'
  },
  idiomas: {
    title: 'Idiomas'
  },
  networking: {
    title: 'Networking'
  },
  gourmet: {
    title: 'Gourmet Pass'
  },
  legal: {
    title: 'Aviso legal',
    section1: {
      title: '1. Información General',
      body: 'Creasia es una entidad dedicada a la organización de actividades culturales, viajes, formación y consultoría entre España y China. El acceso y uso de este sitio web implica la aceptación de las presentes condiciones legales.'
    },
    section2: {
      title: '2. Protección de Datos Personales',
      body1: 'Los datos personales facilitados a través de los formularios de Creasia serán tratados de acuerdo con la normativa vigente en materia de protección de datos (Reglamento UE 2016/679 y Ley Orgánica 3/2018).',
      body2: 'La finalidad del tratamiento es la gestión de la relación con los usuarios, el envío de información sobre actividades, novedades y servicios de Creasia, así como la atención de consultas. Los datos no serán cedidos a terceros salvo obligación legal.',
      body3Before: 'El usuario puede ejercer sus derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad mediante la sección ',
      contactLink: 'Contáctanos',
      body3After: '.',
      body4: 'Si desea darse de baja de nuestras comunicaciones, también puede solicitarlo a través de la misma página de contacto.'
    },
    section3: {
      title: '3. Exención de Responsabilidad sobre Viajes y Actividades',
      body1: 'Creasia actúa como intermediario en la organización de viajes y actividades culturales, colaborando con proveedores externos. No se responsabiliza de posibles incidencias, retrasos, cancelaciones, cambios de itinerario, accidentes, pérdidas o daños que puedan producirse durante la realización de los viajes o actividades.',
      body2: 'Los participantes son responsables de cumplir con los requisitos legales y sanitarios necesarios para viajar, así como de contratar los seguros pertinentes.'
    },
    section4: {
      title: '4. Contenidos y Propiedad Intelectual',
      body1: 'Todos los contenidos de este sitio web, incluyendo textos, imágenes, logotipos y diseños, son propiedad de Creasia o de sus respectivos titulares y están protegidos por la legislación de propiedad intelectual.',
      body2: 'Queda prohibida la reproducción, distribución o comunicación pública de los contenidos sin autorización expresa.'
    },
    section5: {
      title: '5. Enlaces Externos',
      body1: 'Este sitio web puede contener enlaces a páginas externas. Creasia no se responsabiliza del contenido, exactitud o funcionamiento de dichas páginas, ni de los posibles daños que puedan derivarse del acceso a las mismas.'
    },
    section6: {
      title: '6. Actualización y Modificación',
      body1: 'Creasia se reserva el derecho de modificar, actualizar o eliminar cualquier información contenida en este sitio web, así como la presente política legal, en cualquier momento y sin previo aviso.'
    },
    section7: {
      title: '7. Legislación Aplicable y Jurisdicción',
      body1: 'Las presentes condiciones legales se rigen por la legislación española. Para cualquier controversia derivada del acceso o uso de este sitio web, las partes se someten a los Juzgados y Tribunales de Madrid, salvo que la ley disponga lo contrario.'
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




















