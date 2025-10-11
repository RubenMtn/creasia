/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-empty */
// archivo: src/app/core/session-init.provider.ts
// Sincroniza estado de login al arrancar SIN crear sesión nueva.
// - Llama a /api/auth/whoami.php con credenciales.
// - Si ok=true, marca en localStorage 'creasia:isLoggedIn' = '1'.
// - Si no, elimina la marca.
// - Emite un evento 'creasia:user-updated' para que otros se reactiven si lo escuchan.

import { APP_INITIALIZER, Provider, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

function initSessionFactory() {
  return async () => {
    const platformId = inject(PLATFORM_ID);
    if (!isPlatformBrowser(platformId)) return; // Evitar SSR/prerender

    const http = inject(HttpClient);

    try {
      const res: any = await lastValueFrom(
        http.get('https://creasia.es/api/auth/whoami.php', { withCredentials: true })
            .pipe(catchError(() => of(null)))
      );

      const logged = !!(res && res.ok);

      // Persistencia mínima para la UI actual (sin acoplar a servicios internos)
      try {
        if (logged) localStorage.setItem('creasia:isLoggedIn', '1');
        else localStorage.removeItem('creasia:isLoggedIn');
      } catch {}

      // Evento opcional para que servicios/componentes puedan reaccionar
      try {
        window.dispatchEvent(new CustomEvent('creasia:user-updated', { detail: { logged } }));
      } catch {}
    } catch {}
  };
}

export const sessionInitProvider: Provider = {
  provide: APP_INITIALIZER,
  useFactory: initSessionFactory,
  multi: true,
};
