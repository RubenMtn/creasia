// archivo: src/app/core/session-init.provider.ts
import { APP_INITIALIZER, Provider } from '@angular/core';
import { getApiBase } from './api-base';

/** Estructuras de datos (interfaces en uso real) */
interface WhoAmI {
  ok?: boolean;
  logged?: boolean;
  isLogged?: boolean;
  success?: boolean;
  uid?: number | string;
  name?: string;
  nombre?: string;
  displayName?: string;
  email?: string;
  mail?: string;
  user?: { name?: string; email?: string } | null;
  session_vars?: { email?: string; nombre?: string; name?: string } | null;
  session_id?: string; // solo informativo (no determina login)
}

interface MeSocio {
  email?: string;
  nombre?: string;
  apellido1?: string;
  apellido2?: string;
  name?: string;
}

interface MeResponse {
  ok?: boolean;
  socio?: MeSocio | null;
  data?: MeSocio | null;
}

/** Helpers sin `any` */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length ? t : null;
  }
  return null;
}

function toBooleanLoose(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return /^(1|true|ok)$/i.test(value.trim());
  return false;
}

function pickFirstNonEmpty(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    const s = (v ?? '').trim();
    if (s) return s;
  }
  return null;
}

async function safeJson(res: Response): Promise<unknown | null> {
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try { return await res.json(); } catch { return null; }
  }
  try {
    const t = (await res.text()).trim();
    if (!t) return null;
    try { return JSON.parse(t); } catch { return t; }
  } catch { /* ignore */ }
  return null;
}

/** Parsers tipados */
function parseWhoAmI(input: unknown): WhoAmI | null {
  if (!isRecord(input)) return null;

  const userRec = isRecord(input['user']) ? (input['user'] as Record<string, unknown>) : null;
  const sessRec = isRecord(input['session_vars']) ? (input['session_vars'] as Record<string, unknown>) : null;

  const who: WhoAmI = {
    ok: toBooleanLoose(input['ok']),
    logged: toBooleanLoose(input['logged']),
    isLogged: toBooleanLoose(input['isLogged']),
    success: toBooleanLoose(input['success']),
    uid: typeof input['uid'] === 'number' || typeof input['uid'] === 'string' ? (input['uid'] as number | string) : undefined,
    name: toStringOrNull(input['name']) ?? undefined,
    nombre: toStringOrNull(input['nombre']) ?? undefined,
    displayName: toStringOrNull(input['displayName']) ?? undefined,
    email: toStringOrNull(input['email']) ?? undefined,
    mail: toStringOrNull(input['mail']) ?? undefined,
    user: userRec
      ? {
          name: toStringOrNull(userRec['name']) ?? undefined,
          email: toStringOrNull(userRec['email']) ?? undefined,
        }
      : null,
    session_vars: sessRec
      ? {
          email: toStringOrNull(sessRec['email']) ?? undefined,
          nombre: toStringOrNull(sessRec['nombre']) ?? undefined,
          name: toStringOrNull(sessRec['name']) ?? undefined,
        }
      : null,
    session_id: toStringOrNull(input['session_id']) ?? undefined, // informativo
  };

  return who;
}

function parseMeResponse(input: unknown): MeResponse | null {
  if (!isRecord(input)) return null;

  const socioRec = isRecord(input['socio'])
    ? (input['socio'] as Record<string, unknown>)
    : isRecord(input['data'])
    ? (input['data'] as Record<string, unknown>)
    : input;

  const socio: MeSocio = {
    email: toStringOrNull((socioRec as Record<string, unknown>)['email']) ?? undefined,
    nombre: toStringOrNull((socioRec as Record<string, unknown>)['nombre']) ?? undefined,
    apellido1: toStringOrNull((socioRec as Record<string, unknown>)['apellido1']) ?? undefined,
    apellido2: toStringOrNull((socioRec as Record<string, unknown>)['apellido2']) ?? undefined,
    name: toStringOrNull((socioRec as Record<string, unknown>)['name']) ?? undefined,
  };

  const out: MeResponse = {
    ok: toBooleanLoose(input['ok']),
    socio,
    data: socio,
  };

  return out;
}

async function bootstrapSession(): Promise<void> {
  if (typeof window === 'undefined') return;

  const api = getApiBase();

  let logged = false;
  let name: string | null = null;
  let email: string | null = null;

  // 1) WHOAMI (con credenciales)
  try {
    const res = await fetch(`${api}/auth/whoami.php`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8' }
    });

    if (res.ok) {
      const raw = await safeJson(res);

      if (typeof raw === 'string') {
        // Si el backend devolviera un string simple, lo interpretamos de forma laxa
        logged = toBooleanLoose(raw);
      } else {
        const who = parseWhoAmI(raw);
        if (who) {
          const hasUid =
            typeof who.uid === 'number' ||
            (typeof who.uid === 'string' && who.uid.trim().length > 0);

          // ✅ SOLO consideramos login si el servidor lo indica o hay uid:
          logged =
            toBooleanLoose(who.ok) ||
            toBooleanLoose(who.logged) ||
            toBooleanLoose(who.isLogged) ||
            toBooleanLoose(who.success) ||
            !!hasUid;

          name = pickFirstNonEmpty(
            who.name,
            who.nombre,
            who.displayName,
            who.user?.name,
            who.session_vars?.nombre,
            who.session_vars?.name
          );

          email = pickFirstNonEmpty(
            who.email,
            who.mail,
            who.user?.email,
            who.session_vars?.email
          );
        }
      }
    }
  } catch { /* ignorado */ }

  // 2) Fallback: si falta name/email y estamos logados, intenta /socios/socios_me.php
  if (logged && (!name || !email)) {
    try {
      const res2 = await fetch(`${api}/socios/socios_me.php`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8' }
      });

      if (res2.ok) {
        const meRaw = await safeJson(res2);
        const me = parseMeResponse(meRaw);

        if (me) {
          const fullName =
            [
              me.socio?.nombre ?? me.socio?.name ?? null,
              me.socio?.apellido1 ?? null,
              me.socio?.apellido2 ?? null,
            ]
              .filter(Boolean)
              .join(' ')
              .trim() || null;

          if (!name)  name  = fullName;
          if (!email) email = me.socio?.email ?? null;
        }
      }
    } catch { /* ignorado */ }
  }

  // 3) Persistencia en LocalStorage
  try {
    if (logged) {
      localStorage.setItem('creasia:isLoggedIn', '1');
      if (name)  localStorage.setItem('creasia:userName', name);
      if (email) localStorage.setItem('creasia:userEmail', email);
    } else {
      localStorage.removeItem('creasia:isLoggedIn');
      // userName/userEmail se limpian en logout explícito
    }
  } catch { /* ignorado */ }

  // 4) Evento global para UserSessionService
  try {
    window.dispatchEvent(
      new CustomEvent<{ logged: boolean; name: string | null; email: string | null }>(
        'creasia:user-updated',
        { detail: { logged, name, email } }
      )
    );
  } catch { /* ignorado */ }
}

export const sessionInitProvider: Provider = {
  provide: APP_INITIALIZER,
  multi: true,
  useFactory: () => () => bootstrapSession(),
};
