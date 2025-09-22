/* eslint-disable @typescript-eslint/no-explicit-any */
//import { Component, inject } from '@angular/core';
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
  loading: any;
  error = '';
  okMsg = '';

  ngOnInit(): void {
    if (!this.hasWindow) {
      return;
    }

    const shouldRestore = window.sessionStorage.getItem('creasia:sociosRestore') === '1';
    const stored = window.sessionStorage.getItem(SociosComponent.VIEW_STATE_KEY);
    let restored = false;

    if (shouldRestore && stored) {
      restored = this.applyViewState(stored);
    }

    window.sessionStorage.removeItem('creasia:sociosRestore');

    if (restored) {
      this.persistViewState();
      return;
    }

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

  // onRegisterSubmit(event: Event): void {
  //   event.preventDefault();
  //   // TODO: hook up to backend when ready
  // }

  onRegisterSubmit(event: Event): void {
    event.preventDefault();
    this.error = '';
    this.okMsg = '';

    const form = event.target as HTMLFormElement;
    const email = (form.elements.namedItem('registerEmail') as HTMLInputElement)?.value.trim();
    const password = (form.elements.namedItem('registerPassword') as HTMLInputElement)?.value;

    if (!email || !password || password.length < 8) {
      this.error = 'Email o contraseña inválidos (mín. 8).';
      return;
    }

    this.loading = true;
    this.socios.register(email, password).subscribe({
      next: (res) => {
        if (res.ok) {
          this.okMsg = 'Registro completado. Revisa tu correo si más adelante añadimos verificación.';
          form.reset(); // limpia el formulario
        } else {
          this.error = res.error || 'Algo no ha ido bien.';
        }
      },
      error: (e) => {
        // Mapea errores comunes
        if (e.status === 409) this.error = 'Ese email ya está registrado.';
        else if (e.status === 422) this.error = 'Email o contraseña inválidos.';
        else this.error = 'Error de servidor. Inténtalo más tarde.';
      },
      complete: () => this.loading = false
    });
  }

  onLoginSubmit(event: Event): void {
    event.preventDefault();
    // TODO: hook up to backend when ready
  }

  private applyViewState(state: string): boolean {
    if (state === 'register') {
      this.showRegisterForm = true;
      this.showLoginForm = false;
      return true;
    }

    if (state === 'login') {
      this.showRegisterForm = false;
      this.showLoginForm = true;
      return true;
    }

    this.showRegisterForm = false;
    this.showLoginForm = false;
    return state === 'default';
  }

  private persistViewState(): void {
    if (!this.hasWindow) {
      return;
    }

    let state = 'default';
    if (this.showRegisterForm) {
      state = 'register';
    } else if (this.showLoginForm) {
      state = 'login';
    }

    window.sessionStorage.setItem(SociosComponent.VIEW_STATE_KEY, state);
  }
}

