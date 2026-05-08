import type { Env } from './index';
import type { ReservationRow } from './db';
import { depositEur } from './pricing';

const FROM     = 'Blue Moon Apartment <noreply@bluemoonmandre.eu>';
const SITE     = 'https://bluemoonmandre.eu';
const LOGO_URL = `${SITE}/images/logo-email.png`;

const BANK_IBAN   = 'LT71 3250 0786 7157 4572';
const BANK_HOLDER = 'Goran Falkoni';
const BANK_NAME   = 'Revolut';
const BANK_BIC    = 'REVOLT21';
export const BANK_DETAILS_PLACEHOLDER = `IBAN: ${BANK_IBAN} (${BANK_HOLDER}, ${BANK_NAME}, BIC/SWIFT ${BANK_BIC})`;

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

// ─── Shared template helpers ──────────────────────────────────────────────────

export function detailRow(label: string, value: string): string {
  return `<tr>
  <td width="38%" style="padding:9px 12px 9px 0;border-bottom:1px solid #d5eaf7;font-size:13px;font-family:Arial,Helvetica,sans-serif;color:#5a7080;font-weight:bold;vertical-align:top;">${label}</td>
  <td width="62%" style="padding:9px 0 9px 12px;border-bottom:1px solid #d5eaf7;font-size:14px;font-family:Arial,Helvetica,sans-serif;color:#1a2a3a;vertical-align:top;">${value}</td>
</tr>`;
}

export function detailTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EAF6FC;border-radius:8px;margin:12px 0 20px;"><tr><td style="padding:2px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`;
}

export function sectionHeading(text: string): string {
  return `<h3 style="margin:24px 0 0;padding-bottom:6px;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:bold;color:#1A5FAD;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #E8A82A;">${text}</h3>`;
}

export function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#EAF6FC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EAF6FC;">
<tr>
<td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">

<tr>
  <td style="background-color:#081628;padding:28px 32px;text-align:center;">
    <a href="${SITE}" style="display:block;text-decoration:none;"><img src="${LOGO_URL}" width="164" height="164" alt="Blue Moon Apartment" border="0" style="display:block;margin:0 auto 14px;border:0;"></a>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:1px;">Blue Moon Apartment</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4A9FD4;margin-top:6px;letter-spacing:0.5px;">Mandre &nbsp;&bull;&nbsp; Island of Pag &nbsp;&bull;&nbsp; Croatia</div>
  </td>
</tr>

<tr>
  <td style="height:4px;background-color:#E8A82A;font-size:0;line-height:0;">&nbsp;</td>
</tr>

<tr>
  <td style="padding:36px 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a2a3a;line-height:1.6;">
${content}
  </td>
</tr>

<tr>
  <td style="background-color:#F7EDD8;padding:20px 40px;border-top:1px solid #e0d5c0;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a2a3a;line-height:1.8;">
      <strong style="font-size:15px;color:#081628;">Goran Falkoni</strong><br>
      <span style="color:#5a7080;">Apartment Blue Moon</span><br>
      E:&nbsp;<a href="mailto:bluemoon.mandre@gmail.com" style="color:#1A5FAD;text-decoration:none;">bluemoon.mandre@gmail.com</a><br>
      T:&nbsp;<a href="https://wa.me/385914691204" style="color:#1A5FAD;text-decoration:none;">+385 91 469 1204</a>
    </div>
  </td>
</tr>

<tr>
  <td style="background-color:#061324;padding:14px 32px;text-align:center;">
    <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5a7080;">
      &copy; 2026 Blue Moon Apartment &nbsp;&bull;&nbsp;
      <a href="${SITE}" style="color:#4A9FD4;text-decoration:none;">bluemoonmandre.eu</a>
    </span>
  </td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
}

// ─── Booking summary rows ─────────────────────────────────────────────────────

function summaryRowsHtml(r: ReservationRow): string {
  return [
    detailRow('Check-in',  `<strong style="color:#1A5FAD;">${fmtDateLong(r.check_in)}</strong>`),
    detailRow('Check-out', `<strong style="color:#1A5FAD;">${fmtDateLong(r.check_out)}</strong>`),
    detailRow('Nights',    String(r.nights)),
    detailRow('Guests',    r.guests + (r.children_ages ? ` <span style="color:#5a7080;font-size:13px;">(children: ${esc(r.children_ages)})</span>` : '')),
    detailRow('Total',     `<strong style="color:#081628;font-size:15px;">€${r.total_eur.toLocaleString('en-GB')}</strong>`),
  ].join('\n');
}

// ─── Plain-text signature ─────────────────────────────────────────────────────

const TEXT_SIG = [
  '',
  '--',
  'Goran Falkoni',
  'Apartment Blue Moon',
  'E: bluemoon.mandre@gmail.com',
  'T: +385 91 469 1204',
].join('\n');

// ─── Email builders ───────────────────────────────────────────────────────────

export interface OwnerNotificationLinks { approve: string; decline: string }

export function buildOwnerBookingNotification(
  r: ReservationRow, links: OwnerNotificationLinks,
): { subject: string; html: string; text: string } {
  const subject = `New reservation request — ${r.full_name} (${r.check_in} → ${r.check_out})`;
  const deposit = depositEur(r.total_eur);

  const guestRows = [
    detailRow('Name',      `<strong>${esc(r.full_name)}</strong>`),
    detailRow('Email',     `<a href="mailto:${esc(r.email)}" style="color:#1A5FAD;text-decoration:none;">${esc(r.email)}</a>`),
    r.phone    ? detailRow('Phone',     esc(r.phone))    : null,
    r.language ? detailRow('Language',  esc(r.language)) : null,
    r.country  ? detailRow('Country',   esc(r.country))  : null,
    r.address  ? detailRow('Address',   esc(r.address))  : null,
    r.source   ? detailRow('Heard via', esc(r.source))   : null,
  ].filter((s): s is string => s !== null).join('\n');

  const bookingRows = [
    detailRow('Check-in',  `<strong style="color:#1A5FAD;">${fmtDateLong(r.check_in)}</strong>`),
    detailRow('Check-out', `<strong style="color:#1A5FAD;">${fmtDateLong(r.check_out)}</strong>`),
    detailRow('Nights',    String(r.nights)),
    detailRow('Guests',    r.guests + (r.children_ages ? ` (children: ${esc(r.children_ages)})` : '')),
    detailRow('Total',          `<strong style="font-size:15px;">€${r.total_eur.toLocaleString('en-GB')}</strong>`),
    detailRow('Deposit (30%)',  `<strong style="color:#1A5FAD;">€${deposit.toLocaleString('en-GB')}</strong>`),
    detailRow('Pay within',     '<strong>3 days</strong> of approval'),
    r.message  ? detailRow('Message', `<em>${esc(r.message)}</em>`) : null,
  ].filter((s): s is string => s !== null).join('\n');

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 8px;">New Reservation Request</div>
<p style="margin:0 0 20px;font-size:15px;color:#5a7080;">A guest submitted a reservation. The dates are <strong style="color:#E8A82A;">held as pending</strong> until you decide.</p>

${sectionHeading('Guest Details')}
${detailTable(guestRows)}

${sectionHeading('Booking Details')}
${detailTable(bookingRows)}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
  <tr>
    <td width="50%" style="padding-right:8px;">
      <a href="${links.approve}" style="display:block;text-align:center;background-color:#1A5FAD;color:#ffffff;padding:13px 20px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">&#10003;&nbsp; Approve</a>
    </td>
    <td width="50%" style="padding-left:8px;">
      <a href="${links.decline}" style="display:block;text-align:center;background-color:#8a9db0;color:#ffffff;padding:13px 20px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">&#10007;&nbsp; Decline</a>
    </td>
  </tr>
</table>
<p style="margin:0;font-size:12px;color:#8a9db0;text-align:center;">You can also manage reservations from the <a href="${SITE}/admin" style="color:#4A9FD4;text-decoration:none;">admin page</a>.</p>`;

  const html = emailShell(content);

  const text = [
    'New Reservation Request',
    '',
    `Name: ${r.full_name}`,
    `Email: ${r.email}`,
    r.phone    ? `Phone: ${r.phone}`       : null,
    r.language ? `Language: ${r.language}` : null,
    r.country  ? `Country:  ${r.country}`  : null,
    r.address  ? `Address:  ${r.address}`  : null,
    r.source   ? `Heard via: ${r.source}`  : null,
    `Check-in:  ${r.check_in}`,
    `Check-out: ${r.check_out}`,
    `Nights:    ${r.nights}`,
    `Guests:    ${r.guests}${r.children_ages ? ` (children: ${r.children_ages})` : ''}`,
    `Total:     €${r.total_eur}`,
    `Deposit:   €${deposit} (due within 3 days of approval)`,
    r.message  ? `Message: ${r.message}`   : null,
    '',
    `Approve: ${links.approve}`,
    `Decline: ${links.decline}`,
    TEXT_SIG,
  ].filter((s): s is string => s !== null).join('\n');

  return { subject, html, text };
}

export function buildGuestBookingPending(r: ReservationRow): { subject: string; html: string; text: string } {
  const firstName = r.full_name.split(' ')[0];
  const subject   = "We've received your reservation request — Blue Moon Apartment";

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 12px;">Thank you, ${esc(firstName)}!</div>
<p style="margin:0 0 24px;font-size:15px;color:#1a2a3a;line-height:1.6;">We received your reservation request. We'll review it and respond <strong>within 24 hours</strong>. Your selected dates are held until then.</p>

${sectionHeading('Your Request')}
${detailTable(summaryRowsHtml(r))}

<p style="margin:0;font-size:14px;color:#5a7080;">If anything changes in the meantime, simply reply to this email and we'll be happy to help.</p>`;

  const html = emailShell(content);

  const text = [
    `Thank you, ${firstName}!`,
    '',
    "We received your reservation request. We'll review it and respond within 24 hours. Your selected dates are held until then.",
    '',
    'Your request:',
    `Check-in:  ${r.check_in}`,
    `Check-out: ${r.check_out}`,
    `Nights:    ${r.nights}`,
    `Guests:    ${r.guests}`,
    `Total:     €${r.total_eur}`,
    TEXT_SIG,
  ].join('\n');

  return { subject, html, text };
}

export function buildGuestBookingApproved(r: ReservationRow): { subject: string; html: string; text: string } {
  const firstName = r.full_name.split(' ')[0];
  const deposit   = depositEur(r.total_eur);
  const remainder = r.total_eur - deposit;
  const subject   = 'Your reservation is confirmed — Blue Moon Apartment';

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 12px;">Your reservation is confirmed, ${esc(firstName)}!</div>
<p style="margin:0 0 24px;font-size:15px;color:#1a2a3a;line-height:1.6;">We're delighted to confirm your stay at Blue Moon Apartment. We look forward to welcoming you to Mandre!</p>

${sectionHeading('Stay Details')}
${detailTable(summaryRowsHtml(r))}

${sectionHeading('Payment')}
<p style="margin:12px 0 16px;font-size:15px;color:#1a2a3a;line-height:1.6;">To secure your booking, please transfer the <strong style="color:#1A5FAD;">30% deposit of €${deposit.toLocaleString('en-GB')}</strong> within 3 days. The remaining <strong>€${remainder.toLocaleString('en-GB')}</strong> is due by bank transfer on arrival.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;background-color:#EAF6FC;border-radius:8px;border-left:4px solid #E8A82A;">
  <tr><td style="padding:16px 20px;">
    <div style="font-size:11px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#5a7080;margin-bottom:4px;">IBAN</div>
    <div style="font-size:19px;font-family:'Courier New',Courier,monospace;font-weight:bold;color:#081628;letter-spacing:2px;margin-bottom:16px;">${BANK_IBAN}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:28px;vertical-align:top;">
          <div style="font-size:11px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#5a7080;margin-bottom:3px;">Account holder</div>
          <div style="font-size:14px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;color:#1a2a3a;">${BANK_HOLDER}</div>
        </td>
        <td style="padding-right:28px;vertical-align:top;">
          <div style="font-size:11px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#5a7080;margin-bottom:3px;">Bank</div>
          <div style="font-size:14px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;color:#1a2a3a;">${BANK_NAME}</div>
        </td>
        <td style="vertical-align:top;">
          <div style="font-size:11px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#5a7080;margin-bottom:3px;">BIC / SWIFT</div>
          <div style="font-size:14px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;color:#1a2a3a;">${BANK_BIC}</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
<p style="margin:0 0 24px;font-size:14px;color:#5a7080;">Once your deposit is received, you're all set! We'll take care of everything from here — just sit back and look forward to your vacation in Mandre.</p>

${sectionHeading('Check-in Information')}
<p style="margin:12px 0;font-size:15px;color:#1a2a3a;line-height:1.6;">Check-in is from <strong>4:00 PM</strong> on ${fmtDateLong(r.check_in)}. Check-out is by <strong>10:00 AM</strong> on ${fmtDateLong(r.check_out)}. If you need different times, just let us know.</p>
<p style="margin:0 0 24px;font-size:15px;color:#1a2a3a;">Address: <strong>Riječka ulica 30, Mandre, Island of Pag</strong>.</p>
<p style="margin:0;font-size:14px;color:#5a7080;">If you have any questions, simply reply to this email.</p>`;

  const html = emailShell(content);

  const text = [
    `Your reservation is confirmed, ${firstName}!`,
    '',
    `Check-in:  ${r.check_in}`,
    `Check-out: ${r.check_out}`,
    `Nights:    ${r.nights}`,
    `Guests:    ${r.guests}`,
    `Total:     €${r.total_eur}`,
    '',
    `30% deposit (€${deposit}) due within 3 days. Remaining €${remainder} due by bank transfer on arrival.`,
    `IBAN: ${BANK_IBAN}`,
    `Account holder: ${BANK_HOLDER}`,
    `Bank: ${BANK_NAME}`,
    `BIC/SWIFT: ${BANK_BIC}`,
    '',
    'Once your deposit is received, you\'re all set — just look forward to your vacation in Mandre!',
    '',
    'Check-in from 4:00 PM. Check-out by 10:00 AM.',
    'Address: Riječka ulica 30, Mandre, Island of Pag.',
    TEXT_SIG,
  ].join('\n');

  return { subject, html, text };
}

