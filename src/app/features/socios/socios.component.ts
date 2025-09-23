/* eslint-disable @typescript-eslint/no-explicit-any */
import { SociosService } from '../../services/socios.service';
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-socios',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './socios.component.html',
  styleUrl: './socios.component.scss'
})
export class SociosComponent implements OnInit {
  private static readonly VIEW_STATE_KEY = 'creasia:sociosView';
  private readonly hasWindow = typeof window !== 'undefined';

  showRegisterForm = false;
  showLoginForm = false;
  private socios = inject(SociosService);
  loading = false;

  // Claves i18n (no texto crudo)
  error = '';
  okMsg = '';
  // Nombre opcional para saludar tras login
  greetName: string | null = null;

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

    // Mensajes por ?activation=... sin Router
    this.applyActivationMessageFromURL();
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
    const ARTICLES   = new Set(['la', 'las', 'los', 'lo', 'el', 'le', 'der', 'den', 'de', 'del', 'da', 'do', 'dos', 'das']);
    const isConn = (t?: string) => !!t && CONNECTORS.has(low(t));
    const isArt  = (t?: string) => !!t && ARTICLES.has(low(t));

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

  onRegisterSubmit(event: Event): void {
    event.preventDefault();
    this.clearMessages();

    const form = event.target as HTMLFormElement;
    const nombre = (form.elements.namedItem('registerName') as HTMLInputElement)?.value.trim() || '';
    const apesRaw = (form.elements.namedItem('registerSurname') as HTMLInputElement)?.value || '';
    const email = (form.elements.namedItem('registerEmail') as HTMLInputElement)?.value.trim();
    const password = (form.elements.namedItem('registerPassword') as HTMLInputElement)?.value;
    const optIn = (form.elements.namedItem('registerOptIn') as HTMLInputElement)?.checked ?? false;

    if (!email || !password || password.length < 8) {
      this.error = 'socios.errors.invalidEmailOrPasswordMin8';
      return;
    }

    const { a1: apellido1, a2: apellido2 } = this.splitApellidos(apesRaw);

    this.loading = true;
    this.socios.register(email, password, nombre, apellido1, apellido2, !!optIn).subscribe({
      next: (res) => {
        if (res.ok) {
          this.okMsg = 'socios.register.successCheckEmail';
          this.greetName = null;
          form.reset();
        } else {
          this.error = res.error || 'socios.errors.generic';
        }
      },
      error: (e) => {
        if (e.status === 409) this.error = 'socios.errors.emailAlreadyRegistered';
        else if (e.status === 422) this.error = 'socios.errors.invalidEmailOrPassword';
        else this.error = 'socios.errors.server';
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
      next: (res) => {
        if (res.ok && res.socio) {
          const nombre = (res.socio.nombre || '').trim();
          this.okMsg = 'socios.login.greeting';
          this.greetName = nombre || res.socio.email; // fallback
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

  // Lee ?activation=... desde la URL sin Router, pone claves i18n y limpia el query param
  private applyActivationMessageFromURL(): void {
    if (!this.hasWindow) return;
    const url = new URL(window.location.href);
    const status = url.searchParams.get('activation');
    if (!status) return;

    const okMap: Record<string, string> = {
      ok: 'socios.activation.ok'
    };
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
    } else if (errMap[status]) {
      this.error = errMap[status];
      this.okMsg = '';
      this.greetName = null;
    } else {
      this.error = 'socios.activation.invalid';
      this.okMsg = '';
      this.greetName = null;
    }

    // Forzar vista login (tras activar)
    this.showLoginForm = true;
    this.showRegisterForm = false;
    this.persistViewState();

    // Quitar el parámetro sin recargar
    url.searchParams.delete('activation');
    window.history.replaceState({}, '', url.toString());
  }
}
