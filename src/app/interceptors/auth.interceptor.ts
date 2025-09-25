import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const auth = inject(AuthService);

  // Evita añadir Authorization o forzar refresh sobre los endpoints de auth
  const isAuthEndpoint =
    req.url.includes('/api/auth/login.php') ||
    req.url.includes('/api/auth/refresh.php') ||
    req.url.includes('/api/auth/logout.php');

  const token = auth.getAccess();
  const withAuth = !isAuthEndpoint && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(withAuth).pipe(
    catchError(err => {
      // Si no es 401, propagamos el error tal cual
      if (!err || err.status !== 401 || isAuthEndpoint) {
        return throwError(() => err);
      }

      // Intento de refresh (una sola vez, el AuthService ya cola peticiones concurrentes)
      return from(auth.refresh()).pipe(
        switchMap((ok) => {
          const refreshed = auth.getAccess();
          const retryReq = ok && refreshed
            ? req.clone({ setHeaders: { Authorization: `Bearer ${refreshed}` } })
            : req;
          return next(retryReq);
        })
      );
    })
  );
};
