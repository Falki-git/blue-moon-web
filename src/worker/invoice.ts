import { PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import regularFontBytes from './assets/DejaVuSans.ttf';
import boldFontBytes from './assets/DejaVuSans-Bold.ttf';
import logoBytes from '../../public/images/logo-email.png';
import type { CleaningGuestWithRanges } from './db';

// ── Owner / property constants (invoice header) ────────────────────────────────
const OWNER = {
  name: 'Goran Falkoni',
  oib: '60043516852',
  address: 'Potočka 10, 10040 Zagreb',
  iban: 'LT713250078671574572',
  revolut: 'revolut.me/gfalkoni',
};
const PLACE = 'Riječka ulica 30, Mandre';
const ACCOMM_UNIT = 'Blue Moon Apartment';
const SITE = 'https://bluemoonmandre.eu';

// ── Palette (matches the guest email templates) ────────────────────────────────
const NAVY      = rgb(0.031, 0.086, 0.157); // #081628 header band
const NAVY_DARK = rgb(0.024, 0.075, 0.141); // #061324 copyright band
const OCEAN     = rgb(0.102, 0.373, 0.678); // #1A5FAD headings / accents
const SKY       = rgb(0.290, 0.624, 0.831); // #4A9FD4 subtitle / copyright
const GOLD      = rgb(0.910, 0.659, 0.165); // #E8A82A accent rule
const SOFTBLUE  = rgb(0.918, 0.965, 0.988); // #EAF6FC notes panel
const CREAM     = rgb(0.969, 0.929, 0.847); // #F7EDD8 contact band
const TEXT      = rgb(0.102, 0.165, 0.227); // #1a2a3a primary (English) body text
const MUTED     = rgb(0.353, 0.439, 0.502); // #5a7080 secondary (Croatian) text
const LINE_BLUE = rgb(0.835, 0.918, 0.969); // #d5eaf7 row separators
const WHITE     = rgb(1, 1, 1);

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const SEP = '   /   ';

export interface InvoiceOptions {
  invoiceNumber: string;
  dateISO: string; // creation date (yyyy-mm-dd)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtMoney(n: number): string {
  return '€' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}.`;
}

interface LineItem {
  rangeLabel: string;
  nights: number;
  unitPrice: number;
  amount: number;
}

function buildLineItems(guest: CleaningGuestWithRanges): { items: LineItem[]; net: number; finalPrice: number } {
  const finalPrice = guest.final_price ?? round2(guest.ranges.reduce((s, r) => s + r.range_total, 0));
  if (guest.ranges.length > 0) {
    const items = guest.ranges.map(r => ({
      rangeLabel: `${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}`,
      nights: r.nights,
      unitPrice: r.full_price,
      amount: round2(r.full_price * r.nights),
    }));
    const net = round2(items.reduce((s, it) => s + it.amount, 0));
    return { items, net, finalPrice };
  }
  const nights = guest.nights || 1;
  const items: LineItem[] = [{
    rangeLabel: `${fmtDate(guest.check_in)} – ${fmtDate(guest.check_out)}`,
    nights,
    unitPrice: round2(finalPrice / nights),
    amount: finalPrice,
  }];
  return { items, net: finalPrice, finalPrice };
}

export async function buildInvoicePdf(
  guest: CleaningGuestWithRanges,
  opts: InvoiceOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(regularFontBytes);
  const bold = await doc.embedFont(boldFontBytes);
  const page = doc.addPage([PAGE_W, PAGE_H]);

  let logo: PDFImage | null = null;
  try { logo = await doc.embedPng(logoBytes); } catch { logo = null; }

  const annots: ReturnType<typeof doc.context.register>[] = [];

  // text helpers ----------------------------------------------------------------
  const text = (s: string, x: number, y: number, size: number, f: PDFFont = font, color = TEXT) =>
    page.drawText(s, { x, y, size, font: f, color });
  const textRight = (s: string, xRight: number, y: number, size: number, f: PDFFont = font, color = TEXT) =>
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  const textCenter = (s: string, y: number, size: number, f: PDFFont, color: ReturnType<typeof rgb>) =>
    page.drawText(s, { x: (PAGE_W - f.widthOfTextAtSize(s, size)) / 2, y, size, font: f, color });

  // Bilingual two-tone label: English prominent (engFont/engColor) + Croatian
  // muted (regular weight, MUTED). English always leads.
  const biLeft = (x: number, y: number, eng: string, cro: string, size: number, engColor = OCEAN) => {
    text(eng, x, y, size, bold, engColor);
    text(SEP + cro, x + bold.widthOfTextAtSize(eng, size), y, size, font, MUTED);
  };
  const biRight = (xRight: number, y: number, eng: string, cro: string, size: number, engColor = OCEAN) => {
    const engW = bold.widthOfTextAtSize(eng, size);
    const tailW = font.widthOfTextAtSize(SEP + cro, size);
    const startX = xRight - engW - tailW;
    text(eng, startX, y, size, bold, engColor);
    text(SEP + cro, startX + engW, y, size, font, MUTED);
  };
  const biCenter = (y: number, eng: string, cro: string, size: number, engColor = OCEAN) => {
    const engW = bold.widthOfTextAtSize(eng, size);
    const tailW = font.widthOfTextAtSize(SEP + cro, size);
    const startX = (PAGE_W - engW - tailW) / 2;
    text(eng, startX, y, size, bold, engColor);
    text(SEP + cro, startX + engW, y, size, font, MUTED);
  };

  // ── Branded header band (navy + logo + wordmark) ───────────────────────────
  const BAND_H = 165;
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: NAVY });
  if (logo) {
    const size = 96;
    const lx = (PAGE_W - size) / 2;
    const ly = PAGE_H - 16 - size;
    page.drawImage(logo, { x: lx, y: ly, width: size, height: size });
    // Clickable link over the logo → website.
    annots.push(doc.context.register(doc.context.obj({
      Type: 'Annot', Subtype: 'Link',
      Rect: [lx, ly, lx + size, ly + size],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(SITE) },
    })));
  }
  textCenter('Blue Moon Apartment', PAGE_H - 132, 18, bold, WHITE);
  textCenter('Mandre  •  Island of Pag  •  Croatia', PAGE_H - 147, 8, font, SKY);
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H - 3, width: PAGE_W, height: 3, color: GOLD });

  // ── Title + owner + meta ───────────────────────────────────────────────────
  let y = PAGE_H - 205;
  text('INVOICE', MARGIN, y, 24, bold, OCEAN);
  text('Račun', MARGIN, y - 21, 14, font, MUTED);

  const rightX = PAGE_W - MARGIN;
  let oy = y;
  biRight(rightX, oy, 'OWNER', 'Domaćin', 7.5); oy -= 14;
  textRight(OWNER.name, rightX, oy, 9, bold, TEXT); oy -= 12;
  textRight(`OIB: ${OWNER.oib}`, rightX, oy, 9, font, TEXT); oy -= 12;
  textRight(OWNER.address, rightX, oy, 9, font, TEXT); oy -= 12;
  textRight(`IBAN: ${OWNER.iban}`, rightX, oy, 9, font, TEXT); oy -= 12;
  const revolutStr = `Revolut: ${OWNER.revolut}`;
  textRight(revolutStr, rightX, oy, 9, font, OCEAN);
  const revolutW = font.widthOfTextAtSize(revolutStr, 9);
  annots.push(doc.context.register(doc.context.obj({
    Type: 'Annot', Subtype: 'Link',
    Rect: [rightX - revolutW, oy - 2, rightX, oy + 9],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(`https://${OWNER.revolut}`) },
  })));

  const meta = (eng: string, cro: string, value: string, yy: number, valueFont: PDFFont = font) => {
    biLeft(MARGIN, yy, eng, cro, 7.5);
    text(value, MARGIN + 110, yy - 1, 11, valueFont, TEXT);
  };
  let my = y - 62;
  meta('NO.', 'Broj', opts.invoiceNumber, my, bold); my -= 24;
  meta('DATE', 'Datum', fmtDate(opts.dateISO), my); my -= 24;
  meta('ADDRESS', 'Adresa', PLACE, my); my -= 24;
  meta('GUEST', 'Gost', guest.guest_name, my, bold);

  // ── Line-item table ────────────────────────────────────────────────────────
  let ty = my - 42;
  const cService = MARGIN;
  const cUnit    = MARGIN + 200;
  const cQty     = MARGIN + 350; // right edge
  const cPrice   = MARGIN + 420; // right edge
  const cAmount  = PAGE_W - MARGIN; // right edge

  // header: English row (prominent) over Croatian row (muted, smaller)
  text('SERVICE', cService, ty, 7.5, bold, OCEAN);
  text('ACCOMM. UNIT', cUnit, ty, 7.5, bold, OCEAN);
  textRight('QUANTITY', cQty, ty, 7.5, bold, OCEAN);
  textRight('UNIT PRICE', cPrice, ty, 7.5, bold, OCEAN);
  textRight('AMOUNT', cAmount, ty, 7.5, bold, OCEAN);
  const ch = ty - 9;
  text('Vrsta usluge', cService, ch, 6.8, font, MUTED);
  text('Smještajna jedinica', cUnit, ch, 6.8, font, MUTED);
  textRight('Br. noćenja', cQty, ch, 6.8, font, MUTED);
  textRight('Jedinična cijena', cPrice, ch, 6.8, font, MUTED);
  textRight('Ukupno', cAmount, ch, 6.8, font, MUTED);

  ty -= 22;
  page.drawLine({ start: { x: MARGIN, y: ty }, end: { x: PAGE_W - MARGIN, y: ty }, thickness: 1, color: OCEAN });
  ty -= 18;

  const { items, net, finalPrice } = buildLineItems(guest);
  for (const it of items) {
    biLeft(cService, ty, 'Overnight stay', 'Noćenje', 9, TEXT);
    text(it.rangeLabel, cService, ty - 11, 8, font, MUTED);
    text(ACCOMM_UNIT, cUnit, ty, 9, font, TEXT);
    textRight(String(it.nights), cQty, ty, 9, font, TEXT);
    textRight(fmtMoney(it.unitPrice), cPrice, ty, 9, font, TEXT);
    textRight(fmtMoney(it.amount), cAmount, ty, 9, font, TEXT);
    ty -= 28;
    page.drawLine({ start: { x: MARGIN, y: ty + 8 }, end: { x: PAGE_W - MARGIN, y: ty + 8 }, thickness: 0.5, color: LINE_BLUE });
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  ty -= 8;
  const discount = round2(net - finalPrice);
  const labelX = MARGIN + 350;
  biRight(labelX, ty, 'NET AMOUNT', 'Ukupno:', 9); textRight(fmtMoney(net), cAmount, ty, 9, font, TEXT);
  ty -= 20;
  if (discount > 0.005) {
    biRight(labelX, ty, 'DISCOUNT', 'Popust:', 9); textRight('-' + fmtMoney(discount), cAmount, ty, 9, font, TEXT);
    ty -= 20;
  }
  page.drawLine({ start: { x: labelX - 130, y: ty + 6 }, end: { x: cAmount, y: ty + 6 }, thickness: 1.5, color: GOLD });
  ty -= 12;
  biRight(labelX, ty, 'PAID', 'Plaćeno:', 11, NAVY);
  textRight(fmtMoney(finalPrice), cAmount, ty, 12, bold, NAVY);

  // ── Notes panel (soft blue) — English first, Croatian muted ────────────────
  const notes: Array<[string, string]> = [
    ['The taxpayer is not within the VAT system, according to Article 90, paragraphs 1 and 2 of the VAT Act.',
     'Obveznik nije u sustavu PDV-a, na temelju čl. 90, st. 1 i st. 2, Zakona o PDV-u.'],
    ['Tourist tax included in the service price.',
     'Turistička pristojba uključena u cijenu usluge.'],
    ['This invoice is computer-generated and valid without a signature.',
     'Račun je izdan na računalu i važeći je bez potpisa.'],
  ];
  const panelH = 20 + notes.length * 26 + 6;
  // Flow below the totals, but never drop into the footer area.
  const panelY = Math.max(140, ty - 24 - panelH);
  page.drawRectangle({ x: MARGIN, y: panelY, width: CONTENT_W, height: panelH, color: SOFTBLUE });
  page.drawRectangle({ x: MARGIN, y: panelY, width: 3, height: panelH, color: GOLD });
  let ny = panelY + panelH - 18;
  biLeft(MARGIN + 16, ny, 'NOTES', 'Napomene', 7.5);
  ny -= 17;
  for (const [eng, cro] of notes) {
    text(eng, MARGIN + 16, ny, 8, font, TEXT);
    text(cro, MARGIN + 16, ny - 10, 8, font, MUTED);
    ny -= 26;
  }

  // ── Footer (mirrors the email shell) ───────────────────────────────────────
  biCenter(126, 'Have a nice stay!', 'Ugodan boravak!', 11);

  const creamH = 64;
  page.drawRectangle({ x: 0, y: 22, width: PAGE_W, height: creamH, color: CREAM });
  text('Goran Falkoni', MARGIN, 22 + creamH - 22, 11, bold, NAVY);
  text('Blue Moon Apartment', MARGIN, 22 + creamH - 36, 9, font, MUTED);
  textRight('bluemoon.mandre@gmail.com', PAGE_W - MARGIN, 22 + creamH - 22, 9, font, OCEAN);
  const phoneStr = '+385 91 469 1204';
  const phoneY = 22 + creamH - 36;
  textRight(phoneStr, PAGE_W - MARGIN, phoneY, 9, font, OCEAN);
  const phoneW = font.widthOfTextAtSize(phoneStr, 9);
  annots.push(doc.context.register(doc.context.obj({
    Type: 'Annot', Subtype: 'Link',
    Rect: [PAGE_W - MARGIN - phoneW, phoneY - 2, PAGE_W - MARGIN, phoneY + 9],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of('https://wa.me/385914691204') },
  })));

  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 22, color: NAVY_DARK });
  textCenter('© 2026 Blue Moon Apartment  •  bluemoonmandre.eu', 8, 8, font, SKY);

  if (annots.length > 0) {
    page.node.set(PDFName.of('Annots'), doc.context.obj(annots));
  }

  return await doc.save();
}
