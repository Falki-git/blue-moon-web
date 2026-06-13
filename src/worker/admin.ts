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
  getCleaningGuestWithRanges, getInvoice, getNextInvoiceSeq, upsertInvoice,
  listCrewDocs, getCrewDoc, insertCrewDoc, updateCrewDoc, deleteCrewDoc,
  type ReservationStatus, type GuestStayRange,
} from './db';
import { isInSeason, SEASON_MONTHS } from './pricing';
import {
  sendEmail, buildGuestBookingApproved, buildGuestDepositReceived, buildGuestInvoiceEmail,
} from './email';
import { buildInvoicePdf } from './invoice';

const INVOICE_BCC = 'bluemoon.mandre@gmail.com';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function pdfResponse(body: BodyInit, number: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

function err(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status });
}

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── Markdown → HTML (server-side, no client library needed) ──────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineMarkdown(raw: string): string {
  let s = escHtml(raw);
  // Images before links so ![...](...) doesn't get partially caught by link pattern
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    if (!/^https?:\/\//.test(src)) return alt || '';
    return `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;border-radius:4px;margin:0.25rem 0;">`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    if (!/^https?:\/\//.test(href) && !href.startsWith('/')) return label;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return s;
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inlineMarkdown(para.join(' '))}</p>`); para = []; }
  };
  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  for (const line of lines) {
    const hMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      flushPara(); closeLists();
      out.push(`<h${hMatch[1].length}>${inlineMarkdown(hMatch[2])}</h${hMatch[1].length}>`);
      continue;
    }
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      flushPara();
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushPara();
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${inlineMarkdown(olMatch[1])}</li>`);
      continue;
    }
    if (line.trim() === '') { flushPara(); closeLists(); continue; }
    closeLists();
    para.push(line.trim());
  }

  flushPara();
  closeLists();
  return out.join('\n');
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
    const month   = Number(body.month);
    const rate    = Number(body.rate_eur);
    const rawDisc = body.discount_rate_eur;
    const discount = (rawDisc != null && String(rawDisc).trim() !== '') ? Number(rawDisc) : rate;
    if (!SEASON_MONTHS.includes(month as 6 | 7 | 8 | 9)) {
      return err(400, 'Month must be 6, 7, 8, or 9');
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 10_000) {
      return err(400, 'Rate must be between 0 and 10000');
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 10_000) {
      return err(400, 'Discount rate must be between 0 and 10000');
    }
    if (discount > rate) {
      return err(400, 'Discount rate cannot exceed the full rate');
    }
    const roundedRate = Math.round(rate);
    const roundedDisc = Math.round(discount);
    await upsertPricingRule(env.DB, month, roundedRate, roundedDisc);
    return ok({ month, rate_eur: roundedRate, discount_rate_eur: roundedDisc });
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
    if (!guest_name) return err(400, 'guest_name is required');

    const guestResult = parseGuestBody(body);
    if ('error' in guestResult) return err(400, guestResult.error);

    const { fields, ranges } = guestResult;
    const id = crypto.randomUUID();
    const rangesWithIds: GuestStayRange[] = ranges.map(r => ({ ...r, id: crypto.randomUUID(), guest_id: id }));
    await insertCleaningGuest(env.DB, { id, guest_name, ...fields }, rangesWithIds);
    return ok({ id });
  }

  // ── Invoices ─────────────────────────────────────────────────────────────
  const invoiceNextMatch = path.match(/^cleaning-guests\/([^/]+)\/invoice\/next-number$/);
  if (invoiceNextMatch && request.method === 'GET') {
    const guest = await getCleaningGuestWithRanges(env.DB, invoiceNextMatch[1]);
    if (!guest) return err(404, 'Guest not found');
    if (guest.invoice) {
      return ok({ invoiceNumber: guest.invoice.invoice_number, exists: true, sentAt: guest.invoice.sent_at });
    }
    const year = Number(guest.check_in.slice(0, 4));
    const seq = await getNextInvoiceSeq(env.DB, year);
    return ok({ invoiceNumber: `${year}-${seq}`, exists: false, sentAt: null });
  }

  // View the sent invoice: serve the stored R2 copy, regenerating as a fallback
  // (e.g. local dev where the R2 object isn't present). Served inline so it
  // displays in the browser.
  const invoicePdfMatch = path.match(/^cleaning-guests\/([^/]+)\/invoice\/pdf$/);
  if (invoicePdfMatch && request.method === 'GET') {
    const id = invoicePdfMatch[1];
    const inv = await getInvoice(env.DB, id);
    if (!inv) return err(404, 'No invoice has been sent for this guest yet');
    const obj = await env.INVOICES.get(inv.r2_key);
    if (obj) return pdfResponse(obj.body, inv.invoice_number);
    const guest = await getCleaningGuestWithRanges(env.DB, id);
    if (!guest) return err(404, 'Guest not found');
    const dateISO = new Date().toISOString().slice(0, 10);
    const bytes = await buildInvoicePdf(guest, { invoiceNumber: inv.invoice_number, dateISO });
    return pdfResponse(bytes, inv.invoice_number);
  }

  // Preview an invoice without sending or storing it — regenerated on the fly.
  const invoicePreviewMatch = path.match(/^cleaning-guests\/([^/]+)\/invoice\/preview$/);
  if (invoicePreviewMatch && request.method === 'GET') {
    const id = invoicePreviewMatch[1];
    const guest = await getCleaningGuestWithRanges(env.DB, id);
    if (!guest) return err(404, 'Guest not found');
    if (guest.final_price === null && guest.ranges.length === 0) {
      return err(409, 'Guest has no price data to invoice');
    }
    const year = Number(guest.check_in.slice(0, 4));
    let number = (url.searchParams.get('number') ?? '').trim();
    if (!/^\d{4}-\d+$/.test(number)) {
      number = guest.invoice?.invoice_number ?? `${year}-${await getNextInvoiceSeq(env.DB, year)}`;
    }
    const dateISO = new Date().toISOString().slice(0, 10);
    const bytes = await buildInvoicePdf(guest, { invoiceNumber: number, dateISO });
    return pdfResponse(bytes, number);
  }

  const invoiceSendMatch = path.match(/^cleaning-guests\/([^/]+)\/invoice$/);
  if (invoiceSendMatch && request.method === 'POST') {
    const id = invoiceSendMatch[1];
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');
    const invoiceNumber = String(body.invoiceNumber ?? '').trim();
    const numMatch = invoiceNumber.match(/^(\d{4})-(\d+)$/);
    if (!numMatch) return err(400, 'Invoice number must be in the format yyyy-no (e.g. 2026-1)');
    const year = Number(numMatch[1]);
    const seq = Number(numMatch[2]);

    const guest = await getCleaningGuestWithRanges(env.DB, id);
    if (!guest) return err(404, 'Guest not found');
    if (!guest.email) return err(409, 'Guest has no email address');
    if (guest.final_price === null && guest.ranges.length === 0) {
      return err(409, 'Guest has no price data to invoice');
    }

    const dateISO = new Date().toISOString().slice(0, 10);
    const pdfBytes = await buildInvoicePdf(guest, { invoiceNumber, dateISO });

    const r2Key = `invoices/${invoiceNumber}.pdf`;
    // On resend with an edited number, drop the previous object.
    if (guest.invoice && guest.invoice.invoice_number !== invoiceNumber) {
      const old = await getInvoice(env.DB, id);
      if (old && old.r2_key !== r2Key) await env.INVOICES.delete(old.r2_key);
    }
    await env.INVOICES.put(r2Key, pdfBytes, { httpMetadata: { contentType: 'application/pdf' } });
    await upsertInvoice(env.DB, {
      guest_id: id, invoice_number: invoiceNumber, invoice_year: year, invoice_seq: seq, r2_key: r2Key,
    });

    const msg = buildGuestInvoiceEmail(guest.guest_name, invoiceNumber);
    const attachment = { filename: `invoice-${invoiceNumber}.pdf`, content: bytesToBase64(pdfBytes) };
    ctx.waitUntil(
      sendEmail(env, {
        to: guest.email, bcc: INVOICE_BCC, replyTo: env.CONTACT_TO_EMAIL,
        subject: msg.subject, html: msg.html, text: msg.text,
        attachments: [attachment],
      }).then(r => { if (!r.ok) r.text().then(t => console.error('Resend invoice failed:', r.status, t)); })
        .catch(e => console.error('Resend invoice failed:', e))
    );

    return ok({ invoiceNumber, sentAt: Math.floor(Date.now() / 1000) });
  }

  // ── Crew docs ─────────────────────────────────────────────────────────────

  if (path === 'docs' && request.method === 'GET') {
    const docs = await listCrewDocs(env.DB);
    return ok({ docs: docs.map(d => ({ ...d, slug: slugify(d.title) })) });
  }

  if (path === 'docs' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');
    const title = String(body.title ?? '').trim();
    const contentMd = String(body.content_md ?? '');
    if (!title) return err(400, 'title is required');
    const id = crypto.randomUUID();
    await insertCrewDoc(env.DB, { id, title, content_md: contentMd, content_html: markdownToHtml(contentMd) });
    return ok({ id });
  }

  const docMatch = path.match(/^docs\/([^/]+)$/);

  if (docMatch && request.method === 'GET') {
    const doc = await getCrewDoc(env.DB, docMatch[1]);
    if (!doc) return err(404, 'Doc not found');
    return ok({ doc: { id: doc.id, title: doc.title, content_md: doc.content_md, slug: slugify(doc.title), updated_at: doc.updated_at } });
  }

  if (docMatch && request.method === 'PUT') {
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');
    const title = String(body.title ?? '').trim();
    const contentMd = String(body.content_md ?? '');
    if (!title) return err(400, 'title is required');
    const existing = await getCrewDoc(env.DB, docMatch[1]);
    if (!existing) return err(404, 'Doc not found');
    await updateCrewDoc(env.DB, docMatch[1], { title, content_md: contentMd, content_html: markdownToHtml(contentMd) });
    return ok();
  }

  if (docMatch && request.method === 'DELETE') {
    await deleteCrewDoc(env.DB, docMatch[1]);
    return ok();
  }

  const cleaningGuestMatch = path.match(/^cleaning-guests\/([^/]+)$/);

  if (cleaningGuestMatch && request.method === 'PUT') {
    const id = cleaningGuestMatch[1];
    const body = await readJson(request);
    if (!body) return err(400, 'Invalid JSON');

    const guest_name = String(body.guest_name ?? '').trim();
    if (!guest_name) return err(400, 'guest_name is required');

    const guestResult = parseGuestBody(body);
    if ('error' in guestResult) return err(400, guestResult.error);

    const { fields, ranges } = guestResult;
    const rangesWithIds: GuestStayRange[] = ranges.map(r => ({ ...r, id: crypto.randomUUID(), guest_id: id }));
    await updateCleaningGuest(env.DB, id, { guest_name, ...fields }, rangesWithIds);
    return ok();
  }

  if (cleaningGuestMatch && request.method === 'DELETE') {
    await deleteCleaningGuest(env.DB, cleaningGuestMatch[1]);
    return ok();
  }

  return err(404, 'Not found');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

type ParsedGuestFields = {
  booking_number: string | null; country: string | null;
  check_in: string; check_out: string; booking_date: string | null;
  total_guests: number; adults: number; children: number;
  children_ages: string | null; nights: number;
  email: string | null; phone: string | null; notes: string | null;
  checkin_hour: string | null; checkout_hour: string | null;
  channel: string; commission: number | null; commission_pct: number | null;
  vat: number; vat_amount: number | null; cleaning_fee: number | null;
  final_price: number | null; payout: number | null; net_gain: number | null;
};

type RangeInput = Omit<GuestStayRange, 'id' | 'guest_id'>;

function parseGuestBody(
  body: Record<string, unknown>,
): { error: string } | { fields: ParsedGuestFields; ranges: RangeInput[] } {
  // Ranges
  const rawRanges = Array.isArray(body.ranges) ? body.ranges : [];
  if (rawRanges.length === 0) return { error: 'At least one pricing range is required' };

  const ranges: RangeInput[] = [];
  for (let i = 0; i < rawRanges.length; i++) {
    const r = rawRanges[i] as Record<string, unknown>;
    const start = String(r.start_date ?? '').trim();
    const end   = String(r.end_date   ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { error: `Range ${i + 1}: invalid start_date` };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end))   return { error: `Range ${i + 1}: invalid end_date` };
    if (end <= start) return { error: `Range ${i + 1}: end_date must be after start_date` };
    const full_price       = Number(r.full_price       ?? 0);
    const discounted_price = Number(r.discounted_price ?? 0);
    if (!Number.isFinite(full_price)       || full_price < 0)       return { error: `Range ${i + 1}: invalid full_price` };
    if (!Number.isFinite(discounted_price) || discounted_price < 0) return { error: `Range ${i + 1}: invalid discounted_price` };
    if (full_price > 0 && discounted_price > full_price)            return { error: `Range ${i + 1}: discounted price cannot exceed full price` };
    const nights     = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
    const range_total = round2(discounted_price * nights);
    ranges.push({ sort_order: i, start_date: start, end_date: end, full_price, discounted_price, nights, range_total });
  }

  // Contiguity check
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start_date !== ranges[i - 1].end_date)
      return { error: `Range ${i + 1} start must equal range ${i} end (ranges must be contiguous)` };
  }

  const total_nights = ranges.reduce((s, r) => s + r.nights, 0);
  const final_price  = round2(ranges.reduce((s, r) => s + r.range_total, 0));
  const check_in  = ranges[0].start_date;
  const check_out = ranges[ranges.length - 1].end_date;
  const nights    = total_nights;

  // Guest counts
  const total_guests = Number(body.total_guests ?? 1);
  const adults       = Number(body.adults       ?? 1);
  const children     = Number(body.children     ?? 0);
  if (!Number.isInteger(total_guests) || total_guests < 1) return { error: 'Invalid total_guests' };
  if (!Number.isInteger(adults)       || adults < 0)       return { error: 'Invalid adults' };
  if (!Number.isInteger(children)     || children < 0)     return { error: 'Invalid children' };

  // Financial
  const channel         = String(body.channel ?? 'booking.com').trim() || 'booking.com';
  const comm_raw        = body.commission !== undefined && body.commission !== null && body.commission !== ''
                          ? Number(body.commission) : null;
  const commission      = comm_raw !== null && Number.isFinite(comm_raw) ? round2(comm_raw) : null;
  const vat             = body.vat ? 1 : 0;
  const commission_pct  = commission !== null && final_price > 0 ? round1(commission / final_price * 100) : null;
  const payout          = commission !== null ? round2(final_price - commission) : null;
  const vat_amount      = commission !== null ? (vat ? round2(commission * 0.25) : 0) : null;
  const cf_raw          = body.cleaning_fee !== undefined && body.cleaning_fee !== null && body.cleaning_fee !== ''
                          ? Number(body.cleaning_fee) : null;
  const cleaning_fee    = cf_raw !== null && Number.isFinite(cf_raw) ? round2(cf_raw) : round2(140 + 7 * total_guests);
  const net_gain        = commission !== null && vat_amount !== null
                          ? round2(final_price - commission - vat_amount - cleaning_fee) : null;

  return {
    fields: {
      booking_number: String(body.booking_number ?? '').trim() || null,
      country:        String(body.country        ?? '').trim() || null,
      check_in, check_out,
      booking_date:   String(body.booking_date   ?? '').trim() || null,
      total_guests, adults, children,
      children_ages:  String(body.children_ages  ?? '').trim() || null,
      nights,
      email:          String(body.email          ?? '').trim() || null,
      phone:          String(body.phone          ?? '').trim() || null,
      notes:          String(body.notes          ?? '').trim() || null,
      checkin_hour:   String(body.checkin_hour   ?? '').trim() || null,
      checkout_hour:  String(body.checkout_hour  ?? '').trim() || null,
      channel, commission, commission_pct, vat, vat_amount, cleaning_fee, final_price, payout, net_gain,
    },
    ranges,
  };
}
