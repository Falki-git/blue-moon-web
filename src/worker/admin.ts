import type { Env } from './index';
import {
  buildSessionCookie, clearSessionCookie, constantTimeEqual, requireSession,
  signSession, SESSION_COOKIE_NAME,
} from './auth';
import {
  listReservations, listManualBlocks, listPricing,
  getReservation, updateReservationStatus, markDepositPaid,
  insertManualBlock, deleteManualBlock,
  upsertPricingRule, getSetting, upsertSetting,
  listCleaningGuests, insertCleaningGuest, updateCleaningGuest, deleteCleaningGuest,
  type ReservationStatus,
} from './db';
import { isInSeason, SEASON_MONTHS } from './pricing';
import {
  sendEmail, buildGuestBookingApproved, buildGuestDepositReceived,
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

  const depositMatch = path.match(/^reservations\/([^/]+)\/deposit-received$/);
  if (depositMatch && request.method === 'POST') {
    const id = depositMatch[1];
    const row = await getReservation(env.DB, id);
    if (!row) return err(404, 'Reservation not found');
    if (row.status !== 'confirmed') return err(409, `Cannot send deposit confirmation for a ${row.status} reservation`);

    await markDepositPaid(env.DB, id);
    const msg = buildGuestDepositReceived(row, row.language ?? 'en');
    ctx.waitUntil(
      sendEmail(env, {
        to: row.email, replyTo: env.CONTACT_TO_EMAIL,
        subject: msg.subject, html: msg.html, text: msg.text,
      }).then(r => { if (!r.ok) r.text().then(t => console.error('Resend deposit-received failed:', r.status, t)); })
        .catch(e => console.error('Resend deposit-received failed:', e))
    );

    return ok();
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

  if (path === 'settings' && request.method === 'GET') {
    const val = await getSetting(env.DB, 'min_advance_days');
    const minAdvanceDays = val !== null ? (parseInt(val, 10) || 0) : 3;
    return ok({ minAdvanceDays });
  }

  if (path === 'settings' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');
    const days = Number(body.minAdvanceDays);
    if (!Number.isInteger(days) || days < 0 || days > 30) {
      return err(400, 'minAdvanceDays must be an integer between 0 and 30');
    }
    await upsertSetting(env.DB, 'min_advance_days', String(days));
    return ok({ minAdvanceDays: days });
  }

  if (path === 'cleaning-guests' && request.method === 'GET') {
    const guests = await listCleaningGuests(env.DB);
    return ok({ guests });
  }

  if (path === 'cleaning-guests' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');

    const guest_name = String(body.guest_name ?? '').trim();
    const check_in   = String(body.check_in   ?? '').trim();
    const check_out  = String(body.check_out  ?? '').trim();
    if (!guest_name)                             return err(400, 'guest_name is required');
    if (!check_in || !check_out)                 return err(400, 'check_in and check_out are required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in))  return err(400, 'check_in must be YYYY-MM-DD');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(check_out)) return err(400, 'check_out must be YYYY-MM-DD');
    if (check_out <= check_in)                   return err(400, 'check_out must be after check_in');

    const total_guests = Number(body.total_guests ?? 1);
    const adults       = Number(body.adults       ?? 1);
    const children     = Number(body.children     ?? 0);
    const nights       = Number(body.nights       ?? 0);
    if (!Number.isInteger(total_guests) || total_guests < 1) return err(400, 'Invalid total_guests');
    if (!Number.isInteger(adults)       || adults < 0)       return err(400, 'Invalid adults');
    if (!Number.isInteger(children)     || children < 0)     return err(400, 'Invalid children');
    if (!Number.isInteger(nights)       || nights < 1)       return err(400, 'Invalid nights');

    const id = crypto.randomUUID();
    await insertCleaningGuest(env.DB, {
      id,
      guest_name,
      booking_number: String(body.booking_number ?? '').trim() || null,
      country:        String(body.country        ?? '').trim() || null,
      check_in,
      check_out,
      booking_date:   String(body.booking_date   ?? '').trim() || null,
      total_guests,
      adults,
      children,
      children_ages:  String(body.children_ages  ?? '').trim() || null,
      nights,
      email:          String(body.email          ?? '').trim() || null,
      phone:          String(body.phone          ?? '').trim() || null,
      notes:          String(body.notes          ?? '').trim() || null,
      checkin_hour:   String(body.checkin_hour   ?? '').trim() || null,
      checkout_hour:  String(body.checkout_hour  ?? '').trim() || null,
    });
    return ok({ id });
  }

  const cleaningGuestMatch = path.match(/^cleaning-guests\/([^/]+)$/);

  if (cleaningGuestMatch && request.method === 'PUT') {
    const id = cleaningGuestMatch[1];
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');

    const guest_name = String(body.guest_name ?? '').trim();
    const check_in   = String(body.check_in   ?? '').trim();
    const check_out  = String(body.check_out  ?? '').trim();
    if (!guest_name)                             return err(400, 'guest_name is required');
    if (!check_in || !check_out)                 return err(400, 'check_in and check_out are required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in))  return err(400, 'check_in must be YYYY-MM-DD');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(check_out)) return err(400, 'check_out must be YYYY-MM-DD');
    if (check_out <= check_in)                   return err(400, 'check_out must be after check_in');

    const total_guests = Number(body.total_guests ?? 1);
    const adults       = Number(body.adults       ?? 1);
    const children     = Number(body.children     ?? 0);
    const nights       = Number(body.nights       ?? 0);
    if (!Number.isInteger(total_guests) || total_guests < 1) return err(400, 'Invalid total_guests');
    if (!Number.isInteger(adults)       || adults < 0)       return err(400, 'Invalid adults');
    if (!Number.isInteger(children)     || children < 0)     return err(400, 'Invalid children');
    if (!Number.isInteger(nights)       || nights < 1)       return err(400, 'Invalid nights');

    await updateCleaningGuest(env.DB, id, {
      guest_name,
      booking_number: String(body.booking_number ?? '').trim() || null,
      country:        String(body.country        ?? '').trim() || null,
      check_in,
      check_out,
      booking_date:   String(body.booking_date   ?? '').trim() || null,
      total_guests,
      adults,
      children,
      children_ages:  String(body.children_ages  ?? '').trim() || null,
      nights,
      email:          String(body.email          ?? '').trim() || null,
      phone:          String(body.phone          ?? '').trim() || null,
      notes:          String(body.notes          ?? '').trim() || null,
      checkin_hour:   String(body.checkin_hour   ?? '').trim() || null,
      checkout_hour:  String(body.checkout_hour  ?? '').trim() || null,
    });
    return ok();
  }

  if (cleaningGuestMatch && request.method === 'DELETE') {
    await deleteCleaningGuest(env.DB, cleaningGuestMatch[1]);
    return ok();
  }

  return err(404, 'Not found');
}
