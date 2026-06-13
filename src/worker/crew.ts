import type { Env } from './index';
import {
  buildCrewSessionCookie, clearCrewSessionCookie,
  constantTimeEqual, requireCrewSession, signCrewSession,
} from './auth';
import { listCrewGuests, listCrewDocs, getCrewDoc } from './db';

function err(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

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
    const guests = await listCrewGuests(env.DB);
    return Response.json({ ok: true, guests });
  }

  if (path === 'docs' && request.method === 'GET') {
    const slug = new URL(request.url).searchParams.get('slug');
    const docs = await listCrewDocs(env.DB);
    if (slug) {
      const match = docs.find(d => slugify(d.title) === slug);
      if (!match) return err(404, 'Doc not found');
      const doc = await getCrewDoc(env.DB, match.id);
      if (!doc) return err(404, 'Doc not found');
      return Response.json({ ok: true, doc: { id: doc.id, title: doc.title, content_html: doc.content_html } });
    }
    return Response.json({ ok: true, docs: docs.map(d => ({ id: d.id, title: d.title, slug: slugify(d.title) })) });
  }

  return err(404, 'Not found');
}
