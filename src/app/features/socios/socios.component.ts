import { Component, OnInit } from '@angular/core';
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

  onRegisterSubmit(event: Event): void {
    event.preventDefault();
    // TODO: hook up to backend when ready
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

