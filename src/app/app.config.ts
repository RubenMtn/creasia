// archivo: src/app/app.config.ts
// Config global de la app: rutas, HttpClient, interceptor y APP_INITIALIZER de sesión.

import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import { routes } from './app.routes';

// APP_INITIALIZER: sincroniza estado de login al arrancar
import { sessionInitProvider } from './core/session-init.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    // Listeners globales y rendimiento
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),

    // Router + Hydration
    provideRouter(routes),
    provideClientHydration(withEventReplay()),

    // HttpClient: una ÚNICA provisión combinada (fetch + interceptor)
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor]),
    ),

    // Sincronización inicial de sesión (diagnóstico + preparación de UI)
    sessionInitProvider,
  ],
};
