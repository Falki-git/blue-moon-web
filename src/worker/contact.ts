import type { Env } from './index';

const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEASON_START = '2026-06-01';
const SEASON_END   = '2026-09-30';
const FROM         = 'Blue Moon Apartment <noreply@bluemoonmandre.eu>';

const LANG_MAP: Record<string, string> = {
  en: 'English', hr: 'Croatian', de: 'German',
  si: 'Slovenian', it: 'Italian', pl: 'Polish', cz: 'Czech',
};

function err(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function handleContact(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return err(415, 'Content-Type must be application/json');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return err(400, 'Invalid JSON');
  }

  if (body['bot-field']) return err(400, 'Bad request');

  const fullName = String(body.fullName ?? '').trim();
  const email    = String(body.email    ?? '').trim();
  const checkin  = String(body.checkin  ?? '').trim();
  const checkout = String(body.checkout ?? '').trim();
  const guests   = body.guests ? Number(body.guests) : null;
  const phone    = String(body.phone    ?? '').trim();
  const acceptLang = request.headers.get('Accept-Language') ?? '';
  const language = acceptLang.split(',')[0].split('-')[0].trim() || 'en';
  const children = String(body.children ?? '').trim();
  const message  = String(body.message  ?? '').trim();
  const tsToken  = String(body['cf-turnstile-response'] ?? '');

  if (!fullName)                       return err(400, 'Full name is required');
  if (!email || !EMAIL_RE.test(email)) return err(400, 'Valid email is required');
  if (!message)                        return err(400, 'Message is required');

  if (checkin && (checkin < SEASON_START || checkin > '2026-09-27')) {
    return err(400, 'Check-in must be within the season (1 Jun – 27 Sep 2026)');
  }
  if (checkout && (checkout < '2026-06-04' || checkout > SEASON_END)) {
    return err(400, 'Check-out must be within the season (4 Jun – 30 Sep 2026)');
  }
  if (checkin && checkout && checkout < addDays(checkin, 5)) {
    return err(400, 'Minimum stay is 5 nights');
  }
  if (guests !== null && (guests < 1 || guests > 6)) {
    return err(400, 'Guests must be between 1 and 6');
  }

  // Turnstile verification
  const tsForm = new FormData();
  tsForm.append('secret', env.TURNSTILE_SECRET_KEY);
  tsForm.append('response', tsToken);
  tsForm.append('remoteip', request.headers.get('CF-Connecting-IP') ?? '');

  const tsRes  = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: tsForm });
  const tsData = await tsRes.json() as { success: boolean };
  if (!tsData.success) return err(400, 'Security check failed. Please try again.');

  const lang   = LANG_MAP[language] ?? language;
  const nights = (checkin && checkout)
    ? Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86_400_000)
    : null;

  // Owner notification email
  const ownerHtml = `
<h2>New Message</h2>
<table cellpadding="6">
  <tr><td><strong>Name:</strong></td><td>${esc(fullName)}</td></tr>
  <tr><td><strong>Email:</strong></td><td>${esc(email)}</td></tr>
  ${phone    ? `<tr><td><strong>Phone:</strong></td><td>${esc(phone)}</td></tr>`    : ''}
  <tr><td><strong>Language:</strong></td><td>${esc(lang)}</td></tr>
  ${checkin  ? `<tr><td><strong>Check-in:</strong></td><td>${esc(checkin)}</td></tr>`   : ''}
  ${checkout ? `<tr><td><strong>Check-out:</strong></td><td>${esc(checkout)}</td></tr>` : ''}
  ${nights !== null ? `<tr><td><strong>Nights:</strong></td><td>${nights}</td></tr>`    : ''}
  ${guests !== null ? `<tr><td><strong>Guests:</strong></td><td>${guests}</td></tr>`    : ''}
  ${children ? `<tr><td><strong>Children:</strong></td><td>${esc(children)}</td></tr>` : ''}
  ${message  ? `<tr><td><strong>Message:</strong></td><td>${esc(message)}</td></tr>`   : ''}
</table>`.trim();

  const ownerText = [
    'New Message',
    `Name: ${fullName}`,
    `Email: ${email}`,
    phone         ? `Phone: ${phone}`         : null,
    `Language: ${lang}`,
    checkin       ? `Check-in: ${checkin}`    : null,
    checkout      ? `Check-out: ${checkout}`  : null,
    nights !== null ? `Nights: ${nights}`     : null,
    guests !== null ? `Guests: ${guests}`     : null,
    children      ? `Children: ${children}`   : null,
    message       ? `Message: ${message}`     : null,
  ].filter(Boolean).join('\n');

  const ownerRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: env.CONTACT_TO_EMAIL,
      reply_to: email,
      subject: checkin && checkout
        ? `New message — ${fullName} (${checkin} → ${checkout})`
        : `New message — ${fullName}`,
      html: ownerHtml,
      text: ownerText,
    }),
  });

  if (!ownerRes.ok) {
    console.error('Resend owner email failed:', await ownerRes.text());
    return err(502, 'Failed to send message. Please email us directly at bluemoon.mandre@gmail.com');
  }

  // Guest acknowledgment — fire-and-forget, never blocks the response
  const firstName = fullName.split(' ')[0];
  const summaryRows = [
    checkin       ? `<tr><td><strong>Check-in:</strong></td><td>${esc(checkin)}</td></tr>`    : '',
    checkout      ? `<tr><td><strong>Check-out:</strong></td><td>${esc(checkout)}</td></tr>`  : '',
    nights !== null ? `<tr><td><strong>Duration:</strong></td><td>${nights} night${nights !== 1 ? 's' : ''}</td></tr>` : '',
    guests !== null ? `<tr><td><strong>Guests:</strong></td><td>${guests}</td></tr>`           : '',
  ].filter(Boolean).join('\n');

  const guestHtml = `
<h2>Thank you, ${esc(firstName)}!</h2>
<p>We received your message and will get back to you within 24 hours.</p>
${summaryRows ? `<h3>Your inquiry summary</h3><table cellpadding="6">${summaryRows}</table>` : ''}
<p>In the meantime, feel free to explore our <a href="https://bluemoonmandre.eu/gallery">gallery</a> or learn more about <a href="https://bluemoonmandre.eu/about-mandre">Mandre</a>.</p>
<p>— Goran, Blue Moon Apartment<br><a href="https://bluemoonmandre.eu">bluemoonmandre.eu</a></p>`.trim();

  const guestText = [
    `Thank you, ${firstName}!`,
    '',
    'We received your message and will get back to you within 24 hours.',
    checkin       ? `\nCheck-in:  ${checkin}`                                              : null,
    checkout      ? `Check-out: ${checkout}`                                               : null,
    nights !== null ? `Duration:  ${nights} night${nights !== 1 ? 's' : ''}`              : null,
    guests !== null ? `Guests:    ${guests}`                                               : null,
    '',
    '— Goran, Blue Moon Apartment',
    'https://bluemoonmandre.eu',
  ].filter(s => s !== null).join('\n');

  ctx.waitUntil(
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: email,
        reply_to: env.CONTACT_TO_EMAIL,
        subject: 'We received your inquiry — Blue Moon Apartment',
        html: guestHtml,
        text: guestText,
      }),
    }).then(r => { if (!r.ok) r.text().then(t => console.error('Resend guest ack failed:', r.status, t)); })
      .catch(e => console.error('Resend guest ack failed:', e))
  );

  return Response.json({ ok: true });
}
