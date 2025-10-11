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
    // Interceptor de auth (Bearer/JWT). Lo mantenemos aquí como ÚNICO registro.
    provideHttpClient(withInterceptors([authInterceptor])),

    // Backend de fetch (se puede combinar con el interceptor)
    provideHttpClient(withFetch()),

    // Listeners globales y router
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),

    // Nuevo: sincronización inicial de sesión (diagnóstico + preparación de UI)
    sessionInitProvider,
  ],
};
