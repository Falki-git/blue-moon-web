import type { Env } from './index';
import {
  buildSessionCookie, clearSessionCookie, constantTimeEqual, requireSession,
  signSession, SESSION_COOKIE_NAME,
} from './auth';
import {
  listReservations, listManualBlocks, listPricing,
  getReservation, updateReservationStatus,
  insertManualBlock, deleteManualBlock,
  upsertPricingRule,
  type ReservationStatus,
} from './db';
import { isInSeason, SEASON_MONTHS } from './pricing';
import {
  sendEmail, buildGuestBookingApproved,
} from './email';

function err(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

function ok(data: Record<string, unknown> = {}): Response {
  return Response.json({ ok: true, ...data });
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.includes('application/json')) return null;
  try { return await request.json(); }
  catch { return null; }
}

export async function handleAdmin(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/admin\/?/, '');

  if (path === 'login' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');
    const password = String(body.password ?? '');
    if (!password) return err(400, 'Password required');
    if (!constantTimeEqual(password, env.ADMIN_PASSWORD)) {
      return err(401, 'Incorrect password');
    }
    const cookie = await signSession(env);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildSessionCookie(cookie),
      },
    });
  }

  if (path === 'logout' && request.method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookie() },
    });
  }

  const guard = await requireSession(request, env);
  if (guard) return guard;

  if (path === 'reservations' && request.method === 'GET') {
    const status = (url.searchParams.get('status') ?? '') as ReservationStatus | '';
    const validStatuses: ReservationStatus[] = ['pending', 'confirmed', 'declined', 'cancelled'];
    const filter = validStatuses.includes(status as ReservationStatus) ? (status as ReservationStatus) : undefined;
    const rows = await listReservations(env.DB, filter);
    return ok({ reservations: rows });
  }

  const decisionMatch = path.match(/^reservations\/([^/]+)\/decision$/);
  if (decisionMatch && request.method === 'POST') {
    const id = decisionMatch[1];
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');
    const action = String(body.action ?? '');
    if (action !== 'approve' && action !== 'decline' && action !== 'cancel') {
      return err(400, 'Action must be approve, decline, or cancel');
    }
    const row = await getReservation(env.DB, id);
    if (!row) return err(404, 'Reservation not found');

    let newStatus: ReservationStatus;
    if (action === 'approve') {
      if (row.status !== 'pending') return err(409, `Cannot approve a ${row.status} reservation`);
      newStatus = 'confirmed';
    } else if (action === 'decline') {
      if (row.status !== 'pending') return err(409, `Cannot decline a ${row.status} reservation`);
      newStatus = 'declined';
    } else {
      if (row.status !== 'confirmed' && row.status !== 'pending') {
        return err(409, `Cannot cancel a ${row.status} reservation`);
      }
      newStatus = 'cancelled';
    }

    await updateReservationStatus(env.DB, id, newStatus);

    if (action === 'approve') {
      const updated = { ...row, status: newStatus } as typeof row;
      const msg = buildGuestBookingApproved(updated);
      ctx.waitUntil(
        sendEmail(env, {
          to: row.email, replyTo: env.CONTACT_TO_EMAIL,
          subject: msg.subject, html: msg.html, text: msg.text,
        }).then(r => { if (!r.ok) r.text().then(t => console.error('Resend admin decision failed:', r.status, t)); })
          .catch(e => console.error('Resend admin decision failed:', e))
      );
    }

    return ok({ status: newStatus });
  }

  if (path === 'blocks' && request.method === 'GET') {
    const rows = await listManualBlocks(env.DB);
    return ok({ blocks: rows });
  }

  if (path === 'blocks' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');
    const from = String(body.from ?? '').trim();
    const to   = String(body.to   ?? '').trim();
    const note = String(body.note ?? '').trim();
    if (!from || !to) return err(400, 'from and to are required');
    if (!isInSeason(from) || !isInSeason(to)) return err(400, 'Dates must be within the season');
    if (to < from) return err(400, 'to must be on or after from');
    const id = crypto.randomUUID();
    await insertManualBlock(env.DB, { id, from_date: from, to_date: to, note: note || null });
    return ok({ id });
  }

  const blockDeleteMatch = path.match(/^blocks\/([^/]+)$/);
  if (blockDeleteMatch && request.method === 'DELETE') {
    await deleteManualBlock(env.DB, blockDeleteMatch[1]);
    return ok();
  }

  if (path === 'pricing' && request.method === 'GET') {
    const rows = await listPricing(env.DB);
    return ok({ pricing: rows });
  }

  if (path === 'pricing' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');
    const month = Number(body.month);
    const rate  = Number(body.rate_eur);
    if (!SEASON_MONTHS.includes(month as 6 | 7 | 8 | 9)) {
      return err(400, 'Month must be 6, 7, 8, or 9');
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 10_000) {
      return err(400, 'Rate must be between 0 and 10000');
    }
    await upsertPricingRule(env.DB, month, Math.round(rate));
    return ok({ month, rate_eur: Math.round(rate) });
  }

  return err(404, 'Not found');
}
