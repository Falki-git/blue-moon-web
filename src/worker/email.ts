import type { Env } from './index';
import type { ReservationRow } from './db';
import { depositEur } from './pricing';

const FROM = 'Blue Moon Apartment <noreply@bluemoonmandre.eu>';
const SITE = 'https://bluemoonmandre.eu';

// Owner fills these in once and the confirmation email picks them up.
// Until filled, the confirmation email shows a TODO line so the owner notices.
export const BANK_DETAILS_PLACEHOLDER = 'LT71 3250 0786 7157 4572 (Goran Falkoni, Revolut, BIC/SWIFT REVOLT21)';

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SendEmailInput {
  from?: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(env: Env, m: SendEmailInput): Promise<Response> {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: m.from ?? FROM,
      to: m.to,
      reply_to: m.replyTo,
      subject: m.subject,
      html: m.html,
      text: m.text,
    }),
  });
}

function fmtDateLong(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function summaryRowsHtml(r: ReservationRow): string {
  return `
    <tr><td><strong>Check-in:</strong></td><td>${fmtDateLong(r.check_in)}</td></tr>
    <tr><td><strong>Check-out:</strong></td><td>${fmtDateLong(r.check_out)}</td></tr>
    <tr><td><strong>Nights:</strong></td><td>${r.nights}</td></tr>
    <tr><td><strong>Guests:</strong></td><td>${r.guests}${r.children_ages ? ` (children: ${esc(r.children_ages)})` : ''}</td></tr>
    <tr><td><strong>Total:</strong></td><td>€${r.total_eur.toLocaleString('en-GB')}</td></tr>
  `.trim();
}

export interface OwnerNotificationLinks { approve: string; decline: string }

export function buildOwnerBookingNotification(
  r: ReservationRow, links: OwnerNotificationLinks,
): { subject: string; html: string; text: string } {
  const subject = `New reservation request — ${r.full_name} (${r.check_in} → ${r.check_out})`;
  const html = `
<h2>New Reservation Request</h2>
<p>A guest just requested a reservation. The dates are held as <strong>pending</strong> until you decide.</p>
<table cellpadding="6">
  <tr><td><strong>Name:</strong></td><td>${esc(r.full_name)}</td></tr>
  <tr><td><strong>Email:</strong></td><td>${esc(r.email)}</td></tr>
  ${r.phone    ? `<tr><td><strong>Phone:</strong></td><td>${esc(r.phone)}</td></tr>`    : ''}
  ${r.language ? `<tr><td><strong>Language:</strong></td><td>${esc(r.language)}</td></tr>` : ''}
  ${r.address  ? `<tr><td><strong>Address:</strong></td><td>${esc(r.address)}</td></tr>` : ''}
  ${r.source   ? `<tr><td><strong>Heard via:</strong></td><td>${esc(r.source)}</td></tr>`  : ''}
  ${summaryRowsHtml(r)}
  ${r.message ? `<tr><td><strong>Message:</strong></td><td>${esc(r.message)}</td></tr>` : ''}
</table>
<p style="margin-top:1.5rem;">
  <a href="${links.approve}" style="display:inline-block;background:#1A5FAD;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-right:8px;">✓ Approve</a>
  <a href="${links.decline}" style="display:inline-block;background:#8a9db0;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">✗ Decline</a>
</p>
<p style="font-size:12px;color:#666;">You can also manage this from the admin page at ${SITE}/admin.</p>`.trim();

  const text = [
    'New Reservation Request',
    '',
    `Name: ${r.full_name}`,
    `Email: ${r.email}`,
    r.phone    ? `Phone: ${r.phone}`       : null,
    r.language ? `Language: ${r.language}` : null,
    r.address  ? `Address: ${r.address}`   : null,
    r.source   ? `Heard via: ${r.source}`  : null,
    `Check-in:  ${r.check_in}`,
    `Check-out: ${r.check_out}`,
    `Nights:    ${r.nights}`,
    `Guests:    ${r.guests}${r.children_ages ? ` (children: ${r.children_ages})` : ''}`,
    `Total:     €${r.total_eur}`,
    r.message ? `Message: ${r.message}` : null,
    '',
    `Approve: ${links.approve}`,
    `Decline: ${links.decline}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

export function buildGuestBookingPending(r: ReservationRow): { subject: string; html: string; text: string } {
  const firstName = r.full_name.split(' ')[0];
  const subject = "We've received your reservation request — Blue Moon Apartment";
  const html = `
<h2>Thank you, ${esc(firstName)}!</h2>
<p>We received your reservation request. We'll review it and respond within 24 hours. Your selected dates are held until then.</p>
<h3>Your request</h3>
<table cellpadding="6">${summaryRowsHtml(r)}</table>
<p>If anything changes in the meantime, just reply to this email.</p>
<p>— Goran, Blue Moon Apartment<br><a href="${SITE}">${SITE}</a></p>`.trim();
  const text = [
    `Thank you, ${firstName}!`, '',
    "We received your reservation request. We'll review it and respond within 24 hours. Your selected dates are held until then.",
    '',
    'Your request:',
    `Check-in:  ${r.check_in}`,
    `Check-out: ${r.check_out}`,
    `Nights:    ${r.nights}`,
    `Guests:    ${r.guests}`,
    `Total:     €${r.total_eur}`,
    '',
    '— Goran, Blue Moon Apartment',
    SITE,
  ].join('\n');
  return { subject, html, text };
}

export function buildGuestBookingApproved(r: ReservationRow): { subject: string; html: string; text: string } {
  const firstName = r.full_name.split(' ')[0];
  const deposit = depositEur(r.total_eur);
  const remainder = r.total_eur - deposit;
  const subject = 'Your reservation is confirmed — Blue Moon Apartment';
  const html = `
<h2>Your reservation is confirmed, ${esc(firstName)}!</h2>
<p>We're delighted to confirm your stay at Blue Moon Apartment.</p>
<h3>Stay details</h3>
<table cellpadding="6">${summaryRowsHtml(r)}</table>
<h3>Payment</h3>
<p>To secure your booking, please transfer the <strong>30% deposit of €${deposit.toLocaleString('en-GB')}</strong> within 7 days. The remaining <strong>€${remainder.toLocaleString('en-GB')}</strong> is due in cash on arrival.</p>
<p><strong>Bank details:</strong> ${esc(BANK_DETAILS_PLACEHOLDER)}</p>
<p>Once we receive the deposit we'll send you the keys/check-in details closer to your arrival date.</p>
<h3>Check-in</h3>
<p>Check-in is from <strong>4:00 PM</strong> on ${fmtDateLong(r.check_in)}. Check-out is by <strong>10:00 AM</strong> on ${fmtDateLong(r.check_out)}. If you need different times just let us know.</p>
<p>Address: <strong>Riječka ulica 30, Mandre, Island of Pag</strong>.</p>
<p>If you have any questions, simply reply to this email.</p>
<p>— Goran, Blue Moon Apartment<br><a href="${SITE}">${SITE}</a></p>`.trim();
  const text = [
    `Your reservation is confirmed, ${firstName}!`, '',
    `Check-in:  ${r.check_in}`,
    `Check-out: ${r.check_out}`,
    `Nights:    ${r.nights}`,
    `Guests:    ${r.guests}`,
    `Total:     €${r.total_eur}`,
    '',
    `30% deposit (€${deposit}) due within 7 days. Remaining €${remainder} due in cash on arrival.`,
    `Bank details: ${BANK_DETAILS_PLACEHOLDER}`,
    '',
    'Check-in from 4:00 PM. Check-out by 10:00 AM.',
    'Address: Riječka ulica 30, Mandre, Island of Pag.',
    '',
    '— Goran, Blue Moon Apartment',
    SITE,
  ].join('\n');
  return { subject, html, text };
}

export function buildGuestBookingDeclined(r: ReservationRow): { subject: string; html: string; text: string } {
  const firstName = r.full_name.split(' ')[0];
  const subject = 'Regarding your reservation request — Blue Moon Apartment';
  const html = `
<h2>Hello ${esc(firstName)},</h2>
<p>Thank you for your interest in Blue Moon Apartment. Unfortunately we are not able to accommodate your reservation for ${fmtDateLong(r.check_in)} – ${fmtDateLong(r.check_out)}.</p>
<p>If you'd like to consider alternative dates, you can browse live availability at <a href="${SITE}/booking">${SITE}/booking</a>, or simply reply to this email and we'll do our best to find something that works.</p>
<p>— Goran, Blue Moon Apartment<br><a href="${SITE}">${SITE}</a></p>`.trim();
  const text = [
    `Hello ${firstName},`, '',
    `Thank you for your interest in Blue Moon Apartment. Unfortunately we are not able to accommodate your reservation for ${r.check_in} – ${r.check_out}.`,
    '',
    `If you'd like to consider alternative dates, browse live availability at ${SITE}/booking, or reply to this email.`,
    '',
    '— Goran, Blue Moon Apartment',
    SITE,
  ].join('\n');
  return { subject, html, text };
}
