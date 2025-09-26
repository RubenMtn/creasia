/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/core/prueba-pte-interceptor.ts
// Interceptor HTTP que añade trace-id y loguea request/response con marca "PruebaPte".
import {
  HttpInterceptorFn,
  HttpResponse,
  HttpErrorResponse,
  HttpEvent,
} from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ppDebug } from './prueba-pte-debug.helper';

// Genera un traceId sin dependencias externas
function makeTraceId(): string {
  try {
    // Navegadores modernos
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      // ts-expect-error: randomUUID existe en navegadores modernos
      return crypto.randomUUID();
    }
  } catch {
    /* no-op */
  }
  // Fallback simple (suficiente para trazas de debug)
  return 'pp-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Detecta si es un caso dev cross-origin (localhost:4200 -> https://creasia.es)
function isDevCrossOrigin(url: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const fromLocalhost = window.location.origin.startsWith('http://localhost:4200')
      || window.location.origin.startsWith('http://127.0.0.1:4200');
    const toProd = url.startsWith('https://creasia.es/') || url === 'https://creasia.es' || url.startsWith('https://www.creasia.es/');
    return fromLocalhost && toProd;
  } catch {
    return false;
  }
}

export const pruebaPteInterceptor: HttpInterceptorFn = (req, next) => {
  const traceId = makeTraceId();
  const startedAt = performance.now();

  // —— CLON CONDICIONAL —— 
  // En dev cross-origin NO añadimos cabeceras personalizadas para evitar que el preflight
  // rechace 'X-PruebaPte*'. En el resto de casos, sí las añadimos.
  const tracedReq = isDevCrossOrigin(req.url)
    ? req.clone({
        withCredentials: true, // importante para cookies de sesión
      })
    : req.clone({
        setHeaders: {
          'X-PruebaPte': '1',
          'X-PruebaPte-Trace-Id': traceId,
        },
        withCredentials: true, // importante para cookies de sesión
      });

  ppDebug(`REQ ${req.method} ${req.url}`, {
    traceId,
    withCredentials: req.withCredentials ?? false,
    bodyPreview: bodyPreview(req.body),
  });

  return next(tracedReq).pipe(
    tap((event: HttpEvent<unknown>) => {
      if (event instanceof HttpResponse) {
        const ms = Math.round(performance.now() - startedAt);
        ppDebug(`RES ${req.method} ${req.url}`, {
          traceId,
          status: event.status,
          ms,
          headersSample: sampleHeaders(event.headers),
          bodyPreview: bodyPreview(event.body),
        });
      }
    }),
    catchError((error: unknown) => {
      const ms = Math.round(performance.now() - startedAt);
      if (error instanceof HttpErrorResponse) {
        ppDebug(`ERR ${req.method} ${req.url}`, {
          traceId,
          status: error.status,
          ms,
          message: error.message,
          url: error.url,
          errorPreview: bodyPreview(error.error),
        });
      } else {
        ppDebug(`ERR ${req.method} ${req.url}`, { traceId, ms, error });
      }
      return throwError(() => error);
    }),
  );
};

// —— utilidades internas ——
// Nota: evitamos loguear objetos enormes o datos sensibles.
function bodyPreview(body: unknown) {
  try {
    if (body == null) return null;
    const s = typeof body === 'string' ? body : JSON.stringify(body);
    return s.length > 500 ? s.slice(0, 500) + '…' : s;
  } catch {
    return '[unserializable]';
  }
}

function sampleHeaders(headers: any) {
  try {
    const out: Record<string, string | null> = {};
    ['set-cookie', 'x-pruebapte-php', 'x-pruebapte', 'authorization'].forEach((h) => {
      out[h] = headers.get?.(h) ?? null;
    });
    return out;
  } catch {
    return null;
  }
}
