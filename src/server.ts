// src/server.ts
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { join } from 'node:path';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
const angularApp = new AngularNodeAppEngine();

/* 1) Seguridad base */
app.set('trust proxy', 1);              // si hay proxy/reverso (HSTS, IP real)
app.disable('x-powered-by');            // oculta tecnología

/* 2) Compresión HTTP */
app.use(compression());

/* 3) Helmet + CSP */
app.use(helmet({
  // CSP moderada (sin nonce) para no romper Angular; podemos afinar más con nonces si quieres.
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],                       // si hiciera falta, añadir nonce en el futuro
      "style-src": ["'self'", "'unsafe-inline'"],     // Angular inserta estilos en <style>
      "img-src": ["'self'", "data:"],
      "font-src": ["'self'", "data:"],
      "media-src": ["'self'", "blob:"],
      "connect-src": ["'self'", "https://creasia.es", "https://*.creasia.es"], // API remota
      "frame-ancestors": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false, // evita romper media embebida
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));

/* 4) Archivos estáticos del build del navegador (caché 1 año OK) */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/* 5) Respuestas SSR sin caché (evita servir HTML antiguo a usuarios logados) */
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/* 6) SSR: render del resto de rutas */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/* 7) Arranque del servidor */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error?: unknown) => {
    if (error) throw error;
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/* 8) Handler para CLI/build/functions */
export const reqHandler = createNodeRequestHandler(app);
