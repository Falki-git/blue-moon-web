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
  deposit_confirmation_sent_at: number | null;
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

function addOneDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

export interface OccupiedDates {
  blocked: string[];
  pending: string[];
  checkoutOnly: string[];
  checkinOnly: string[];
  pendingCheckoutOnly: string[];
  pendingCheckinOnly: string[];
}

export async function listOccupiedDates(
  db: D1Database, fromISO: string, toISO: string,
): Promise<OccupiedDates> {
  const blocked = new Set<string>();
  const pending = new Set<string>();
  const checkoutOnly = new Set<string>();
  const checkinOnly = new Set<string>();
  const pendingCheckoutOnly = new Set<string>();
  const pendingCheckinOnly = new Set<string>();

  const blocks = await db.prepare(
    'SELECT from_date, to_date FROM manual_blocks WHERE NOT (to_date < ?1 OR from_date > ?2)'
  ).bind(fromISO, toISO).all<{ from_date: string; to_date: string }>();
  for (const b of blocks.results ?? []) {
    const blockCheckOut = addOneDay(b.to_date);
    const nights = expandRangeExclusive(b.from_date, blockCheckOut);

    if (b.from_date >= fromISO && b.from_date <= toISO) checkoutOnly.add(b.from_date);
    for (let i = 1; i < nights.length; i++) {
      const d = nights[i];
      if (d < fromISO || d > toISO) continue;
      blocked.add(d);
    }
    if (blockCheckOut >= fromISO && blockCheckOut <= toISO) checkinOnly.add(blockCheckOut);
  }

  const reservations = await db.prepare(
    `SELECT status, check_in, check_out FROM reservations
       WHERE status IN ('pending','confirmed')
         AND NOT (check_out <= ?1 OR check_in > ?2)`
  ).bind(fromISO, toISO).all<{ status: ReservationStatus; check_in: string; check_out: string }>();
  for (const r of reservations.results ?? []) {
    const nights = expandRangeExclusive(r.check_in, r.check_out);
    const isConfirmed = r.status === 'confirmed';

    if (r.check_in >= fromISO && r.check_in <= toISO) {
      if (isConfirmed) checkoutOnly.add(r.check_in);
      else pendingCheckoutOnly.add(r.check_in);
    }
    for (let i = 1; i < nights.length; i++) {
      const d = nights[i];
      if (d < fromISO || d > toISO) continue;
      if (isConfirmed) blocked.add(d);
      else pending.add(d);
    }
    if (r.check_out >= fromISO && r.check_out <= toISO) {
      if (isConfirmed) checkinOnly.add(r.check_out);
      else pendingCheckinOnly.add(r.check_out);
    }
  }

  // Back-to-back confirmed reservations sharing a boundary date → fully blocked
  for (const d of [...checkoutOnly]) {
    if (checkinOnly.has(d)) {
      blocked.add(d);
      checkoutOnly.delete(d);
      checkinOnly.delete(d);
    }
  }
  // Back-to-back pending reservations sharing a boundary date → fully pending
  for (const d of [...pendingCheckoutOnly]) {
    if (pendingCheckinOnly.has(d)) {
      pending.add(d);
      pendingCheckoutOnly.delete(d);
      pendingCheckinOnly.delete(d);
    }
  }
  // Blocked interior overrides all boundary sets
  for (const d of blocked) {
    pending.delete(d);
    checkoutOnly.delete(d);
    checkinOnly.delete(d);
    pendingCheckoutOnly.delete(d);
    pendingCheckinOnly.delete(d);
  }
  // Pending interior overrides pending boundary dates on the same date
  for (const d of pending) {
    pendingCheckoutOnly.delete(d);
    pendingCheckinOnly.delete(d);
  }

  return {
    blocked: [...blocked].sort(),
    pending: [...pending].sort(),
    checkoutOnly: [...checkoutOnly].sort(),
    checkinOnly: [...checkinOnly].sort(),
    pendingCheckoutOnly: [...pendingCheckoutOnly].sort(),
    pendingCheckinOnly: [...pendingCheckinOnly].sort(),
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

export async function markDepositPaid(db: D1Database, id: string): Promise<void> {
  await db.prepare(
    `UPDATE reservations SET deposit_confirmation_sent_at = unixepoch() WHERE id = ?1`
  ).bind(id).run();
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

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  try {
    const r = await db.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first<{ value: string }>();
    return r?.value ?? null;
  } catch {
    return null;
  }
}

export async function upsertSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, unixepoch())
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(key, value).run();
}
