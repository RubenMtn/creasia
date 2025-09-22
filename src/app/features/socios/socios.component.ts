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
  error = '';
  okMsg = '';

  ngOnInit(): void {
    if (!this.hasWindow) return;

    const shouldRestore = window.sessionStorage.getItem('creasia:sociosRestore') === '1';
    const stored = window.sessionStorage.getItem(SociosComponent.VIEW_STATE_KEY);
    let restored = false;

    if (shouldRestore && stored) restored = this.applyViewState(stored);

    window.sessionStorage.removeItem('creasia:sociosRestore');

    if (restored) { this.persistViewState(); return; }

    this.showRegisterForm = false;
    this.showLoginForm = false;
    window.sessionStorage.removeItem(SociosComponent.VIEW_STATE_KEY);
    this.persistViewState();
  }

  openRegister(): void {
    this.showRegisterForm = true;
    this.showLoginForm = false;
    this.persistViewState();
  }

  openLogin(): void {
    this.showLoginForm = true;
    this.showRegisterForm = false;
    this.persistViewState();
  }

  // ⬇️ Helper para partir apellidos con partículas extendidas y regla del guion
  private splitApellidos(input: string): { a1: string; a2: string | null } {
    // Normaliza separadores: / . & + => espacio (el guion "-" se conserva)
    const text = (input ?? '')
      .replace(/[\\/.&+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return { a1: '', a2: null };

    const tokens = text.split(' ');
    const low = (s: string) => s.toLowerCase();

    // Conectores (partículas que pueden preceder al “núcleo” del apellido)
    const CONNECTORS = new Set(['de', 'del', 'van', 'von', 'da', 'do', 'dos', 'das', 'di', 'du']);
    // Artículos/partículas que pueden ir tras el conector (permitimos encadenar varias: der/den/de/la/los/las/…)
    const ARTICLES = new Set(['la', 'las', 'los', 'lo', 'el', 'le', 'der', 'den', 'de', 'del', 'da', 'do', 'dos', 'das']);

    const isConn = (t?: string) => !!t && CONNECTORS.has(low(t));
    const isArt = (t?: string) => !!t && ARTICLES.has(low(t));

    // --- 1) REGLA DEL GUION: si existe un token con "-", ese bloque forma un apellido completo.
    //     Se le suman (si las hay) partículas inmediatamente previas (conector + artículos).
    const h = tokens.findIndex(t => t.includes('-'));
    if (h !== -1 && tokens.length > 1) {
      // Extiende hacia atrás: ... [conector] [artículo?] [núcleo-con-guion]
      let start = h;
      // Caso conector + 2 artículos (p. ej. "de la", "van der", "von der")
      if (h - 2 >= 0 && isConn(tokens[h - 2]) && isArt(tokens[h - 1])) start = h - 2;
      // Caso solo conector inmediato
      else if (h - 1 >= 0 && isConn(tokens[h - 1])) start = h - 1;

      const hyphenSurname = tokens.slice(start, h + 1).join(' ');
      const otherTokens = [...tokens.slice(0, start), ...tokens.slice(h + 1)];
      const otherSurname = otherTokens.join(' ') || null;

      // Si el bloque con guion está al inicio, es a1; si no, es a2
      if (start === 0) return { a1: hyphenSurname, a2: otherSurname };
      return { a1: otherSurname ?? '', a2: hyphenSurname };
    }

    // --- 2) Empieza por conector (de/del/van/von/da/...) → conector + (artículos encadenados) + núcleo forman apellido1
    if (isConn(tokens[0])) {
      let i = 1;
      // encadena artículos (p. ej. "de la", "van der", "von den")
      while (i < tokens.length && isArt(tokens[i])) i += 1;
      if (i >= tokens.length) return { a1: tokens.join(' '), a2: null }; // fallback
      const cut = i + 1; // incluye la palabra núcleo
      const a1 = tokens.slice(0, cut).join(' ');
      const a2 = tokens.slice(cut).join(' ') || null;
      return { a1, a2 };
    }

    // --- 3) Patrón "X conector ..." → el conector pertenece al apellido1 (con artículos encadenados)
    if (isConn(tokens[1])) {
      let i = 2;
      while (i < tokens.length && isArt(tokens[i])) i += 1;
      if (i >= tokens.length) return { a1: tokens.join(' '), a2: null };
      const cut = i + 1; // incluye la palabra núcleo
      const a1 = tokens.slice(0, cut).join(' ');
      const a2 = tokens.slice(cut).join(' ') || null;
      return { a1, a2 };
    }

    // --- 4) Por defecto: primer token = apellido1, resto = apellido2
    const a1 = tokens[0];
    const a2 = tokens.slice(1).join(' ') || null;
    return { a1, a2 };
  }

  onRegisterSubmit(event: Event): void {
    event.preventDefault();
    this.error = '';
    this.okMsg = '';

    const form = event.target as HTMLFormElement;
    const nombre = (form.elements.namedItem('registerName') as HTMLInputElement)?.value.trim() || '';
    const apesRaw = (form.elements.namedItem('registerSurname') as HTMLInputElement)?.value || '';
    const email = (form.elements.namedItem('registerEmail') as HTMLInputElement)?.value.trim();
    const password = (form.elements.namedItem('registerPassword') as HTMLInputElement)?.value;
    const optIn = (form.elements.namedItem('registerOptIn') as HTMLInputElement)?.checked ?? false;

    if (!email || !password || password.length < 8) {
      this.error = 'Email o contraseña inválidos (mín. 8).';
      return;
    }

    const { a1: apellido1, a2: apellido2 } = this.splitApellidos(apesRaw);

    this.loading = true;
    this.socios.register(email, password, nombre, apellido1, apellido2, !!optIn).subscribe({
      next: (res) => {
        if (res.ok) {
          this.okMsg = 'Registro completado. Revisa tu correo si más adelante añadimos verificación.';
          form.reset();
        } else {
          this.error = res.error || 'Algo no ha ido bien.';
        }
      },
      error: (e) => {
        if (e.status === 409) this.error = 'Ese email ya está registrado.';
        else if (e.status === 422) this.error = 'Email o contraseña inválidos.';
        else this.error = 'Error de servidor. Inténtalo más tarde.';
      },
      complete: () => (this.loading = false)
    });
  }

  onLoginSubmit(event: Event): void {
    event.preventDefault();
    this.error = '';
    this.okMsg = ''; // Mensaje hola!

    const form = event.target as HTMLFormElement;
    const email = (form.elements.namedItem('loginEmail') as HTMLInputElement)?.value.trim();
    const password = (form.elements.namedItem('loginPassword') as HTMLInputElement)?.value;

    if (!email || !password) {
      this.error = 'Email y contraseña son obligatorios.';
      return;
    }

    this.loading = true;
    this.socios.login(email, password).subscribe({
      next: (res) => {
        if (res.ok && res.socio) {
          const nombre = (res.socio.nombre || '').trim();
          const greetName = nombre || res.socio.email; // fallback si no hay nombre
          this.okMsg = `Hola ${greetName}!`; // NUEVO, pte cambiar idiomas
          // console.log('Login OK', res.socio);
        } else {
          this.error = res.error || 'Credenciales inválidas';
        }
      },
      error: (e) => {
        this.error = e.status === 401 ? 'Credenciales inválidas'
          : e.status === 422 ? 'Email/contraseña requeridos'
            : 'Error de servidor. Inténtalo más tarde';
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
}
