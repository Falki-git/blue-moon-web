export type ReservationStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';

export interface ReservationRow {
  id: string;
  created_at: number;
  status: ReservationStatus;
  full_name: string;
  email: string;
  phone: string | null;
  language: string | null;
  country: string | null;
  address: string | null;
  source: string | null;
  guests: number;
  children_ages: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  total_eur: number;
  message: string | null;
  decision_token: string;
  decided_at: number | null;
}

export interface ManualBlockRow {
  id: string;
  created_at: number;
  from_date: string;
  to_date: string;
  note: string | null;
}

export interface PricingRuleRow {
  month: number;
  rate_eur: number;
  updated_at: number;
}

function expandRangeInclusive(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (cur <= end) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function expandRangeExclusive(checkInISO: string, checkOutISO: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = checkInISO.split('-').map(Number);
  const [ty, tm, td] = checkOutISO.split('-').map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (cur < end) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function listOccupiedDates(
  db: D1Database, fromISO: string, toISO: string,
): Promise<{ blocked: string[]; pending: string[] }> {
  const blocked = new Set<string>();
  const pending = new Set<string>();

  const blocks = await db.prepare(
    'SELECT from_date, to_date FROM manual_blocks WHERE NOT (to_date < ?1 OR from_date > ?2)'
  ).bind(fromISO, toISO).all<{ from_date: string; to_date: string }>();
  for (const b of blocks.results ?? []) {
    for (const d of expandRangeInclusive(b.from_date, b.to_date)) {
      if (d >= fromISO && d <= toISO) blocked.add(d);
    }
  }

  const reservations = await db.prepare(
    `SELECT status, check_in, check_out FROM reservations
       WHERE status IN ('pending','confirmed')
         AND NOT (check_out <= ?1 OR check_in > ?2)`
  ).bind(fromISO, toISO).all<{ status: ReservationStatus; check_in: string; check_out: string }>();
  for (const r of reservations.results ?? []) {
    for (const d of expandRangeExclusive(r.check_in, r.check_out)) {
      if (d < fromISO || d > toISO) continue;
      if (r.status === 'confirmed') blocked.add(d);
      else pending.add(d);
    }
  }

  for (const d of blocked) pending.delete(d);

  return {
    blocked: [...blocked].sort(),
    pending: [...pending].sort(),
  };
}

export async function rangeOverlapsOccupied(
  db: D1Database, checkIn: string, checkOut: string,
): Promise<boolean> {
  const lastNight = expandRangeExclusive(checkIn, checkOut).slice(-1)[0] ?? checkIn;

  const blockHit = await db.prepare(
    `SELECT 1 FROM manual_blocks
       WHERE NOT (to_date < ?1 OR from_date > ?2) LIMIT 1`
  ).bind(checkIn, lastNight).first();
  if (blockHit) return true;

  const resHit = await db.prepare(
    `SELECT 1 FROM reservations
       WHERE status IN ('pending','confirmed')
         AND NOT (check_out <= ?1 OR check_in >= ?2)
       LIMIT 1`
  ).bind(checkIn, checkOut).first();
  return resHit != null;
}

export interface InsertReservationInput {
  id: string;
  status: ReservationStatus;
  full_name: string;
  email: string;
  phone: string | null;
  language: string | null;
  country: string | null;
  address: string | null;
  source: string | null;
  guests: number;
  children_ages: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  total_eur: number;
  message: string | null;
  decision_token: string;
}

export async function insertReservation(db: D1Database, row: InsertReservationInput): Promise<void> {
  await db.prepare(
    `INSERT INTO reservations
      (id, created_at, status, full_name, email, phone, language, country, address, source,
       guests, children_ages, check_in, check_out, nights, total_eur, message, decision_token)
     VALUES
      (?1, unixepoch(), ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`
  ).bind(
    row.id, row.status, row.full_name, row.email, row.phone, row.language, row.country, row.address, row.source,
    row.guests, row.children_ages, row.check_in, row.check_out, row.nights, row.total_eur,
    row.message, row.decision_token,
  ).run();
}

export async function updateReservationStatus(
  db: D1Database, id: string, status: ReservationStatus,
): Promise<void> {
  await db.prepare(
    `UPDATE reservations SET status = ?1, decided_at = unixepoch() WHERE id = ?2`
  ).bind(status, id).run();
}

export async function getReservation(db: D1Database, id: string): Promise<ReservationRow | null> {
  const r = await db.prepare(`SELECT * FROM reservations WHERE id = ?1`).bind(id).first<ReservationRow>();
  return r ?? null;
}

export async function listReservations(
  db: D1Database, status?: ReservationStatus,
): Promise<ReservationRow[]> {
  const stmt = status
    ? db.prepare(`SELECT * FROM reservations WHERE status = ?1 ORDER BY check_in ASC`).bind(status)
    : db.prepare(`SELECT * FROM reservations ORDER BY check_in ASC`);
  const rs = await stmt.all<ReservationRow>();
  return rs.results ?? [];
}

export async function listManualBlocks(db: D1Database): Promise<ManualBlockRow[]> {
  const rs = await db.prepare(`SELECT * FROM manual_blocks ORDER BY from_date ASC`).all<ManualBlockRow>();
  return rs.results ?? [];
}

export async function insertManualBlock(
  db: D1Database, row: { id: string; from_date: string; to_date: string; note: string | null },
): Promise<void> {
  await db.prepare(
    `INSERT INTO manual_blocks (id, created_at, from_date, to_date, note)
     VALUES (?1, unixepoch(), ?2, ?3, ?4)`
  ).bind(row.id, row.from_date, row.to_date, row.note).run();
}

export async function deleteManualBlock(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM manual_blocks WHERE id = ?1`).bind(id).run();
}

export async function listPricing(db: D1Database): Promise<PricingRuleRow[]> {
  const rs = await db.prepare(`SELECT * FROM pricing_rules ORDER BY month ASC`).all<PricingRuleRow>();
  return rs.results ?? [];
}

export async function upsertPricingRule(
  db: D1Database, month: number, rateEur: number,
): Promise<void> {
  await db.prepare(
    `INSERT INTO pricing_rules (month, rate_eur, updated_at) VALUES (?1, ?2, unixepoch())
       ON CONFLICT(month) DO UPDATE SET rate_eur = excluded.rate_eur, updated_at = excluded.updated_at`
  ).bind(month, rateEur).run();
}
