/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-empty */
// Servicio de sesión del lado cliente (UI).
// - Mantiene señales: isLoggedIn, userName, userInitials.
// - Sincroniza con storage y reacciona a eventos globales.
// - Ahora: onExternalUpdate soporta CustomEvent con detail.logged para aplicar estado directo.

import { Injectable, OnDestroy, signal } from '@angular/core';

type AuthTokenPersistence = 'session' | 'both' | 'none';

@Injectable({ providedIn: 'root' })
export class UserSessionService implements OnDestroy {
  private static readonly USER_NAME_KEY = 'creasia:userName';
  private static readonly LOGIN_FLAG_KEY = 'creasia:isLoggedIn';
  private static readonly AUTH_TOKEN_KEY = 'authToken';

  readonly userName = signal<string | null>(null);
  readonly userInitials = signal<string | null>(null);
  readonly isLoggedIn = signal(false);

  private readonly hasWindow = typeof window !== 'undefined';
  private readonly hasDocument = typeof document !== 'undefined';

  // Reacciona a cambios en storage (multi-tab/ventana)
  private readonly onStorage = (event: StorageEvent) => {
    if (!event.key || !this.isRelevantKey(event.key)) return;
    this.refreshFromStorage();
  };

  // ⬇️ MEJORADO: acepta Event | CustomEvent; si trae detail.logged aplica estado directo; si no, refresca de storage.
  private readonly onExternalUpdate = (ev: Event) => {
    const detail = (ev as any)?.detail;
    if (detail && typeof detail.logged === 'boolean') {
      this.applyLoginState(!!detail.logged);
      return;
    }
    this.refreshFromStorage();
  };

  // Al volver a pestaña visible, re-sincroniza
  private readonly onVisibilityChange = () => {
    if (!this.hasDocument || document.visibilityState !== 'visible') return;
    this.refreshFromStorage();
  };

  constructor() {
    // 1) Leer estado inicial desde storage (marcas previas o token)
    this.refreshFromStorage();

    // 2) Suscripciones globales necesarias (una sola vez)
    if (this.hasWindow) {
      window.addEventListener('storage', this.onStorage);
      window.addEventListener('focus', this.onExternalUpdate);
      window.addEventListener('creasia:user-updated', this.onExternalUpdate as EventListener);
    }

    if (this.hasDocument) {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    // ✅ Importante: eliminado el listener inline duplicado de 'creasia:user-updated'
    // (evitamos manejar dos veces el mismo evento).
  }

  ngOnDestroy(): void {
    if (this.hasWindow) {
      window.removeEventListener('storage', this.onStorage);
      window.removeEventListener('focus', this.onExternalUpdate);
      window.removeEventListener('creasia:user-updated', this.onExternalUpdate as EventListener);
    }

    if (this.hasDocument) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  // ---------------------------------------------------------------------------
  // Sincronización con almacenamiento
  // ---------------------------------------------------------------------------

  refreshFromStorage(): void {
    if (!this.hasWindow) return;

    let rawFlag = '0';
    let rawName: string | null = null;
    let hasToken = false;

    try {
      rawFlag = localStorage.getItem(UserSessionService.LOGIN_FLAG_KEY) ?? '0';
    } catch {}

    try {
      rawName = localStorage.getItem(UserSessionService.USER_NAME_KEY);
    } catch {}

    try {
      hasToken =
        !!sessionStorage.getItem(UserSessionService.AUTH_TOKEN_KEY) ||
        !!localStorage.getItem(UserSessionService.AUTH_TOKEN_KEY);
    } catch {}

    const logged = this.normalizeLoginFlag(rawFlag) || hasToken;
    const normalizedName = this.normalizeName(rawName);

    this.updateSignals(logged, normalizedName);
  }

  // Guarda login en storage + señales. Se puede pasar token y modo de persistencia.
  persistLogin(
    displayName: string | null,
    options: { token?: string | null; tokenPersistence?: AuthTokenPersistence } = {}
  ): void {
    const normalizedName = this.normalizeName(displayName);
    const tokenValue = options.token ?? '1';
    const tokenMode: AuthTokenPersistence = options.tokenPersistence ?? 'session';

    if (this.hasWindow) {
      try {
        if (normalizedName) {
          localStorage.setItem(UserSessionService.USER_NAME_KEY, normalizedName);
        } else {
          localStorage.removeItem(UserSessionService.USER_NAME_KEY);
        }
        localStorage.setItem(UserSessionService.LOGIN_FLAG_KEY, '1');
      } catch {}
    }

    this.applyToken(tokenValue, tokenMode);
    this.updateSignals(true, normalizedName);
    this.dispatchUserUpdated();
  }

  // Limpia login en storage + señales.
  clearLogin(): void {
    if (this.hasWindow) {
      try {
        localStorage.removeItem(UserSessionService.USER_NAME_KEY);
      } catch {}
      try {
        localStorage.removeItem(UserSessionService.LOGIN_FLAG_KEY);
      } catch {}
    }

    this.applyToken(null, 'none');
    this.updateSignals(false, null);
    this.dispatchUserUpdated();
  }

  // ---------------------------------------------------------------------------
  // Utilidades internas
  // ---------------------------------------------------------------------------

  private updateSignals(loggedIn: boolean, name: string | null): void {
    this.isLoggedIn.set(loggedIn);
    this.userName.set(name);

    if (loggedIn) {
      this.userInitials.set(this.computeInitials(name) ?? '•');
    } else {
      this.userInitials.set(null);
    }
  }

  private normalizeLoginFlag(value: string | null | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  private normalizeName(name: string | null | undefined): string | null {
    const normalized = (name ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private computeInitials(name: string | null): string | null {
    const normalized = this.normalizeName(name);
    if (!normalized) return null;

    try {
      const sanitized = normalized.replace(/[^\p{L}\p{N}\s-]+/gu, ' ').trim();
      const compact = sanitized.replace(/\s+/g, '');
      const chars = [...compact];
      const initials = chars.slice(0, 2).join('').toUpperCase();
      if (initials) return initials;
    } catch {}

    const fallback = normalized.replace(/[^A-Za-z0-9]+/g, '').slice(0, 2).toUpperCase();
    return fallback.length > 0 ? fallback : null;
  }

  private applyToken(token: string | null, mode: AuthTokenPersistence): void {
    if (!this.hasWindow) return;

    if (mode === 'none') {
      this.clearToken();
      return;
    }

    try {
      if (token) sessionStorage.setItem(UserSessionService.AUTH_TOKEN_KEY, token);
      else sessionStorage.removeItem(UserSessionService.AUTH_TOKEN_KEY);
    } catch {}

    if (mode === 'both') {
      try {
        if (token) localStorage.setItem(UserSessionService.AUTH_TOKEN_KEY, token);
        else localStorage.removeItem(UserSessionService.AUTH_TOKEN_KEY);
      } catch {}
    } else {
      try {
        localStorage.removeItem(UserSessionService.AUTH_TOKEN_KEY);
      } catch {}
    }
  }

  private clearToken(): void {
    if (!this.hasWindow) return;

    try {
      sessionStorage.removeItem(UserSessionService.AUTH_TOKEN_KEY);
    } catch {}
    try {
      localStorage.removeItem(UserSessionService.AUTH_TOKEN_KEY);
    } catch {}
  }

  private isRelevantKey(key: string): boolean {
    return (
      key === UserSessionService.USER_NAME_KEY ||
      key === UserSessionService.LOGIN_FLAG_KEY ||
      key === UserSessionService.AUTH_TOKEN_KEY
    );
  }

  // Evento para que otros lugares reactiven su estado (sin payload aquí).
  private dispatchUserUpdated(): void {
    if (!this.hasWindow) return;
    try {
      window.dispatchEvent(new Event('creasia:user-updated'));
    } catch {}
  }

  // Aplica estado de login y persiste flag mínima (usada por el init de sesión).
  private applyLoginState(logged: boolean): void {
    try {
      if (logged) {
        localStorage.setItem(UserSessionService.LOGIN_FLAG_KEY, '1');
      } else {
        localStorage.removeItem(UserSessionService.LOGIN_FLAG_KEY);
      }
    } catch {}
    this.isLoggedIn.set(logged);
  }
}
