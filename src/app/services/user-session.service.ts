/* eslint-disable no-empty */
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

  private readonly onStorage = (event: StorageEvent) => {
    if (!event.key || !this.isRelevantKey(event.key)) return;
    this.refreshFromStorage();
  };

  private readonly onExternalUpdate = () => this.refreshFromStorage();

  private readonly onVisibilityChange = () => {
    if (!this.hasDocument || document.visibilityState !== 'visible') return;
    this.refreshFromStorage();
  };

  constructor() {
    this.refreshFromStorage();

    if (this.hasWindow) {
      window.addEventListener('storage', this.onStorage);
      window.addEventListener('focus', this.onExternalUpdate);
      window.addEventListener('creasia:user-updated', this.onExternalUpdate as EventListener);
    }

    if (this.hasDocument) {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
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

  refreshFromStorage(): void {
    if (!this.hasWindow) return;

    let rawFlag = '0';
    let rawName: string | null = null;
    let hasToken = false;

    try {
      rawFlag = localStorage.getItem(UserSessionService.LOGIN_FLAG_KEY) ?? '0';
    } catch { }

    try {
      rawName = localStorage.getItem(UserSessionService.USER_NAME_KEY);
    } catch { }

    try {
      hasToken = !!sessionStorage.getItem(UserSessionService.AUTH_TOKEN_KEY) ||
        !!localStorage.getItem(UserSessionService.AUTH_TOKEN_KEY);
    } catch { }

    const logged = this.normalizeLoginFlag(rawFlag) || hasToken;
    const normalizedName = this.normalizeName(rawName);

    this.updateSignals(logged, normalizedName);
  }

  persistLogin(displayName: string | null, options: { token?: string | null; tokenPersistence?: AuthTokenPersistence } = {}): void {
    const normalizedName = this.normalizeName(displayName);
    const tokenValue = options.token ?? '1';
    const tokenMode: AuthTokenPersistence = options.tokenPersistence ?? 'session';

    if (this.hasWindow) {
      try {
        if (normalizedName) localStorage.setItem(UserSessionService.USER_NAME_KEY, normalizedName);
        else localStorage.removeItem(UserSessionService.USER_NAME_KEY);
        localStorage.setItem(UserSessionService.LOGIN_FLAG_KEY, '1');
      } catch { }
    }

    this.applyToken(tokenValue, tokenMode);
    this.updateSignals(true, normalizedName);
    this.dispatchUserUpdated();
  }

  clearLogin(): void {
    if (this.hasWindow) {
      try { localStorage.removeItem(UserSessionService.USER_NAME_KEY); } catch { }
      try { localStorage.removeItem(UserSessionService.LOGIN_FLAG_KEY); } catch { }
    }

    this.applyToken(null, 'none');
    this.updateSignals(false, null);
    this.dispatchUserUpdated();
  }

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
    } catch { }

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
    } catch { }

    if (mode === 'both') {
      try {
        if (token) localStorage.setItem(UserSessionService.AUTH_TOKEN_KEY, token);
        else localStorage.removeItem(UserSessionService.AUTH_TOKEN_KEY);
      } catch { }
    } else {
      try { localStorage.removeItem(UserSessionService.AUTH_TOKEN_KEY); } catch { }
    }
  }

  private clearToken(): void {
    if (!this.hasWindow) return;

    try { sessionStorage.removeItem(UserSessionService.AUTH_TOKEN_KEY); } catch { }
    try { localStorage.removeItem(UserSessionService.AUTH_TOKEN_KEY); } catch { }
  }

  private isRelevantKey(key: string): boolean {
    return key === UserSessionService.USER_NAME_KEY ||
      key === UserSessionService.LOGIN_FLAG_KEY ||
      key === UserSessionService.AUTH_TOKEN_KEY;
  }

  private dispatchUserUpdated(): void {
    if (!this.hasWindow) return;
    try { window.dispatchEvent(new Event('creasia:user-updated')); } catch { }
  }
}
