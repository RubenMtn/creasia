/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint no-empty: ["error", { "allowEmptyCatch": true }] */
import { TranslationService } from '../../shared/i18n/translation.service';
import { SociosService } from '../../services/socios.service';
import { UserSessionService } from '../../services/user-session.service';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

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
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  // Base para polling (en dev fuerza host público)
  private readonly apiBase = (() => {
    try {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return 'https://creasia.es';
      return ''; // en prod usamos ruta relativa /api/...
    } catch {
      return '';
    }
  })();

  // Vista por defecto: login visible
  showRegisterForm = false;
  showLoginForm = true;

  private socios = inject(SociosService);
  private session = inject(UserSessionService);
  loading = false;

  // Claves i18n (no texto crudo)
  error = '';
  okMsg = '';
  greetName: string | null = null;

  // Polling de activación (para activaciones desde otros dispositivos)
  private activationTimer: any = null;
  private activationDeadline = 0;
  private pendingUid: number | null = null;
  private readonly pollEveryMs = 5000;        // cada 5s
  private readonly pollMaxMs = 2 * 60 * 1000; // máx 2 minutos

  // Listeners
  private onStorage = (e: StorageEvent) => {
    if (!e.key || e.key !== SociosComponent.ACTIVATION_KEY) return;
    this.applyActivationMessageFromStorage();
  };
  private onFocus = () => {
    this.applyActivationMessageFromStorage();
  };

  ngOnInit(): void {
    if (!this.hasWindow) return;

    // Restaurar vista simple: 'register' o 'login' (default 'login')
    const stored = window.sessionStorage.getItem(SociosComponent.VIEW_STATE_KEY);
    if (stored === 'register') {
      this.showRegisterForm = true;
      this.showLoginForm = false;
    } else {
      this.showRegisterForm = false;
      this.showLoginForm = true;
    }
    this.persistViewState();

    // Mensajes via URL (activation/lang)
    this.applyActivationMessageFromURL();

    // Listeners para activación (misma origin) y re-foco
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('focus', this.onFocus);

    // Reanudar polling si hubiera UID pendiente
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

    // Por si ya existe marca en localStorage
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

  private isValidEmail(email: string): boolean {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return re.test(email);
  }

  onRegisterSubmit(event: Event): void {
    event.preventDefault();
    this.clearMessages();
    this.stopActivationPolling();

    const form = event.target as HTMLFormElement;
    const nombre = (form.elements.namedItem('registerName') as HTMLInputElement)?.value.trim() || '';
    const apesRaw = (form.elements.namedItem('registerSurname') as HTMLInputElement)?.value || '';
    const email = (form.elements.namedItem('registerEmail') as HTMLInputElement)?.value.trim() || '';
    const password = (form.elements.namedItem('registerPassword') as HTMLInputElement)?.value || '';
    const optIn = (form.elements.namedItem('registerOptIn') as HTMLInputElement)?.checked ?? false;
    const lang = (localStorage.getItem('creasia:lang') ?? 'es').slice(0, 2) as 'es' | 'en' | 'zh';

    if (!nombre && !email && !password) { this.error = 'socios.errors.fillFields'; return; }
    if (!nombre || !email || !password) { this.error = 'socios.errors.missingRequired'; return; }
    if (!this.isValidEmail(email)) { this.error = 'socios.errors.invalidEmail'; return; }
    if (password.length < 8) { this.error = 'socios.errors.invalidEmailOrPasswordMin8'; return; }

    // Partición simple de apellidos (sin la versión extendida para simplificar)
    const surname = (apesRaw ?? '').trim();
    const [a1, ...rest] = surname.split(/\s+/);
    const apellido1 = a1 || '';
    const apellido2 = rest.length ? rest.join(' ') : null;

    this.loading = true;
    this.socios.register(email, password, nombre, apellido1, apellido2, !!optIn, lang).subscribe({
      next: (res: any) => {
        if (res.ok) {
          this.okMsg = 'socios.register.successCheckEmail';
          this.greetName = null;

          const uidVal = res?.uid;
          if (typeof uidVal === 'number' && uidVal > 0) {
            this.pendingUid = uidVal;
            window.sessionStorage.setItem(SociosComponent.PENDING_UID_KEY, String(uidVal));
            this.startActivationPolling();
          }

          form.reset();
        } else {
          this.error = res.error || 'socios.errors.generic';
        }
      },
      error: (e) => {
        if (e.status === 409) this.error = 'socios.errors.emailAlreadyRegistered';
        else if (e.status === 422) this.error = 'socios.errors.invalidEmailOrPassword';
        else this.error = 'socios.errors.server';
        this.loading = false;
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

    if (!email || !password) { this.error = 'socios.errors.emailAndPasswordRequired'; return; }

    // Si ya está logado con el mismo email, mostrar aviso y no llamar al backend
    const isLogged = localStorage.getItem('creasia:isLoggedIn') === '1';
    const storedEmail = (localStorage.getItem('creasia:userEmail') || '').trim().toLowerCase();
    if (isLogged && storedEmail && email.trim().toLowerCase() === storedEmail) {
      this.error = 'socios.errors.alreadyLoggedIn';
      return;
    }

    this.loading = true;
    this.socios.login(email, password).subscribe({
      next: (res: any) => {
        if (res.ok && res.socio) {
          const nombre = (res.socio.nombre ?? '').trim();
          const displayName = (nombre || res.socio.email || '').trim();
          this.okMsg = 'socios.login.greeting';
          this.greetName = displayName;
          this.session.persistLogin(displayName, { token: '1' });
          try {
            localStorage.setItem('creasia:isLoggedIn', '1');
            localStorage.setItem('creasia:userEmail', (res.socio.email || '').trim());
          } catch { }

          if (this.redirectTimer) clearTimeout(this.redirectTimer);
          this.redirectTimer = setTimeout(() => {
            void this.router.navigateByUrl('/');
          }, 2500);
        } else {
          this.error = res.error || 'socios.errors.invalidCredentials';
          this.greetName = null;
          this.session.clearLogin();
        }
      },
      error: (e) => {
        this.error =
          e.status === 401 ? 'socios.errors.invalidCredentials'
            : e.status === 422 ? 'socios.errors.emailOrPasswordRequired'
              : e.status === 403 ? 'socios.errors.mustActivate'
                : 'socios.errors.server';
        this.loading = false;
        this.session.clearLogin();
      },
      complete: () => (this.loading = false)
    });
  }

  logout(): void {
    this.session.clearLogin();
    try {
      localStorage.setItem('creasia:isLoggedIn', '0');
      localStorage.removeItem('creasia:userEmail');
    } catch { }
  }

  private persistViewState(): void {
    if (!this.hasWindow) return;
    const state = this.showRegisterForm ? 'register' : 'login';
    window.sessionStorage.setItem(SociosComponent.VIEW_STATE_KEY, state);
  }

  private clearMessages(): void {
    this.error = '';
    this.okMsg = '';
    this.greetName = null;
  }

  private applyActivationMessageFromURL(): void {
    if (!this.hasWindow) return;
    const url = new URL(window.location.href);

    // 1) Idioma
    const langParam = url.searchParams.get('lang');
    if (langParam) {
      const lang2 = (langParam.slice(0, 2).toLowerCase() as 'es' | 'en' | 'zh');
      try { localStorage.setItem('creasia:lang', lang2); } catch { }
      void this.i18n.setLang(lang2);
    }

    // 2) Activación
    const status = url.searchParams.get('activation');
    if (!status) {
      if (langParam) {
        url.searchParams.delete('lang');
        window.history.replaceState({}, '', url.toString());
      }
      return;
    }

    const errMap: Record<string, string> = {
      expired: 'socios.activation.expired',
      used: 'socios.activation.used',
      invalid: 'socios.activation.invalid',
      error: 'socios.activation.error'
    };

    if (status === 'ok') {
      // 2.a Intentar autologin con el flujo seguro:
      //     1) refresh (usa cookie HttpOnly) -> 2) me() con HttpClient (interceptor añade Bearer)
      this.auth.refresh()
        .then((ok) => {
          if (!ok) throw new Error('refresh-failed');
          return this.http.get<any>('/api/socios_me.php').toPromise();
        })
        .then((j) => {
          if (j?.ok && j.socio) {
            const displayName = ((j.socio.nombre ?? '') || j.socio.email || '').trim();

            this.okMsg = 'socios.login.greeting';
            this.error = '';
            this.greetName = displayName;

            // Marcas UI previas que ya usabas
            try {
              localStorage.setItem('creasia:isLoggedIn', '1');
              localStorage.setItem('creasia:userEmail', (j.socio.email || '').trim());
            } catch { }
            this.session.persistLogin(displayName, { token: '1' });

            // Forzar vista login (el form se ocultará por el saludo)
            this.showLoginForm = true;
            this.showRegisterForm = false;
            this.persistViewState();

            // Redirección como en login normal
            setTimeout(() => { void this.router.navigateByUrl('/'); }, 2500);
          } else {
            // Activado pero sin sesión (no llegó cookie, etc.)
            this.okMsg = 'socios.activation.ok';
            this.error = '';
            this.greetName = null;
            this.showLoginForm = true;
            this.showRegisterForm = false;
            this.persistViewState();
          }
        })
        .catch(() => {
          // Fallback: mostramos solo "cuenta activada"
          this.okMsg = 'socios.activation.ok';
          this.error = '';
          this.greetName = null;
          this.showLoginForm = true;
          this.showRegisterForm = false;
          this.persistViewState();
        });

    } else if (errMap[status]) {
      this.error = errMap[status];
      this.okMsg = '';
      this.greetName = null;
      this.showLoginForm = true;
      this.showRegisterForm = false;
      this.persistViewState();
    } else {
      this.error = 'socios.activation.invalid';
      this.okMsg = '';
      this.greetName = null;
      this.showLoginForm = true;
      this.showRegisterForm = false;
      this.persistViewState();
    }

    // Forzar vista login (el form se ocultará si hay saludo)
    this.showLoginForm = true;
    this.showRegisterForm = false;
    this.persistViewState();

    // Limpiar la URL
    url.searchParams.delete('activation');
    url.searchParams.delete('autologin');
    if (langParam) url.searchParams.delete('lang');
    window.history.replaceState({}, '', url.toString());
  }


  // Detecta activación via localStorage (misma origin)
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

    window.localStorage.removeItem(SociosComponent.ACTIVATION_KEY);
  }

  // === Polling al backend para detectar activación (también desde OTRO dispositivo) ===
  private startActivationPolling(): void {
    if (!this.hasWindow) return;
    if (!this.pendingUid || this.activationTimer) return;

    this.activationDeadline = Date.now() + this.pollMaxMs;

    const poll = () => {
      if (!this.pendingUid || Date.now() > this.activationDeadline) {
        this.stopActivationPolling();
        return;
      }

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

    poll();
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
