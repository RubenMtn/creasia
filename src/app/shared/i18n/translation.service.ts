/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

export type Lang = 'es' | 'en' | 'zh';

export interface Dict {
  [key: string]: string | Dict;
}

/* -------------------- FALLBACK EN ESPAÑOL -------------------- */
/* Si no existe assets/i18n/es.json o mientras carga, usamos esto.
   Puedes moverlo a un fichero separado si prefieres. */
const ES_FALLBACK: Dict = {
  header: {
    brand: 'CREASIA',
    home: 'Ir al inicio',
    activities: 'ACTIVIDADES',
    partners: 'SOCIOS',
    culture: 'CULTURA',
    gourmet: 'GOURMET PASS',
    trips: 'VIAJES',
    languages: 'IDIOMAS',
    networking: 'NETWORKING',
    consulting: 'CONSULTORÍA',
    legal: 'LEGAL',
  },
  menu: {
    toggle: 'Abrir menú',
    title: 'Menú principal',
    home: 'Inicio',
    animation: 'Ver animación',
    activities: 'ACTIVIDADES',
    partners: 'SOCIOS',
    culture: 'CULTURA',
    gourmet: 'GOURMET PASS',
    trips: 'VIAJES',
    languages: 'IDIOMAS',
    networking: 'NETWORKING',
    consulting: 'CONSULTORÍA',
    legal: 'LEGAL',
  },

  home: {
    title: 'Un puente vivo entre España y China',
    caption: 'Somos una asociación creada por personas que han vivido en China y saben el vértigo de empezar de cero. Aquí lo que importa eres tú: tu curiosidad, tus ganas de aprender y conectar. Nos une construir un puente cultural y profesional, sin importar edad, origen, identidad u orientación.'
  },

  socios: {
    title: 'Ventajas exclusivas, descuentos, invitaciones a eventos, novedades...',
    registerCaption: 'Regístrate con tu email y una contraseña (mínimo 8 caracteres):',
    loginCaption: 'Si ya eres socio registrado de Creasia, accede con tu usuario:',
    loginRedirect: 'Redirigiendo al inicio...',
    actions: {
      register: 'Registro',
      login: 'Accede'
    },
    registerForm: {
      name: 'Nombre',
      surname: 'Apellido/s (opcional)',
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
    },
    register: {
      successCheckEmail: 'Registro solicitado.\n\nRevisa tu correo para activar tu usuario.'
    },
    activation: {
      ok: 'Tu cuenta ha sido activada. Ya puedes iniciar sesión',
      expired: 'El enlace ha caducado. Solicita uno nuevo',
      used: 'Ese enlace ya fue utilizado',
      invalid: 'Enlace de activación inválido',
      error: 'Ha ocurrido un error al activar la cuenta'
    },
    login: {
      greeting: 'Hola '
    },
    errors: {
      invalidEmailOrPasswordMin8: 'Email o contraseña inválidos (mín. 8)',
      invalidEmailOrPassword: 'Email o contraseña inválidos',
      emailAlreadyRegistered: 'Ese email ya está registrado',
      emailAndPasswordRequired: 'Email y contraseña son obligatorios',
      emailOrPasswordRequired: 'Email/contraseña requeridos',
      invalidCredentials: 'Credenciales inválidas',
      mustActivate: 'Debe activar su usuario desde el enlace que enviamos a su correo',
      server: 'Error de servidor. Inténtalo más tarde',
      generic: 'Algo no ha ido bien',
      fillFields: 'Rellene los campos',
      missingRequired: 'Complete los campos obligatorios',
      invalidEmail: 'El email no es válido',
      alreadyLoggedIn: 'Usuario ya logado, observe su nombre en el botón de arriba a la derecha',
    },
    general: {
      loading: 'Cargando…'
    }
  },

  general: {
    loading: 'Cargando…'
  },

  actividades: {
    title: 'Actividades de Creasia',
    section1: {
      title: 'Qué ofrecen las actividades de Creasia',
      body1: 'Diseñamos un calendario que mezcla cultura, formación y comunidad para que vivas China desde Madrid y también in situ. Cada propuesta busca tender puentes entre personas con curiosidad por el país.'
    },
    section2: {
      title: 'Idiomas y clases de chino',
      body1: 'Nuestros programas de idioma van desde sesiones introductorias de mandarín hasta acompañamiento específico para profesionales que necesitan negociar o presentar en China.',
      body2: 'Profesorado nativo combina conversación, talleres de pronunciación y vocabulario práctico para que viajes, estudios o reuniones fluyan con seguridad.'
    },
    section3: {
      title: 'Cultura y tradiciones',
      body1: 'Caligrafía, pintura con tinta, artes marciales y celebraciones del Año Nuevo Chino te conectan con rituales centenarios en un entorno inclusivo.',
      body2: 'Invitamos a artistas, maestros y mediadores culturales que explican el simbolismo detrás de cada práctica y la adaptan a todos los niveles.'
    },
    section4: {
      title: 'Networking con propósito',
      body1: 'Encuentros mensuales, mesas de negocio y reuniones de alumni conectan a miembros de sectores que ya construyen vínculos con China.',
      body2: 'Ampliarás tu red con emprendedores, estudiantes y creativos mientras aprendes a colaborar entre culturas en un ambiente relajado y multilingüe.'
    },
    section5: {
      title: 'Talleres y aprendizaje vivencial',
      body1: 'Clases de cocina, ceremonias de té, cinefórums y laboratorios temáticos ofrecen experiencias prácticas con sabores, sonidos e historias de distintas regiones.',
      body2: 'Los grupos son intencionadamente reducidos para que puedas preguntar, compartir descubrimientos y generar amistades duraderas.'
    }
  },

  consultoria: {
    title: 'Consultoría',
    caption: 'Estrategias hechas a medida para conectar culturas, equipos y negocios entre España y China.',
    body1: 'Analizamos tu proyecto y definimos la estrategia de aterrizaje para que tus objetivos en el mercado chino o español sean viables y sostenibles.',
    body2: 'Trabajamos con una red de especialistas en cultura, comunicación y desarrollo de negocio para acompañarte en cada fase del proceso.',
    service1: 'Diagnóstico y hoja de ruta intercultural.',
    service2: 'Acompañamiento comercial y búsqueda de socios estratégicos.',
    service3: 'Formación in-company para equipos en transición internacional.',
    contact: 'Cuéntanos tu reto y diseñaremos una propuesta personalizada para tu organización.'
  },

  cultura: { title: 'Cultura' },
  idiomas: { title: 'Idiomas' },
  networking: { title: 'Networking' },

  gourmet: {
    title: 'Gourmet Pass',
    leadHighlight: 'Gourmet Pass Creasia',
    leadBody: 'te invita a descubrir la auténtica esencia de la gastronomía china en Madrid con nuestro Pasaporte Gourmet.',
    secondParagraph: 'Con él podrás disfrutar de descuentos exclusivos, menús especiales y hasta platos gratuitos en una selección de restaurantes chinos cuidadosamente elegidos por la asociación Creasia.',
    benefitsIntro: 'El Pasaporte Gourmet es mucho más que una tarjeta de ventajas:',
    benefit1: 'Te invita a viajar por la diversidad de sabores de la cocina regional china sin salir de Madrid.',
    benefit2: 'Te anima a conocer nuevos rincones gastronómicos de la ciudad.',
    benefit3: 'Y te convierte en parte de una comunidad que celebra la cultura oriental en todas sus formas.',
    howTitle: '¿Cómo funciona?',
    step1: 'Consigue tu Gourmet Pass Creasia al hacerte socio: se te enviará en formato electrónico a tu mail.',
    step2: 'Presenta tu pasaporte en los restaurantes adheridos.',
    step3: 'Disfruta de experiencias únicas con beneficios exclusivos.',
    closing1: 'Porque la mejor manera de acercarse a una cultura es saborearla.',
    closing2: 'Con el Pasaporte Gourmet, cada plato será un nuevo capítulo en tu viaje por la tradición y la innovación de la cocina china.',
    altPassport: 'Pasaporte Gourmet Creasia',
    altDining: 'Persona disfrutando del Pasaporte Gourmet',
    altKids: 'Niños compartiendo helado'
  },

  viajes: {
    title: 'Viajes organizados',
    section1: {
      title: 'Viajar con Creasia',
      body1: 'Organizamos viajes en grupo a China que combinan los iconos imprescindibles con rincones que normalmente solo conocen quienes han vivido allí. Cada ruta la curan especialistas que han residido y trabajado en el país, para que cada parada te conecte con la cultura que queremos compartir.'
    },
    section2: {
      title: 'Maravillas que descubrirás',
      body1: 'Desde la Gran Muralla en Mutianyu hasta la Ciudad Prohibida, los pueblos acuáticos de Suzhou y los rascacielos futuristas de Shanghái y Shenzhen, abrimos puertas a los contrastes de China.',
      body2: 'También exploramos barrios artesanos, montañas de té, polos de arte contemporáneo y enclaves Patrimonio Mundial donde tradición e innovación conviven.'
    },
    section3: {
      title: 'Oportunidades y puentes de negocio',
      body1: 'Los viajes de Creasia catalizan alianzas: coordinamos encuentros con emprendedores, cámaras de comercio y espacios de innovación acordes al perfil del grupo.',
      body2: 'Busques proveedores, inversión o inspiración, te ayudamos a interpretar el contexto, entender los códigos culturales y dar seguimiento a los contactos que generes.'
    },
    section4: {
      title: 'Viajar en comunidad Creasia',
      body1: 'Te acompañan coordinadores bilingües, guías locales y un equipo que se ocupa de la logística para que tú te centres en aprender y disfrutar.',
      body2: 'Sesiones previas a la salida, materiales compartidos y networking tras el viaje mantienen unido al grupo y convierten la experiencia en una aventura colaborativa.'
    },
    section5: {
      title: 'Organización y próximos pasos',
      body1: 'Preparamos itinerarios, gestionamos reservas, asesoramos sobre visados y seguros, y adaptamos el programa a necesidades de accesibilidad o alimentación.',
      body2: 'Si quieres sumarte a la próxima salida o proponer un viaje a medida, contacta con nuestro equipo desde el área de socios y te guiaremos personalmente.'
    }
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
/* ------------------ FIN FALLBACK EN ESPAÑOL ------------------ */

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly currentLang$ = new BehaviorSubject<Lang>('es');
  // Registramos el fallback español para que siempre exista.
  private readonly dicts = new Map<Lang, Dict>([['es', ES_FALLBACK]]);

  constructor() {
    // 🔹 PRIORIDAD: idioma en la URL (?lang=en|zh) si estamos en navegador
    const urlLang = this.detectLangFromURL();

    // Idioma inicial: URL -> localStorage/navegador -> 'es'
    const initial = urlLang ?? this.detectInitialLang();

    this.currentLang$.next(initial);

    if (isPlatformBrowser(this.platformId)) {
      // Guardar si vino desde URL, para que persista entre rutas y recargas
      if (urlLang) {
        try { localStorage.setItem('creasia:lang', urlLang); } catch { }
      }
      void this.ensureLoaded(initial);
      this.updateDocumentLang(initial);

      // (Opcional) limpiar el parámetro lang de la URL sin recargar
      if (urlLang) {
        try {
          const u = new URL(window.location.href);
          u.searchParams.delete('lang');
          window.history.replaceState({}, '', u.toString());
        } catch { }
      }
    }
  }

  get lang(): Lang {
    return this.currentLang$.value;
  }

  get langChanges(): Observable<Lang> {
    return this.currentLang$.asObservable();
  }

  async setLang(lang: Lang): Promise<void> {
    lang = this.normalize(lang);
    await this.ensureLoaded(lang);
    this.currentLang$.next(lang);
    this.updateDocumentLang(lang);

    // Persistimos selección (en navegador)
    if (isPlatformBrowser(this.platformId)) {
      try { localStorage.setItem('creasia:lang', lang); } catch { }
    }

    this.bump();
  }

  t(key: string): string {
    const active = this.dicts.get(this.lang);
    const fallback = this.dicts.get('es'); // español como respaldo
    const activeValue = active ? this.resolve(active, key) : undefined;
    if (activeValue !== undefined) return activeValue;
    const fallbackValue = fallback ? this.resolve(fallback, key) : undefined;
    return fallbackValue ?? key;
  }

  /* ───────── helpers ───────── */

  // 👇 NUEVO: prioriza ?lang= de la URL si existe y es válido
  private detectLangFromURL(): Lang | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get('lang');
      const cand = (q || '').slice(0, 2).toLowerCase();
      return this.isSupported(cand) ? (cand as Lang) : null;
    } catch {
      return null;
    }
  }

  private detectInitialLang(): Lang {
    if (!isPlatformBrowser(this.platformId)) return 'es';

    try {
      const saved = localStorage.getItem('creasia:lang');
      if (saved && this.isSupported(saved)) return saved as Lang;
    } catch { }

    // Idioma del navegador
    const nav = (navigator?.language || navigator?.languages?.[0] || 'es')
      .slice(0, 2)
      .toLowerCase();
    if (this.isSupported(nav)) return nav as Lang;

    return 'es';
  }

  private isSupported(v: string | null | undefined): boolean {
    return !!v && ['es', 'en', 'zh'].includes(v.slice(0, 2).toLowerCase());
  }

  private normalize(v: string): Lang {
    const c = (v || 'es').slice(0, 2).toLowerCase();
    return (this.isSupported(c) ? c : 'es') as Lang;
  }

  private updateDocumentLang(lang: Lang): void {
    if (isPlatformBrowser(this.platformId) && typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }

  private bump(): void {
    this.currentLang$.next(this.currentLang$.value);
  }

  private async ensureLoaded(lang: Lang): Promise<void> {
    if (this.dicts.has(lang)) return;

    try {
      const data = await firstValueFrom(this.http.get<Dict>(`assets/i18n/${lang}.json`));
      this.dicts.set(lang, data);
    } catch (err) {
      console.warn('[i18n] No se pudo cargar', lang, err);
      if (!this.dicts.has(lang)) this.dicts.set(lang, {}); // diccionario vacío para no romper
    } finally {
      if (lang === this.lang) this.bump();
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
