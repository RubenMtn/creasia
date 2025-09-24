/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
import { TranslationService } from '../../shared/i18n/translation.service'
import { SociosService } from '../../services/socios.service';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';
import { Router } from '@angular/router';


@Component({
  selector: 'app-socios',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './socios.component.html',
  styleUrl: './socios.component.scss'
})
export class SociosComponent implements OnInit, OnDestroy {
  private static readonly VIEW_STATE_KEY = 'creasia:sociosView';
  private static readonly ACTIVATION_KEY = 'creasia:activation';
  private static readonly PENDING_UID_KEY = 'creasia:pendingUid';
  private readonly hasWindow = typeof window !== 'undefined';
  private readonly i18n = inject(TranslationService);
  private router = inject(Router);
  private redirectTimer: any = null;


  // ✅ NUEVO: base para llamadas del polling (evita ir a localhost:4200 en dev)
  private readonly apiBase = (() => {
    try {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return 'https://creasia.es';
      return ''; // en prod usamos ruta relativa /api/...
    } catch {
      return '';
    }
  })();

  showRegisterForm = false;
  showLoginForm = false;
  private socios = inject(SociosService);
  loading = false;

  // Claves i18n (no texto crudo)
  error = '';
  okMsg = '';
  // Nombre opcional para saludar tras login
  greetName: string | null = null;

  // --- Polling activación (para activación desde otro dispositivo) ---
  private activationTimer: any = null;
  private activationDeadline = 0;
  private pendingUid: number | null = null;
  private readonly pollEveryMs = 5000;          // cada 5s
  private readonly pollMaxMs = 2 * 60 * 1000; // máx 2 minutos

  // Listeners como propiedades flecha para poder quitarlos en ngOnDestroy
  private onStorage = (e: StorageEvent) => {
    if (!e.key || e.key !== SociosComponent.ACTIVATION_KEY) return;
    this.applyActivationMessageFromStorage();
  };
  private onFocus = () => {
    this.applyActivationMessageFromStorage();
  };

  ngOnInit(): void {
    if (!this.hasWindow) return;

    const shouldRestore = window.sessionStorage.getItem('creasia:sociosRestore') === '1';
    const stored = window.sessionStorage.getItem(SociosComponent.VIEW_STATE_KEY);
    let restored = false;

    if (shouldRestore && stored) restored = this.applyViewState(stored);

    window.sessionStorage.removeItem('creasia:sociosRestore');

    if (restored) {
      this.persistViewState();
    } else {
      this.showRegisterForm = false;
      this.showLoginForm = false;
      window.sessionStorage.removeItem(SociosComponent.VIEW_STATE_KEY);
      this.persistViewState();
    }

    // 1) Mensajes por ?activation=... (si venimos redirigidos)
    this.applyActivationMessageFromURL();

    // 2) Suscripción a cambios en localStorage (si se activó en otra pestaña del MISMO navegador)
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('focus', this.onFocus);

    // 3) Reanudar polling si había un UID pendiente en esta sesión
    const pending = window.sessionStorage.getItem(SociosComponent.PENDING_UID_KEY);
    if (pending) {
      const uid = parseInt(pending, 10);
      if (!Number.isNaN(uid) && uid > 0) {
        this.pendingUid = uid;
        this.startActivationPolling();
      } else {
        window.sessionStorage.removeItem(SociosComponent.PENDING_UID_KEY);
      }
    }

    // 4) Por si ya existe la marca (activado hace un momento en otra pestaña)
    this.applyActivationMessageFromStorage();
  }

  ngOnDestroy(): void {
    if (!this.hasWindow) return;
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('focus', this.onFocus);
    this.stopActivationPolling();

    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = null;
    }
  }

  openRegister(): void {
    this.clearMessages();
    this.showRegisterForm = true;
    this.showLoginForm = false;
    this.persistViewState();
  }

  openLogin(): void {
    this.clearMessages();
    this.showLoginForm = true;
    this.showRegisterForm = false;
    this.persistViewState();
  }

  // ⬇️ Helper para partir apellidos con partículas extendidas y regla del guion
  private splitApellidos(input: string): { a1: string; a2: string | null } {
    const text = (input ?? '')
      .replace(/[\\/.&+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return { a1: '', a2: null };

    const tokens = text.split(' ');
    const low = (s: string) => s.toLowerCase();
    const CONNECTORS = new Set(['de', 'del', 'van', 'von', 'da', 'do', 'dos', 'das', 'di', 'du']);
    const ARTICLES = new Set(['la', 'las', 'los', 'lo', 'el', 'le', 'der', 'den', 'de', 'del', 'da', 'do', 'dos', 'das']);
    const isConn = (t?: string) => !!t && CONNECTORS.has(low(t));
    const isArt = (t?: string) => !!t && ARTICLES.has(low(t));

    const h = tokens.findIndex(t => t.includes('-'));
    if (h !== -1 && tokens.length > 1) {
      let start = h;
      if (h - 2 >= 0 && isConn(tokens[h - 2]) && isArt(tokens[h - 1])) start = h - 2;
      else if (h - 1 >= 0 && isConn(tokens[h - 1])) start = h - 1;

      const hyphenSurname = tokens.slice(start, h + 1).join(' ');
      const otherTokens = [...tokens.slice(0, start), ...tokens.slice(h + 1)];
      const otherSurname = otherTokens.join(' ') || null;

      if (start === 0) return { a1: hyphenSurname, a2: otherSurname };
      return { a1: otherSurname ?? '', a2: hyphenSurname };
    }

    if (isConn(tokens[0])) {
      let i = 1;
      while (i < tokens.length && isArt(tokens[i])) i += 1;
      if (i >= tokens.length) return { a1: tokens.join(' '), a2: null };
      const cut = i + 1;
      const a1 = tokens.slice(0, cut).join(' ');
      const a2 = tokens.slice(cut).join(' ') || null;
      return { a1, a2 };
    }

    if (isConn(tokens[1])) {
      let i = 2;
      while (i < tokens.length && isArt(tokens[i])) i += 1;
      if (i >= tokens.length) return { a1: tokens.join(' '), a2: null };
      const cut = i + 1;
      const a1 = tokens.slice(0, cut).join(' ');
      const a2 = tokens.slice(cut).join(' ') || null;
      return { a1, a2 };
    }

    const a1 = tokens[0];
    const a2 = tokens.slice(1).join(' ') || null;
    return { a1, a2 };
  }

  private isValidEmail(email: string): boolean {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return re.test(email);
  }

  onRegisterSubmit(event: Event): void {
    event.preventDefault();
    this.clearMessages();
    this.stopActivationPolling(); // por si hubiera uno pendiente de un intento anterior

    const form = event.target as HTMLFormElement;
    const nombre = (form.elements.namedItem('registerName') as HTMLInputElement)?.value.trim() || '';
    const apesRaw = (form.elements.namedItem('registerSurname') as HTMLInputElement)?.value || '';
    const email = (form.elements.namedItem('registerEmail') as HTMLInputElement)?.value.trim() || '';
    const password = (form.elements.namedItem('registerPassword') as HTMLInputElement)?.value || '';
    const optIn = (form.elements.namedItem('registerOptIn') as HTMLInputElement)?.checked ?? false;
    const lang = (localStorage.getItem('creasia:lang') ?? 'es').slice(0, 2) as 'es' | 'en' | 'zh';

    // 1) Nada relleno
    if (!nombre && !email && !password) {
      this.error = 'socios.errors.fillFields';
      return;
    }

    // 2) Falta algún obligatorio (apellido es opcional)
    if (!nombre || !email || !password) {
      this.error = 'socios.errors.missingRequired';
      return;
    }

    // 3) Email no válido
    if (!this.isValidEmail(email)) {
      this.error = 'socios.errors.invalidEmail';
      return;
    }

    // 4) Password corta
    if (password.length < 8) {
      this.error = 'socios.errors.invalidEmailOrPasswordMin8';
      return;
    }

    const { a1: apellido1, a2: apellido2 } = this.splitApellidos(apesRaw);

    this.loading = true;
    this.socios.register(email, password, nombre, apellido1, apellido2, !!optIn, lang).subscribe({
      next: (res: any) => {
        if (res.ok) {
          this.okMsg = 'socios.register.successCheckEmail';
          this.greetName = null;

          // Guardar UID y empezar polling si el backend lo devuelve
          const uidVal = res?.uid;
          if (typeof uidVal === 'number' && uidVal > 0) {
            this.pendingUid = uidVal;
            window.sessionStorage.setItem(SociosComponent.PENDING_UID_KEY, String(uidVal));
            this.startActivationPolling();
          }

          (form as HTMLFormElement).reset();
        } else {
          this.error = res.error || 'socios.errors.generic';
        }
      },
      error: (e) => {
        if (e.status === 409) this.error = 'socios.errors.emailAlreadyRegistered';
        else if (e.status === 422) this.error = 'socios.errors.invalidEmailOrPassword';
        else this.error = 'socios.errors.server';
        this.loading = false; // reactivar botón tras error
      },
      complete: () => (this.loading = false)
    });
  }

  onLoginSubmit(event: Event): void {
    event.preventDefault();
    this.clearMessages();

    const form = event.target as HTMLFormElement;
    const email = (form.elements.namedItem('loginEmail') as HTMLInputElement)?.value.trim();
    const password = (form.elements.namedItem('loginPassword') as HTMLInputElement)?.value;

    if (!email || !password) {
      this.error = 'socios.errors.emailAndPasswordRequired';
      return;
    }

    this.loading = true;
    this.socios.login(email, password).subscribe({
      next: (res: any) => {
        if (res.ok && res.socio) {
          const nombre = (res.socio.nombre || '').trim();
          this.okMsg = 'socios.login.greeting';
          this.greetName = nombre || res.socio.email; // fallback

          // 🔁 por si el usuario hace doble login muy rápido
          if (this.redirectTimer) {
            clearTimeout(this.redirectTimer);
            this.redirectTimer = null;
          }

          // ⏳ Redirige al home a los 2.5s
          this.redirectTimer = setTimeout(() => {
            // Con Router (recomendado):
            this.router.navigateByUrl('/');

            // Si por algún motivo no hay routing configurado:
            // window.location.href = '/';
          }, 2500);
        } else {
          this.error = res.error || 'socios.errors.invalidCredentials';
          this.greetName = null;
        }

      },
      error: (e) => {
        this.error =
          e.status === 401 ? 'socios.errors.invalidCredentials'
            : e.status === 422 ? 'socios.errors.emailOrPasswordRequired'
              : e.status === 403 ? 'socios.errors.mustActivate'
                : 'socios.errors.server';
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }

  private applyViewState(state: string): boolean {
    if (state === 'register') { this.showRegisterForm = true; this.showLoginForm = false; return true; }
    if (state === 'login') { this.showRegisterForm = false; this.showLoginForm = true; return true; }
    this.showRegisterForm = false; this.showLoginForm = false; return state === 'default';
  }

  private persistViewState(): void {
    if (!this.hasWindow) return;
    let state = 'default';
    if (this.showRegisterForm) state = 'register';
    else if (this.showLoginForm) state = 'login';
    window.sessionStorage.setItem(SociosComponent.VIEW_STATE_KEY, state);
  }

  private clearMessages(): void {
    this.error = '';
    this.okMsg = '';
    this.greetName = null;
  }

 // Lee ?lang=... SIEMPRE, y opcionalmente ?activation=...
private applyActivationMessageFromURL(): void {
  if (!this.hasWindow) return;
  const url = new URL(window.location.href);

  // 1) Aplicar idioma si viene por query (independiente de activation)
  const langParam = url.searchParams.get('lang');
  if (langParam) {
    const lang2 = (langParam.slice(0, 2).toLowerCase() as 'es' | 'en' | 'zh');
    // setLang es async; no bloqueamos la UI
    try { localStorage.setItem('creasia:lang', lang2); } catch {}
    // si tienes TranslationService inyectado:
    //   private readonly i18n = inject(TranslationService);
    void this.i18n.setLang(lang2);
  }

  // 2) Si no hay activation, solo limpia el parámetro lang y sal
  const status = url.searchParams.get('activation');
  if (!status) {
    if (langParam) {
      url.searchParams.delete('lang');
      window.history.replaceState({}, '', url.toString());
    }
    return;
  }

  // 3) Procesar activation como ya hacías
  const okMap: Record<string, string> = { ok: 'socios.activation.ok' };
  const errMap: Record<string, string> = {
    expired: 'socios.activation.expired',
    used: 'socios.activation.used',
    invalid: 'socios.activation.invalid',
    error: 'socios.activation.error'
  };

  if (okMap[status]) {
    this.okMsg = okMap[status];
    this.error = '';
    this.greetName = null;
    this.stopActivationPolling();
  } else if (errMap[status]) {
    this.error = errMap[status];
    this.okMsg = '';
    this.greetName = null;
    this.stopActivationPolling();
  } else {
    this.error = 'socios.activation.invalid';
    this.okMsg = '';
    this.greetName = null;
    this.stopActivationPolling();
  }

  // Forzar vista login (como ya hacías)
  this.showLoginForm = true;
  this.showRegisterForm = false;
  this.persistViewState();

  // 4) Limpia ambos params de la URL
  url.searchParams.delete('activation');
  if (langParam) url.searchParams.delete('lang');
  window.history.replaceState({}, '', url.toString());
}


  // Detecta activación si se hizo en otra pestaña (misma origin) mediante localStorage
  private applyActivationMessageFromStorage(): void {
    if (!this.hasWindow) return;
    const status = window.localStorage.getItem(SociosComponent.ACTIVATION_KEY);
    if (!status) return;

    if (status === 'ok') {
      this.okMsg = 'socios.activation.ok';
      this.error = '';
      this.greetName = null;
      this.showLoginForm = true;
      this.showRegisterForm = false;
      this.persistViewState();
      this.stopActivationPolling();
    } else if (['expired', 'used', 'invalid', 'error'].includes(status)) {
      this.error = `socios.activation.${status}`;
      this.okMsg = '';
      this.greetName = null;
      this.showLoginForm = true;
      this.showRegisterForm = false;
      this.persistViewState();
      this.stopActivationPolling();
    }

    // Consumir la marca para no repetir
    window.localStorage.removeItem(SociosComponent.ACTIVATION_KEY);
  }

  // === Polling al backend para detectar activación aunque sea desde OTRO dispositivo ===
  private startActivationPolling(): void {
    if (!this.hasWindow) return;
    if (!this.pendingUid || this.activationTimer) return;

    this.activationDeadline = Date.now() + this.pollMaxMs;

    const poll = () => {
      if (!this.pendingUid || Date.now() > this.activationDeadline) {
        this.stopActivationPolling();
        return;
      }

      // ✅ Aquí forzamos el host correcto en dev (localhost -> creasia.es)
      const url = `${this.apiBase}/api/socios_activation_status.php?uid=${this.pendingUid}`;

      fetch(url, {
        method: 'GET',
        credentials: 'omit',
        headers: { 'Accept': 'application/json' }
      })
        .then(r => r.ok ? r.json() : null)
        .then((j: any) => {
          if (j && j.ok && j.activated === true) {
            this.okMsg = 'socios.activation.ok';
            this.error = '';
            this.greetName = null;
            this.showLoginForm = true;
            this.showRegisterForm = false;
            this.persistViewState();
            this.stopActivationPolling();
          }
        })
        .catch(() => { /* silencioso */ });
    };

    poll(); // primer intento inmediato
    this.activationTimer = window.setInterval(poll, this.pollEveryMs);
  }

  private stopActivationPolling(): void {
    if (this.activationTimer) {
      window.clearInterval(this.activationTimer);
      this.activationTimer = null;
    }
    this.pendingUid = null;
    if (this.hasWindow) {
      window.sessionStorage.removeItem(SociosComponent.PENDING_UID_KEY);
    }
  }
}
