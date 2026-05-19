import type { Env } from './index';

const SESSION_COOKIE   = 'bm_session';
const SESSION_USER     = 'owner';
const SESSION_TTL_DAYS = 7;
const DECISION_TTL_DAYS = 30;

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return b64url(sig);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export async function signSession(env: Env): Promise<string> {
  const exp = nowSec() + SESSION_TTL_DAYS * 86400;
  const payload = `${SESSION_USER}.${exp}`;
  const sig = await hmac(env.SESSION_SECRET, payload);
  return `${payload}.${sig}`;
}

export async function verifySession(cookieValue: string | null, env: Env): Promise<{ userId: string } | null> {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!exp || exp < nowSec()) return null;
  const expected = await hmac(env.SESSION_SECRET, `${userId}.${exp}`);
  if (!constantTimeEqual(sig, expected)) return null;
  return { userId };
}

export async function signDecisionToken(
  reservationId: string, action: 'approve' | 'decline', env: Env,
): Promise<string> {
  const exp = nowSec() + DECISION_TTL_DAYS * 86400;
  const payload = `${reservationId}.${action}.${exp}`;
  const sig = await hmac(env.SESSION_SECRET, payload);
  return b64url(new TextEncoder().encode(`${payload}.${sig}`));
}

export async function verifyDecisionToken(
  token: string, env: Env,
): Promise<{ reservationId: string; action: 'approve' | 'decline' } | null> {
  let raw: string;
  try {
    raw = new TextDecoder().decode(fromB64url(token));
  } catch {
    return null;
  }
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const [reservationId, action, expStr, sig] = parts;
  if (action !== 'approve' && action !== 'decline') return null;
  const exp = Number(expStr);
  if (!exp || exp < nowSec()) return null;
  const expected = await hmac(env.SESSION_SECRET, `${reservationId}.${action}.${exp}`);
  if (!constantTimeEqual(sig, expected)) return null;
  return { reservationId, action };
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export function buildSessionCookie(value: string): string {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function requireSession(request: Request, env: Env): Promise<Response | null> {
  const cookie = parseCookie(request.headers.get('cookie'), SESSION_COOKIE);
  const session = await verifySession(cookie, env);
  if (!session) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  // Same-origin guard for state-changing requests.
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const url = new URL(request.url);
    if (origin && new URL(origin).host !== url.host) {
      return Response.json({ ok: false, error: 'Bad origin' }, { status: 403 });
    }
  }
  return null;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

// ── Crew session (bm_crew_session) ──────────────────────────────────────────

const CREW_COOKIE   = 'bm_crew_session';
const CREW_USER     = 'crew';
const CREW_TTL_DAYS = 7;

export async function signCrewSession(env: Env): Promise<string> {
  const exp = nowSec() + CREW_TTL_DAYS * 86400;
  const payload = `${CREW_USER}.${exp}`;
  const sig = await hmac(env.SESSION_SECRET, payload);
  return `${payload}.${sig}`;
}

export async function verifyCrewSession(
  cookieValue: string | null,
  env: Env,
): Promise<{ userId: string } | null> {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  if (userId !== CREW_USER) return null;
  const exp = Number(expStr);
  if (!exp || exp < nowSec()) return null;
  const expected = await hmac(env.SESSION_SECRET, `${userId}.${exp}`);
  if (!constantTimeEqual(sig, expected)) return null;
  return { userId };
}

export function buildCrewSessionCookie(value: string): string {
  return `${CREW_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CREW_TTL_DAYS * 86400}`;
}

export function clearCrewSessionCookie(): string {
  return `${CREW_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function requireCrewSession(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const cookie = parseCookie(request.headers.get('cookie'), CREW_COOKIE);
  const session = await verifyCrewSession(cookie, env);
  if (!session) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const url = new URL(request.url);
    if (origin && new URL(origin).host !== url.host) {
      return Response.json({ ok: false, error: 'Bad origin' }, { status: 403 });
    }
  }
  return null;
}
