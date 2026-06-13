export const SEASON_2026 = { start: '2026-06-01', end: '2026-09-30' };
export const MIN_NIGHTS  = 5;
export const DEPOSIT_PCT = 30;

export const SEASON_MONTHS = [6, 7, 8, 9] as const;
export type SeasonMonth = typeof SEASON_MONTHS[number];

export interface MonthRate { full: number; discount: number }
export type PricingMap = Record<number, MonthRate>;

export interface PricingRow { month: number; rate_eur: number; discount_rate_eur: number | null; updated_at: number }

export async function loadPricing(db: D1Database): Promise<PricingMap> {
  const rs = await db.prepare('SELECT month, rate_eur, discount_rate_eur FROM pricing_rules').all<PricingRow>();
  const out: PricingMap = {};
  for (const row of rs.results ?? []) {
    const full = row.rate_eur;
    const raw  = row.discount_rate_eur;
    const discount = (raw != null && raw < full) ? raw : full;
    out[row.month] = { full, discount };
  }
  return out;
}

export interface PriceBreakdownDay { date: string; fullEur: number; eur: number }

export interface MonthBreakdown {
  month: number; nights: number;
  fullRateEur: number; discountRateEur: number; discountPct: number;
}

export interface PriceTotal {
  nights: number;
  totalEur: number;
  fullTotalEur: number;
  discountPct: number;
  breakdown: PriceBreakdownDay[];
  monthly: MonthBreakdown[];
}

function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeTotal(checkInISO: string, checkOutISO: string, pricing: PricingMap): PriceTotal {
  const start = parseISO(checkInISO);
  const end   = parseISO(checkOutISO);
  const breakdown: PriceBreakdownDay[] = [];
  const monthTotals = new Map<number, { nights: number; full: number; discount: number; fullRate: number; discountRate: number }>();
  const cur = new Date(start);
  while (cur < end) {
    const month = cur.getMonth() + 1;
    const rates = pricing[month] ?? { full: 0, discount: 0 };
    breakdown.push({ date: toISO(cur), fullEur: rates.full, eur: rates.discount });
    const mt = monthTotals.get(month) ?? { nights: 0, full: 0, discount: 0, fullRate: rates.full, discountRate: rates.discount };
    mt.nights++;
    mt.full += rates.full;
    mt.discount += rates.discount;
    monthTotals.set(month, mt);
    cur.setDate(cur.getDate() + 1);
  }

  const fullTotalEur = breakdown.reduce((s, d) => s + d.fullEur, 0);
  const totalEur     = breakdown.reduce((s, d) => s + d.eur, 0);
  const discountPct  = fullTotalEur > 0 ? Math.round((1 - totalEur / fullTotalEur) * 100) : 0;

  const monthly: MonthBreakdown[] = [];
  for (const [month, mt] of monthTotals) {
    const pct = mt.full > 0 ? Math.round((1 - mt.discount / mt.full) * 100) : 0;
    monthly.push({ month, nights: mt.nights, fullRateEur: mt.fullRate, discountRateEur: mt.discountRate, discountPct: pct });
  }
  monthly.sort((a, b) => a.month - b.month);

  return { nights: breakdown.length, totalEur, fullTotalEur, discountPct, breakdown, monthly };
}

export function depositEur(totalEur: number): number {
  return Math.round(totalEur * (DEPOSIT_PCT / 100));
}

export function isInSeason(iso: string): boolean {
  return iso >= SEASON_2026.start && iso <= SEASON_2026.end;
}
