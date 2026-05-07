import type { Env } from './index';
import {
  computeTotal, depositEur, isInSeason, loadPricing,
  MIN_NIGHTS, SEASON_2026, DEPOSIT_PCT, SEASON_MONTHS,
} from './pricing';
import {
  insertReservation, listOccupiedDates, rangeOverlapsOccupied,
  getReservation, updateReservationStatus,
} from './db';
import { signDecisionToken, verifyDecisionToken } from './auth';
import {
  sendEmail, buildOwnerBookingNotification, buildGuestBookingPending,
  buildGuestBookingApproved, buildGuestBookingDeclined,
} from './email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function err(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

function diffNights(checkIn: string, checkOut: string): number {
  const [iy, im, id] = checkIn.split('-').map(Number);
  const [oy, om, od] = checkOut.split('-').map(Number);
  const a = new Date(iy, im - 1, id).getTime();
  const b = new Date(oy, om - 1, od).getTime();
  return Math.round((b - a) / 86_400_000);
}

export async function handleAvailability(_request: Request, env: Env): Promise<Response> {
  const pricing = await loadPricing(env.DB);
  const occ = await listOccupiedDates(env.DB, SEASON_2026.start, SEASON_2026.end);

  const pricingByMonth: Record<number, number> = {};
  for (const m of SEASON_MONTHS) pricingByMonth[m] = pricing[m] ?? 0;

  return Response.json({
    ok: true,
    blocked: occ.blocked,
    pending: occ.pending,
    pricing: pricingByMonth,
    season: SEASON_2026,
    minNights: MIN_NIGHTS,
    depositPct: DEPOSIT_PCT,
  });
}

export async function handleBooking(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return err(415, 'Content-Type must be application/json');
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return err(400, 'Invalid JSON'); }

  if (body['bot-field']) return err(400, 'Bad request');

  const fullName = String(body.fullName ?? '').trim();
  const email    = String(body.email    ?? '').trim();
  const phone    = String(body.phone    ?? '').trim();
  const acceptLang = request.headers.get('Accept-Language') ?? '';
  const language = acceptLang.split(',')[0].split('-')[0].trim() || 'en';
  const country  = String(body.country  ?? '').trim();
  const address  = String(body.address  ?? '').trim();
  const source   = String(body.source   ?? '').trim();
  const children = String(body.children ?? '').trim();
  const message  = String(body.message  ?? '').trim();
  const checkin  = String(body.checkin  ?? '').trim();
  const checkout = String(body.checkout ?? '').trim();
  const guests   = Number(body.guests);
  const tsToken  = String(body['cf-turnstile-response'] ?? '');

  if (!fullName)                           return err(400, 'Full name is required');
  if (!email || !EMAIL_RE.test(email))     return err(400, 'Valid email is required');
  if (!phone)                              return err(400, 'Phone number is required');
  if (!country)                            return err(400, 'Country is required');
  if (!checkin)                            return err(400, 'Check-in date is required');
  if (!checkout)                           return err(400, 'Check-out date is required');
  if (!guests || guests < 1 || guests > 6) return err(400, 'Guests must be between 1 and 6');

  if (!isInSeason(checkin) || !isInSeason(checkout)) {
    return err(400, 'Dates must be within the season (1 Jun – 30 Sep 2026)');
  }
  const nights = diffNights(checkin, checkout);
  if (nights < MIN_NIGHTS) {
    return err(400, `Minimum stay is ${MIN_NIGHTS} nights`);
  }

  const tsForm = new FormData();
  tsForm.append('secret',   env.TURNSTILE_SECRET_KEY);
  tsForm.append('response', tsToken);
  tsForm.append('remoteip', request.headers.get('CF-Connecting-IP') ?? '');
  const tsRes  = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: tsForm });
  const tsData = await tsRes.json() as { success: boolean };
  if (!tsData.success) return err(400, 'Security check failed. Please try again.');

  const pricing = await loadPricing(env.DB);
  const total = computeTotal(checkin, checkout, pricing);
  if (total.nights !== nights) return err(400, 'Inconsistent dates');

  if (await rangeOverlapsOccupied(env.DB, checkin, checkout)) {
    return err(409, 'Those dates were just taken — please choose another range.');
  }

  const id = crypto.randomUUID();
  const decisionToken = await signDecisionToken(id, 'approve', env);

  await insertReservation(env.DB, {
    id, status: 'pending',
    full_name: fullName, email, phone: phone || null, language: language || null,
    country: country || null, address: address || null, source: source || null,
    guests, children_ages: children || null,
    check_in: checkin, check_out: checkout, nights,
    total_eur: total.totalEur, message: message || null,
    decision_token: decisionToken,
  });

  const row = await getReservation(env.DB, id);
  if (!row) return err(500, 'Failed to record reservation');

  const origin = new URL(request.url).origin;
  const approveToken = await signDecisionToken(id, 'approve', env);
  const declineToken = await signDecisionToken(id, 'decline', env);
  const links = {
    approve: `${origin}/booking/confirm?token=${approveToken}`,
    decline: `${origin}/booking/confirm?token=${declineToken}`,
  };

  const ownerMsg = buildOwnerBookingNotification(row, links);
  const ownerRes = await sendEmail(env, {
    to: env.CONTACT_TO_EMAIL, replyTo: email,
    subject: ownerMsg.subject, html: ownerMsg.html, text: ownerMsg.text,
  });
  if (!ownerRes.ok) {
    console.error('Resend owner email failed:', await ownerRes.text());
    return err(502, 'Failed to send notification. Please email us directly at bluemoon.mandre@gmail.com');
  }

  const guestMsg = buildGuestBookingPending(row);
  ctx.waitUntil(
    sendEmail(env, {
      to: email, replyTo: env.CONTACT_TO_EMAIL,
      subject: guestMsg.subject, html: guestMsg.html, text: guestMsg.text,
    }).then(r => { if (!r.ok) r.text().then(t => console.error('Resend guest pending failed:', r.status, t)); })
      .catch(e => console.error('Resend guest pending failed:', e))
  );

  return Response.json({ ok: true, reservationId: id });
}

function decisionPage(title: string, body: string): Response {
  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Blue Moon Apartment</title>
<style>
  body { font-family: system-ui, sans-serif; background: #EAF6FC; color: #1a2a3a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
  .card { background: #fff; border-radius: 20px; box-shadow: 0 4px 24px rgba(8,22,40,0.13); padding: 2.5rem; max-width: 480px; text-align: center; }
  h1 { color: #1A5FAD; margin: 0 0 1rem; font-size: 1.6rem; }
  p { color: #5a7080; margin: 0.5rem 0; }
  a { display: inline-block; margin-top: 1.5rem; background: #1A5FAD; color: #fff; padding: 10px 20px; border-radius: 50px; text-decoration: none; font-weight: 700; }
</style></head><body><div class="card"><h1>${title}</h1>${body}<a href="https://bluemoonmandre.eu/admin">Open admin →</a></div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function handleDecision(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return decisionPage('Invalid link', '<p>This link is missing a token.</p>');

  const v = await verifyDecisionToken(token, env);
  if (!v) return decisionPage('Invalid or expired link', '<p>Please use the admin page to act on this reservation.</p>');

  const row = await getReservation(env.DB, v.reservationId);
  if (!row) return decisionPage('Reservation not found', '<p>It may have been deleted.</p>');

  if (row.status !== 'pending') {
    return decisionPage(
      'Already decided',
      `<p>This reservation is already <strong>${row.status}</strong>. No change made.</p>`,
    );
  }

  const newStatus = v.action === 'approve' ? 'confirmed' : 'declined';
  await updateReservationStatus(env.DB, v.reservationId, newStatus);

  const updated = { ...row, status: newStatus } as typeof row;
  const guestMsg = newStatus === 'confirmed'
    ? buildGuestBookingApproved(updated)
    : buildGuestBookingDeclined(updated);

  ctx.waitUntil(
    sendEmail(env, {
      to: row.email, replyTo: env.CONTACT_TO_EMAIL,
      subject: guestMsg.subject, html: guestMsg.html, text: guestMsg.text,
    }).then(r => { if (!r.ok) r.text().then(t => console.error('Resend guest decision failed:', r.status, t)); })
      .catch(e => console.error('Resend guest decision failed:', e))
  );

  return decisionPage(
    newStatus === 'confirmed' ? 'Reservation approved' : 'Reservation declined',
    `<p>Confirmation email sent to <strong>${row.email}</strong>.</p>
     <p>Dates ${row.check_in} → ${row.check_out} are now <strong>${newStatus === 'confirmed' ? 'blocked' : 'released'}</strong>.</p>`,
  );
}
