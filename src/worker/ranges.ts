/**
 * A reservation's price, expressed as dated ranges.
 *
 * The ranges are the reservation's stay: the first start is check-in, the last end is
 * check-out, and the money columns are their sum. Nothing is stored twice, so a nightly
 * rate can never contradict the total that was quoted — which is the whole point of
 * showing them in the admin at all.
 *
 * They live in `reservations.pricing_snapshot`. Rows written before ranges existed hold
 * the older per-month breakdown, or nothing at all; `reservationRanges` converts both, so
 * every reservation presents the same shape however old it is.
 *
 * Money is whole euros throughout, matching `pricing_rules.rate_eur` and
 * `reservations.total_eur`. Guest data carries the same figures as REAL, so a propagated
 * row totals to the cent.
 */
import type { PriceTotal } from './pricing';

export interface StayRange {
  start_date: string;
  end_date: string;
  nights: number;
  full_price: number;        // per night, before any discount
  discounted_price: number;  // per night, as charged
  range_total: number;       // discounted_price × nights
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function nightsBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** The stay and the money the ranges add up to. */
export function totalsFromRanges(ranges: StayRange[]): {
  check_in: string; check_out: string; nights: number;
  total_eur: number; full_total_eur: number; discount_pct: number;
} {
  const check_in  = ranges[0].start_date;
  const check_out = ranges[ranges.length - 1].end_date;
  const nights    = ranges.reduce((s, r) => s + r.nights, 0);
  const total_eur      = ranges.reduce((s, r) => s + r.range_total, 0);
  const full_total_eur = ranges.reduce((s, r) => s + r.full_price * r.nights, 0);
  const discount_pct   = full_total_eur > 0
    ? Math.max(0, Math.round((1 - total_eur / full_total_eur) * 100)) : 0;
  return { check_in, check_out, nights, total_eur, full_total_eur, discount_pct };
}

/** One range per month, exactly as the pricing rules quoted the stay. */
export function rangesFromPriceTotal(total: PriceTotal, checkIn: string): StayRange[] {
  const out: StayRange[] = [];
  let cursor = checkIn;
  for (const m of total.monthly) {
    const end = addDays(cursor, m.nights);
    out.push({
      start_date: cursor,
      end_date: end,
      nights: m.nights,
      full_price: m.fullRateEur,
      discounted_price: m.discountRateEur,
      range_total: m.discountRateEur * m.nights,
    });
    cursor = end;
  }
  return out;
}

/** A single range covering the whole stay, for reservations with nothing better. */
function wholeStayRange(res: {
  check_in: string; check_out: string; nights: number;
  total_eur: number; full_total_eur: number | null;
}): StayRange[] {
  const nights = res.nights > 0 ? res.nights : Math.max(1, nightsBetween(res.check_in, res.check_out));
  return [{
    start_date: res.check_in,
    end_date: res.check_out,
    nights,
    full_price: Math.round((res.full_total_eur ?? res.total_eur) / nights),
    discounted_price: Math.round(res.total_eur / nights),
    range_total: res.total_eur,
  }];
}

/** The pre-ranges snapshot shape: one entry per calendar month, carrying no dates. */
interface LegacyMonthEntry {
  month: number; nights: number;
  fullRateEur: number; discountRateEur: number; discountPct: number;
}

/**
 * The ranges a reservation carries, normalising whatever its snapshot holds:
 * the current dated shape, the older per-month breakdown (dates rebuilt by walking
 * forward from check-in), or nothing, which falls back to one range for the whole stay.
 */
export function reservationRanges(res: {
  check_in: string; check_out: string; nights: number;
  total_eur: number; full_total_eur: number | null; pricing_snapshot: string | null;
}): StayRange[] {
  if (!res.pricing_snapshot) return wholeStayRange(res);

  let parsed: unknown;
  try { parsed = JSON.parse(res.pricing_snapshot); }
  catch { return wholeStayRange(res); }
  if (!Array.isArray(parsed) || parsed.length === 0) return wholeStayRange(res);

  // Current shape — dated ranges, used as they are.
  if (typeof (parsed[0] as Record<string, unknown>).start_date === 'string') {
    const ranges = (parsed as StayRange[]).map(r => ({
      start_date: String(r.start_date),
      end_date: String(r.end_date),
      nights: Number(r.nights),
      full_price: Number(r.full_price),
      discounted_price: Number(r.discounted_price),
      range_total: Number(r.range_total),
    }));
    return ranges.every(r => ISO_DATE.test(r.start_date) && ISO_DATE.test(r.end_date) && r.nights > 0)
      ? ranges : wholeStayRange(res);
  }

  // Legacy shape — per month, no dates. Rebuild them by walking the stay.
  const monthly = parsed as LegacyMonthEntry[];
  const snapshotNights = monthly.reduce((s, m) => s + (Number(m.nights) || 0), 0);
  if (snapshotNights !== res.nights) return wholeStayRange(res);

  const out: StayRange[] = [];
  let cursor = res.check_in;
  for (const m of monthly) {
    const nights = Number(m.nights);
    const end = addDays(cursor, nights);
    out.push({
      start_date: cursor,
      end_date: end,
      nights,
      full_price: Number(m.fullRateEur),
      discounted_price: Number(m.discountRateEur),
      range_total: Number(m.discountRateEur) * nights,
    });
    cursor = end;
  }
  return out;
}

/**
 * Validates range rows off a request body. Dates must be real and each range must start
 * where the previous one ended, so the stay is one continuous span — the only rule the
 * manual path enforces, because without it "check-in" and "check-out" mean nothing.
 * Everything else stays deliberately unchecked: past dates, any length, any rate.
 */
export function parseRanges(raw: unknown): { ranges: StayRange[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'At least one pricing range is required' };
  }

  const ranges: StayRange[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] as Record<string, unknown>;
    const start = String(r.start_date ?? '').trim();
    const end   = String(r.end_date   ?? '').trim();
    if (!ISO_DATE.test(start)) return { error: `Range ${i + 1}: start date must be a yyyy-mm-dd date` };
    if (!ISO_DATE.test(end))   return { error: `Range ${i + 1}: end date must be a yyyy-mm-dd date` };
    if (end <= start)          return { error: `Range ${i + 1}: the end date must be after the start date` };

    const full = Number(r.full_price ?? 0);
    const disc = Number(r.discounted_price ?? 0);
    if (!Number.isFinite(full) || full < 0) return { error: `Range ${i + 1}: invalid full price` };
    if (!Number.isFinite(disc) || disc < 0) return { error: `Range ${i + 1}: invalid discounted price` };
    if (full > 0 && disc > full) return { error: `Range ${i + 1}: the discounted price cannot exceed the full price` };

    const nights = nightsBetween(start, end);
    const full_price = Math.round(full);
    const discounted_price = Math.round(disc);
    ranges.push({
      start_date: start, end_date: end, nights,
      full_price, discounted_price,
      range_total: discounted_price * nights,
    });
  }

  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start_date !== ranges[i - 1].end_date) {
      return { error: `Range ${i + 1} must start on ${ranges[i - 1].end_date}, where range ${i} ends — a stay has to be continuous` };
    }
  }

  return { ranges };
}
