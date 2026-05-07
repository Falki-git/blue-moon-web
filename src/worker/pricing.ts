export const SEASON_2026 = { start: '2026-06-01', end: '2026-09-30' };
export const MIN_NIGHTS  = 5;
export const DEPOSIT_PCT = 30;

export const SEASON_MONTHS = [6, 7, 8, 9] as const;
export type SeasonMonth = typeof SEASON_MONTHS[number];

export type PricingMap = Record<number, number>;

export interface PricingRow { month: number; rate_eur: number; updated_at: number }

export async function loadPricing(db: D1Database): Promise<PricingMap> {
  const rs = await db.prepare('SELECT month, rate_eur FROM pricing_rules').all<PricingRow>();
  const out: PricingMap = {};
  for (const row of rs.results ?? []) out[row.month] = row.rate_eur;
  return out;
}

export interface PriceBreakdownDay { date: string; eur: number }
export interface PriceTotal {
  nights: number;
  totalEur: number;
  breakdown: PriceBreakdownDay[];
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
  let total = 0;
  const cur = new Date(start);
  while (cur < end) {
    const month = cur.getMonth() + 1;
    const rate  = pricing[month] ?? 0;
    breakdown.push({ date: toISO(cur), eur: rate });
    total += rate;
    cur.setDate(cur.getDate() + 1);
  }
  return { nights: breakdown.length, totalEur: total, breakdown };
}

export function depositEur(totalEur: number): number {
  return Math.round(totalEur * (DEPOSIT_PCT / 100));
}

export function isInSeason(iso: string): boolean {
  return iso >= SEASON_2026.start && iso <= SEASON_2026.end;
}
