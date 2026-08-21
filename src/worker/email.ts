import type { Env } from './index';
import type { ReservationRow } from './db';
import { depositEur } from './pricing';
import { getTranslations, INTL_LOCALE_MAP, type SupportedLang, SUPPORTED_LANGS } from '../i18n/utils';

function tpl(s: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((r, [k, v]) => r.replace(`{{${k}}}`, String(v)), s);
}

function safeLang(lang: string | null | undefined): SupportedLang {
  const l = (lang ?? 'en') as SupportedLang;
  return SUPPORTED_LANGS.includes(l) ? l : 'en';
}

const FROM     = 'Blue Moon Apartment <reservations@bluemoonmandre.eu>';
const SITE     = 'https://bluemoonmandre.eu';
const LOGO_URL = `${SITE}/images/logo-email.png`;

const BANK_IBAN   = 'LT71 3250 0786 7157 4572';
const BANK_HOLDER = 'Goran Falkoni';
const BANK_NAME   = 'Revolut';
const BANK_BIC    = 'REVOLT21';
const REVOLUT_URL = 'https://revolut.me/gfalkoni';
const WHATSAPP_URL = 'https://wa.me/385914691204';
export const BANK_DETAILS_PLACEHOLDER = `IBAN: ${BANK_IBAN} (${BANK_HOLDER}, ${BANK_NAME}, BIC/SWIFT ${BANK_BIC})`;

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
}

export interface SendEmailInput {
  from?: string;
  to: string;
  bcc?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
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
      bcc: m.bcc,
      reply_to: m.replyTo,
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: m.attachments,
    }),
  });
}

function fmtDateLong(iso: string, locale = 'en-GB'): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString(locale, {
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
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#081628;padding-bottom:2px;"><strong>Goran Falkoni</strong></td>
        <td style="text-align:right;padding-left:24px;padding-bottom:2px;">&nbsp;</td>
      </tr>
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#5a7080;padding-bottom:2px;">Blue Moon Apartment</td>
        <td style="text-align:right;padding-left:24px;padding-bottom:2px;">&nbsp;</td>
      </tr>
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a2a3a;padding-bottom:2px;">E:&nbsp;<a href="mailto:bluemoon.mandre@gmail.com" style="color:#1A5FAD;text-decoration:none;">bluemoon.mandre@gmail.com</a></td>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a2a3a;text-align:right;padding-left:24px;padding-bottom:2px;white-space:nowrap;"><span style="color:#5a7080;">IBAN:</span>&nbsp;<span style="font-weight:bold;color:#081628;">${BANK_IBAN}</span></td>
      </tr>
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a2a3a;">T:&nbsp;<a href="https://wa.me/385914691204" style="color:#1A5FAD;text-decoration:none;">+385 91 469 1204</a></td>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;text-align:right;padding-left:24px;"><a href="${REVOLUT_URL}" style="color:#1A5FAD;text-decoration:none;">revolut.me/gfalkoni</a></td>
      </tr>
    </table>
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

// ─── Discount helpers ─────────────────────────────────────────────────────────

function totalHtml(r: ReservationRow): string {
  if (r.full_total_eur != null && r.full_total_eur > r.total_eur) {
    const pct = r.discount_pct ?? Math.round((1 - r.total_eur / r.full_total_eur) * 100);
    return `<s style="color:#8a9db0;font-size:0.88em;">€${r.full_total_eur.toLocaleString('en-GB')}</s> <strong style="color:#E8A82A;font-size:15px;">€${r.total_eur.toLocaleString('en-GB')}</strong> <span style="background:#E8A82A;color:#fff;border-radius:50px;padding:2px 8px;font-size:11px;font-weight:800;">-${pct}%</span>`;
  }
  return `<strong style="color:#081628;font-size:15px;">€${r.total_eur.toLocaleString('en-GB')}</strong>`;
}

function totalText(r: ReservationRow): string {
  if (r.full_total_eur != null && r.full_total_eur > r.total_eur) {
    const pct = r.discount_pct ?? Math.round((1 - r.total_eur / r.full_total_eur) * 100);
    return `~~€${r.full_total_eur}~~ €${r.total_eur} (-${pct}%)`;
  }
  return `€${r.total_eur}`;
}

// ─── Booking summary rows ─────────────────────────────────────────────────────

function summaryRowsHtml(r: ReservationRow, locale: string, labels: { checkin: string; checkout: string; nights: string; guests: string; total: string }): string {
  return [
    detailRow(labels.checkin,  `<strong style="color:#1A5FAD;">${fmtDateLong(r.check_in, locale)}</strong>`),
    detailRow(labels.checkout, `<strong style="color:#1A5FAD;">${fmtDateLong(r.check_out, locale)}</strong>`),
    detailRow(labels.nights,   String(r.nights)),
    detailRow(labels.guests,   r.guests + (r.children_ages ? ` <span style="color:#5a7080;font-size:13px;">(${esc(r.children_ages)})</span>` : '')),
    detailRow(labels.total,    totalHtml(r)),
  ].join('\n');
}

// ─── Plain-text signature ─────────────────────────────────────────────────────

const TEXT_SIG = [
  '',
  '--',
  'Goran Falkoni',
  'Blue Moon Apartment',
  'E: bluemoon.mandre@gmail.com',
  'T: +385 91 469 1204',
  `IBAN: ${BANK_IBAN}`,
  `Revolut: ${REVOLUT_URL}`,
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
    detailRow('Total',          totalHtml(r)),
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
    `Total:     ${totalText(r)}`,
    `Deposit:   €${deposit} (due within 3 days of approval)`,
    r.message  ? `Message: ${r.message}`   : null,
    '',
    `Approve: ${links.approve}`,
    `Decline: ${links.decline}`,
    TEXT_SIG,
  ].filter((s): s is string => s !== null).join('\n');

  return { subject, html, text };
}

export function buildGuestBookingPending(r: ReservationRow, langCode?: string): { subject: string; html: string; text: string } {
  const lang    = safeLang(langCode ?? r.language);
  const T       = getTranslations(lang);
  const locale  = INTL_LOCALE_MAP[lang];
  const e       = T.email;
  const labels  = { checkin: e.tableCheckin, checkout: e.tableCheckout, nights: e.tableNights, guests: e.tableGuests, total: e.tableTotal };
  const firstName = r.full_name.split(' ')[0];
  const subject   = e.pendingSubject;

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 12px;">${esc(tpl(e.pendingHeading, { name: firstName }))}</div>
<p style="margin:0 0 24px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.pendingBody)}</p>

${sectionHeading(e.pendingSection)}
${detailTable(summaryRowsHtml(r, locale, labels))}

<p style="margin:0;font-size:14px;color:#5a7080;">${esc(e.pendingFollowUp)}</p>`;

  const html = emailShell(content);

  const text = [
    tpl(e.pendingHeading, { name: firstName }),
    '',
    e.pendingBody,
    '',
    e.pendingSection + ':',
    `${e.tableCheckin}:  ${fmtDateLong(r.check_in, locale)}`,
    `${e.tableCheckout}: ${fmtDateLong(r.check_out, locale)}`,
    `${e.tableNights}:   ${r.nights}`,
    `${e.tableGuests}:   ${r.guests}`,
    `${e.tableTotal}:    ${totalText(r)}`,
    TEXT_SIG,
  ].join('\n');

  return { subject, html, text };
}

export function buildGuestDepositReceived(r: ReservationRow, langCode?: string): { subject: string; html: string; text: string } {
  const lang    = safeLang(langCode ?? r.language);
  const T       = getTranslations(lang);
  const locale  = INTL_LOCALE_MAP[lang];
  const e       = T.email;
  const labels  = { checkin: e.tableCheckin, checkout: e.tableCheckout, nights: e.tableNights, guests: e.tableGuests, total: e.tableTotal };
  const firstName = r.full_name.split(' ')[0];
  const deposit   = depositEur(r.total_eur);
  const remainder = r.total_eur - deposit;
  const subject   = e.depositSubject;

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 12px;">${esc(tpl(e.depositHeading, { name: firstName }))}</div>
<p style="margin:0 0 24px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(tpl(e.depositBody, { deposit: deposit.toLocaleString('en-GB') }))}</p>

${sectionHeading(e.depositStaySection)}
${detailTable(summaryRowsHtml(r, locale, labels))}

${sectionHeading(e.depositBalanceSection)}
<p style="margin:12px 0 24px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.depositBalanceBody).replace('€{{remainder}}', `<strong style="color:#081628;">€${remainder.toLocaleString('en-GB')}</strong>`)}</p>

${sectionHeading(e.depositCheckinSection)}
<p style="margin:12px 0;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(tpl(e.depositCheckinBody, { checkin: fmtDateLong(r.check_in, locale), checkout: fmtDateLong(r.check_out, locale) }))}</p>
<p style="margin:0;font-size:15px;color:#1a2a3a;">${esc(e.approvedAddress)} <strong><a href="https://www.google.com/maps/dir/?api=1&amp;destination=Blue+Moon+Apartment&amp;destination_place_id=ChIJjWwKavA3YkcRtIxHt59t0pQ" style="color:#1A5FAD;text-decoration:none;" target="_blank">Riječka ulica 30, Mandre, Island of Pag</a></strong>.</p>`;

  const html = emailShell(content);

  const text = [
    tpl(e.depositHeading, { name: firstName }),
    '',
    tpl(e.depositBody, { deposit: String(deposit) }),
    '',
    `${e.tableCheckin}:  ${fmtDateLong(r.check_in, locale)}`,
    `${e.tableCheckout}: ${fmtDateLong(r.check_out, locale)}`,
    `${e.tableNights}:   ${r.nights}`,
    `${e.tableGuests}:   ${r.guests}`,
    `${e.tableTotal}:    ${totalText(r)}`,
    '',
    tpl(e.depositBalanceBody, { remainder: String(remainder) }),
    '',
    tpl(e.depositCheckinBody, { checkin: r.check_in, checkout: r.check_out }),
    'Address: Riječka ulica 30, Mandre, Island of Pag.',
    TEXT_SIG,
  ].join('\n');

  return { subject, html, text };
}

/**
 * The "any questions" line, whose {{whatsapp}} placeholder becomes a tappable link in
 * the HTML part and a spelled-out URL in the text part — so the word is never a dead
 * end in a plain-text client. esc() leaves the braces alone, so escaping first is safe.
 */
function questionsHtml(line: string): string {
  return esc(line).replace(
    '{{whatsapp}}',
    `<a href="${WHATSAPP_URL}" style="color:#1A5FAD;text-decoration:none;font-weight:bold;">WhatsApp</a>`,
  );
}

function questionsText(line: string): string {
  return line.replace('{{whatsapp}}', `WhatsApp (${WHATSAPP_URL})`);
}

/**
 * The IBAN / account panel shared by both approval mails. Inline styles only — email
 * clients strip <style> blocks, so every rule has to live on the element.
 */
function bankDetailsPanel(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;background-color:#EAF6FC;border-radius:8px;border-left:4px solid #E8A82A;">
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
        <td style="padding-right:28px;vertical-align:top;">
          <div style="font-size:11px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#5a7080;margin-bottom:3px;">BIC / SWIFT</div>
          <div style="font-size:14px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;color:#1a2a3a;">${BANK_BIC}</div>
        </td>
        <td style="vertical-align:top;">
          <div style="font-size:11px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;color:#5a7080;margin-bottom:3px;">Revolut</div>
          <div style="font-size:14px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;"><a href="${REVOLUT_URL}" style="color:#1A5FAD;text-decoration:none;">revolut.me/gfalkoni</a></div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
}

/**
 * Plain-text counterpart of bankDetailsPanel(), as the lines of a text-part body.
 */
function bankDetailsText(): string[] {
  return [
    `IBAN: ${BANK_IBAN}`,
    `Account holder: ${BANK_HOLDER}`,
    `Bank: ${BANK_NAME}`,
    `BIC/SWIFT: ${BANK_BIC}`,
  ];
}

export function buildGuestBookingApproved(r: ReservationRow, langCode?: string): { subject: string; html: string; text: string } {
  const lang    = safeLang(langCode ?? r.language);
  const T       = getTranslations(lang);
  const locale  = INTL_LOCALE_MAP[lang];
  const e       = T.email;
  const labels  = { checkin: e.tableCheckin, checkout: e.tableCheckout, nights: e.tableNights, guests: e.tableGuests, total: e.tableTotal };
  const firstName = r.full_name.split(' ')[0];
  const deposit   = depositEur(r.total_eur);
  const remainder = r.total_eur - deposit;
  const subject   = e.approvedSubject;

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 12px;">${esc(e.approvedHeading)}</div>
<p style="margin:0 0 24px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.approvedBody)}</p>

${sectionHeading(e.approvedStaySection)}
${detailTable(summaryRowsHtml(r, locale, labels))}

${sectionHeading(e.approvedPaymentSection)}
<p style="margin:12px 0 16px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.approvedPaymentBody).replace('€{{deposit}}', `<strong style="color:#081628;">€${deposit.toLocaleString('en-GB')}</strong>`).replace('{{remainder}}', remainder.toLocaleString('en-GB'))}</p>
${bankDetailsPanel()}

${sectionHeading(e.approvedCheckinSection)}
<p style="margin:12px 0;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(tpl(e.approvedCheckinBody, { checkin: fmtDateLong(r.check_in, locale), checkout: fmtDateLong(r.check_out, locale) }))}</p>
<p style="margin:0 0 24px;font-size:15px;color:#1a2a3a;">${esc(e.approvedAddress)} <strong><a href="https://www.google.com/maps/dir/?api=1&amp;destination=Blue+Moon+Apartment&amp;destination_place_id=ChIJjWwKavA3YkcRtIxHt59t0pQ" style="color:#1A5FAD;text-decoration:none;" target="_blank">Riječka ulica 30, Mandre, Island of Pag</a></strong>.</p>
<p style="margin:0;font-size:14px;color:#5a7080;">${questionsHtml(e.approvedQuestions)}</p>`;

  const html = emailShell(content);

  const text = [
    e.approvedHeading,
    '',
    e.approvedBody,
    '',
    `${e.tableCheckin}:  ${fmtDateLong(r.check_in, locale)}`,
    `${e.tableCheckout}: ${fmtDateLong(r.check_out, locale)}`,
    `${e.tableNights}:   ${r.nights}`,
    `${e.tableGuests}:   ${r.guests}`,
    `${e.tableTotal}:    ${totalText(r)}`,
    '',
    tpl(e.approvedPaymentBody, { deposit: String(deposit), remainder: String(remainder) }),
    ...bankDetailsText(),
    '',
    tpl(e.approvedCheckinBody, { checkin: r.check_in, checkout: r.check_out }),
    'Address: Riječka ulica 30, Mandre, Island of Pag.',
    TEXT_SIG,
  ].join('\n');

  return { subject, html, text };
}

// ─── Guest booking approved, no deposit ────────────────────────────

/**
 * The approval mail for stays taken without a deposit: the whole amount is settled by
 * the day of check-in at the latest. Sent by hand from the admin dashboard only.
 *
 * Differs from buildGuestBookingApproved in exactly two ways — the payment paragraph
 * asks for the full total rather than splitting it into deposit plus remainder, and the
 * check-in information section is dropped. Everything else, the bank panel included,
 * is the same mail.
 */
export function buildGuestBookingApprovedNoDeposit(r: ReservationRow, langCode?: string): { subject: string; html: string; text: string } {
  const lang   = safeLang(langCode ?? r.language);
  const T      = getTranslations(lang);
  const locale = INTL_LOCALE_MAP[lang];
  const e      = T.email;
  const labels = { checkin: e.tableCheckin, checkout: e.tableCheckout, nights: e.tableNights, guests: e.tableGuests, total: e.tableTotal };
  const total  = r.total_eur.toLocaleString('en-GB');

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 12px;">${esc(e.approvedHeading)}</div>
<p style="margin:0 0 24px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.noDepositBody)}</p>

${sectionHeading(e.approvedStaySection)}
${detailTable(summaryRowsHtml(r, locale, labels))}

${sectionHeading(e.approvedPaymentSection)}
<p style="margin:12px 0 16px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.noDepositPaymentBody).replace('€{{total}}', `<strong style="color:#081628;">€${total}</strong>`)}</p>
${bankDetailsPanel()}
<p style="margin:0;font-size:14px;color:#5a7080;">${questionsHtml(e.approvedQuestions)}</p>`;

  const html = emailShell(content);

  const text = [
    e.approvedHeading,
    '',
    e.noDepositBody,
    '',
    `${e.tableCheckin}:  ${fmtDateLong(r.check_in, locale)}`,
    `${e.tableCheckout}: ${fmtDateLong(r.check_out, locale)}`,
    `${e.tableNights}:   ${r.nights}`,
    `${e.tableGuests}:   ${r.guests}`,
    `${e.tableTotal}:    ${totalText(r)}`,
    '',
    tpl(e.noDepositPaymentBody, { total }),
    ...bankDetailsText(),
    TEXT_SIG,
  ].join('\n');

  return { subject: e.approvedSubject, html, text };
}

// ─── Guest welcome (short note; all detail lives on the guest guide page) ─────

export function buildGuestWelcome(r: ReservationRow, langCode?: string): { subject: string; html: string; text: string } {
  const lang      = safeLang(langCode ?? r.language);
  const e         = getTranslations(lang).email;
  const firstName = r.full_name.split(' ')[0];
  const guideUrl  = `${SITE}${lang === 'en' ? '' : `/${lang}`}/guest-guide`;
  const subject   = e.welcomeSubject;

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 12px;">${esc(tpl(e.welcomeHeading, { name: firstName }))}</div>
<p style="margin:0 0 28px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.welcomeBody)}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr>
    <td align="center">
      <a href="${guideUrl}" style="display:inline-block;background-color:#1A5FAD;color:#ffffff;padding:15px 34px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">${esc(e.welcomeCta)} &nbsp;&rarr;</a>
    </td>
  </tr>
</table>

<p style="margin:0;font-size:14px;color:#5a7080;line-height:1.6;">${esc(e.welcomeFollowUp)}</p>`;

  const html = emailShell(content);

  const text = [
    tpl(e.welcomeHeading, { name: firstName }),
    '',
    e.welcomeBody,
    '',
    `${e.welcomeCta}: ${guideUrl}`,
    '',
    e.welcomeFollowUp,
    TEXT_SIG,
  ].join('\n');

  return { subject, html, text };
}

// ─── Guest eVisitor request (pre-arrival; carries the key-locker code) ────────

const WHATSAPP_NUMBER = '385914691204';

/** Dates and times get the same blue emphasis they carry in the booking summary tables. */
function boldDate(s: string): string {
  return `<strong style="color:#1A5FAD;">${esc(s)}</strong>`;
}

/** Bulleted checklist inside the usual light-blue panel. */
function checklistPanel(items: string[]): string {
  const rows = items.map(item => `<tr>
    <td width="16" valign="top" style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#E8A82A;line-height:1.5;">&bull;</td>
    <td style="padding:4px 0 4px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a2a3a;line-height:1.5;">${item}</td>
  </tr>`).join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EAF6FC;border-radius:8px;margin:14px 0 18px;"><tr><td style="padding:14px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`;
}

/**
 * The one email that carries the key-locker combination. Sent by hand from the admin
 * dashboard a few days before arrival; `keyLockerCode` comes from the `key_locker_code`
 * setting so a change in admin applies to every mail sent afterwards.
 */
export function buildGuestEvisitorRequest(
  r: ReservationRow, keyLockerCode: string, langCode?: string,
): { subject: string; html: string; text: string } {
  const lang      = safeLang(langCode ?? r.language);
  const e         = getTranslations(lang).email;
  const locale    = INTL_LOCALE_MAP[lang];
  const firstName = r.full_name.split(' ')[0];
  const checkin   = fmtDateLong(r.check_in, locale);
  const guideUrl  = `${SITE}${lang === 'en' ? '' : `/${lang}`}/guest-guide`;
  const waUrl     = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(e.evisitorWhatsappPrefill)}`;
  const subject   = e.evisitorSubject;

  const fields = [
    e.evisitorFieldFirstName,
    e.evisitorFieldLastName,
    e.evisitorFieldDocType,
    e.evisitorFieldDocNumber,
    e.evisitorFieldGender,
    e.evisitorFieldCountryResidence,
    e.evisitorFieldCityResidence,
    e.evisitorFieldNationality,
    e.evisitorFieldCountryBirth,
    e.evisitorFieldDateOfBirth,
  ];

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 12px;">${esc(tpl(e.evisitorHeading, { name: firstName }))}</div>
<p style="margin:0 0 8px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.evisitorBody).replace('{{checkin}}', boldDate(checkin))}</p>

${sectionHeading(e.evisitorRegSection)}
<p style="margin:14px 0 0;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.evisitorRegBody)}</p>
${checklistPanel(fields.map(esc))}
<p style="margin:0 0 12px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.evisitorRegAlt)}</p>
<p style="margin:0 0 20px;font-size:13px;color:#5a7080;line-height:1.6;">${esc(e.evisitorRegPrivacy)}</p>

<p style="margin:0 0 14px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.evisitorSendBody)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
  <tr>
    <td align="center">
      <a href="${waUrl}" style="display:inline-block;background-color:#25D366;color:#ffffff;padding:15px 34px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">${esc(e.evisitorWhatsappCta)} &nbsp;&rarr;</a>
    </td>
  </tr>
</table>

${sectionHeading(e.evisitorLockerSection)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 14px;background-color:#081628;border-radius:10px;">
  <tr>
    <td align="center" style="padding:22px 20px;border:2px solid #E8A82A;border-radius:10px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#4A9FD4;margin-bottom:8px;">${esc(e.evisitorLockerLabel)}</div>
      <div style="font-family:'Courier New',Courier,monospace;font-size:42px;font-weight:bold;color:#E8A82A;letter-spacing:12px;line-height:1.1;">${esc(keyLockerCode)}</div>
    </td>
  </tr>
</table>
<p style="margin:0 0 4px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.evisitorLockerBody)}</p>

${sectionHeading(e.evisitorCheckinSection)}
<p style="margin:14px 0 12px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.evisitorCheckinBody).replace('{{time}}', boldDate(e.evisitorCheckinTime)).replace('{{checkin}}', boldDate(checkin))}</p>
<p style="margin:0 0 12px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.evisitorParkingBody)}</p>
<p style="margin:0 0 18px;font-size:15px;color:#1a2a3a;line-height:1.6;">${esc(e.evisitorGuideBody)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
  <tr>
    <td align="center">
      <a href="${guideUrl}" style="display:inline-block;background-color:#1A5FAD;color:#ffffff;padding:15px 34px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">${esc(e.evisitorGuideCta)} &nbsp;&rarr;</a>
    </td>
  </tr>
</table>

<p style="margin:0;font-size:14px;color:#5a7080;">${questionsHtml(e.approvedQuestions)}</p>`;

  const html = emailShell(content);

  const text = [
    tpl(e.evisitorHeading, { name: firstName }),
    '',
    tpl(e.evisitorBody, { checkin }),
    '',
    `${e.evisitorRegSection.toUpperCase()}`,
    e.evisitorRegBody,
    '',
    ...fields.map(f => `- ${f}`),
    '',
    e.evisitorRegAlt,
    e.evisitorRegPrivacy,
    '',
    e.evisitorSendBody,
    `${e.evisitorWhatsappCta}: ${waUrl}`,
    '',
    `${e.evisitorLockerSection.toUpperCase()}`,
    `${e.evisitorLockerLabel}: ${keyLockerCode}`,
    e.evisitorLockerBody,
    '',
    `${e.evisitorCheckinSection.toUpperCase()}`,
    tpl(tpl(e.evisitorCheckinBody, { time: e.evisitorCheckinTime }), { checkin }),
    e.evisitorParkingBody,
    '',
    e.evisitorGuideBody,
    `${e.evisitorGuideCta}: ${guideUrl}`,
    '',
    questionsText(e.approvedQuestions),
    TEXT_SIG,
  ].join('\n');

  return { subject, html, text };
}

// ─── Guest invoice (cover note; PDF sent as attachment) ───────────────────────

export function buildGuestInvoiceEmail(
  guestName: string, invoiceNumber: string,
): { subject: string; html: string; text: string } {
  const firstName = guestName.split(' ')[0] || guestName;
  const subject = `Invoice ${invoiceNumber} — Blue Moon Apartment`;

  const content = `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#081628;margin:0 0 16px;">Invoice <span style="color:#1A5FAD;">${esc(invoiceNumber)}</span></div>
<hr style="border:none;border-top:1px solid #e0e8f0;margin:0 0 22px;">
<p style="margin:0 0 20px;font-size:16px;color:#1a2a3a;line-height:1.8;">Dear ${esc(firstName)}, attached is your invoice for your stay at Blue Moon Apartment. Thank you for choosing us.</p>`;

  const html = emailShell(content);

  const text = [
    `Invoice ${invoiceNumber} — Blue Moon Apartment`,
    '',
    `Dear ${firstName}, attached is your invoice for your stay at Blue Moon Apartment. Thank you for choosing us.`,
    TEXT_SIG,
  ].join('\n');

  return { subject, html, text };
}

