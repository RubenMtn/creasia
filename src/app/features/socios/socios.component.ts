import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../shared/i18n/t.pipe';

@Component({
  selector: 'app-socios',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './socios.component.html',
  styleUrl: './socios.component.scss'
})
export class SociosComponent {
  showRegisterForm = false;
  showLoginForm = false;

  openRegister(): void {
    this.showRegisterForm = true;
    this.showLoginForm = false;
  }

  openLogin(): void {
    this.showLoginForm = true;
    this.showRegisterForm = false;
  }

  onRegisterSubmit(event: Event): void {
    event.preventDefault();
    // TODO: hook up to backend when ready
  }

  onLoginSubmit(event: Event): void {
    event.preventDefault();
    // TODO: hook up to backend when ready
  }
}
