// archivo: src/main.ts
// Arranque de la app. NOTA: el interceptor ya se registra en app.config.ts.
// Aquí NO lo volvemos a registrar para evitar duplicidades.

import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(App, {
  ...appConfig,
  providers: [
    ...(appConfig.providers ?? []),
    // Importante: ya NO añadimos provideHttpClient(withInterceptors(...)) aquí
  ],
});
