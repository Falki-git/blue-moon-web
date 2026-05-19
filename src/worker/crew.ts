import type { Env } from './index';
import {
  buildCrewSessionCookie, clearCrewSessionCookie,
  constantTimeEqual, requireCrewSession, signCrewSession,
} from './auth';
import { listCleaningGuests } from './db';

function err(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

export async function handleCrew(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/api\/crew\/?/, '');

  if (path === 'login' && request.method === 'POST') {
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; }
    catch { return err(400, 'Invalid JSON'); }
    const password = String(body.password ?? '').trim();
    if (!password) return err(400, 'Password required');
    if (!constantTimeEqual(password, env.CREW_PASSWORD)) return err(401, 'Incorrect password');
    const cookie = await signCrewSession(env);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': buildCrewSessionCookie(cookie) },
    });
  }

  if (path === 'logout' && request.method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearCrewSessionCookie() },
    });
  }

  const guard = await requireCrewSession(request, env);
  if (guard) return guard;

  if (path === 'guests' && request.method === 'GET') {
    const guests = await listCleaningGuests(env.DB);
    return Response.json({ ok: true, guests });
  }

  return err(404, 'Not found');
}
