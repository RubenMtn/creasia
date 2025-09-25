/* eslint-disable @typescript-eslint/no-empty-function */
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken: string | null = null;
  private refreshing = false;
  private waiters: ((ok: boolean) => void)[] = [];

  getAccess(): string | null { return this.accessToken; }
  setAccess(t: string | null) { this.accessToken = t; }

  async refresh(): Promise<boolean> {
    if (this.refreshing) {
      return new Promise(res => this.waiters.push(res));
    }
    this.refreshing = true;
    try {
      const r = await fetch('/api/auth/refresh.php', { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('refresh_failed');
      const j = await r.json();
      if (j?.ok && j.access_token) {
        this.setAccess(j.access_token);
        return true;
      }
      throw new Error('no_token');
    } catch {
      this.setAccess(null);
      return false;
    } finally {
      this.refreshing = false;
      this.waiters.splice(0).forEach(fn => fn(this.accessToken != null));
    }
  }

  async logout(): Promise<void> {
    this.setAccess(null);
    await fetch('/api/auth/logout.php', { method: 'POST', credentials: 'include' }).catch(()=>{});
  }
}
