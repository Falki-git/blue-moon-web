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
  full_total_eur: number | null;
  discount_pct: number | null;
  pricing_snapshot: string | null;
  message: string | null;
  decision_token: string;
  decided_at: number | null;
  deposit_confirmation_sent_at: number | null;
  welcome_email_sent_at: number | null;
  evisitor_email_sent_at: number | null;
  received_email_sent_at: number | null;
  approved_email_sent_at: number | null;
}

/**
 * Guest emails whose "last sent" timestamp is tracked on the reservation row.
 * Add a kind here (plus a migration adding the column) to give a new guest email
 * the send / resend + timestamp treatment in the admin dashboard.
 */
export const GUEST_EMAIL_COLUMNS = {
  deposit: 'deposit_confirmation_sent_at',
  welcome: 'welcome_email_sent_at',
  evisitor: 'evisitor_email_sent_at',
  // 'received' covers the pair sent together at booking time: the guest
  // "request received" mail and the owner notification.
  received: 'received_email_sent_at',
  approved: 'approved_email_sent_at',
} as const;

export type GuestEmailKind = keyof typeof GUEST_EMAIL_COLUMNS;

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
  discount_rate_eur: number | null;
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
  full_total_eur: number;
  discount_pct: number;
  pricing_snapshot: string;
  message: string | null;
  decision_token: string;
  /**
   * Only set for reservations created straight into a decided state — the admin
   * dashboard's manual entry, which lands as 'confirmed' at the moment it is entered.
   * Left undefined for the public booking form, where the decision happens later.
   */
  decided_at?: number | null;
}

export async function insertReservation(db: D1Database, row: InsertReservationInput): Promise<void> {
  await db.prepare(
    `INSERT INTO reservations
      (id, created_at, status, full_name, email, phone, language, country, address, source,
       guests, children_ages, check_in, check_out, nights, total_eur, message, decision_token,
       full_total_eur, discount_pct, pricing_snapshot, decided_at)
     VALUES
      (?1, unixepoch(), ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`
  ).bind(
    row.id, row.status, row.full_name, row.email, row.phone, row.language, row.country, row.address, row.source,
    row.guests, row.children_ages, row.check_in, row.check_out, row.nights, row.total_eur,
    row.message, row.decision_token,
    row.full_total_eur, row.discount_pct, row.pricing_snapshot,
    row.decided_at ?? null,
  ).run();
}

/**
 * Every reservation field the admin dashboard's Edit form may rewrite. Deliberately
 * unvalidated — past dates, overlapping ranges and any nights count are all allowed,
 * because this is the owner correcting the record by hand. Saving never sends email.
 *
 * The email sent-at stamps and created_at are not editable and stay as they are.
 */
export interface UpdateReservationInput {
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
  full_total_eur: number | null;
  discount_pct: number | null;
  message: string | null;
}

export async function updateReservation(
  db: D1Database, id: string, row: UpdateReservationInput,
): Promise<void> {
  await db.prepare(
    `UPDATE reservations SET
       status = ?2, full_name = ?3, email = ?4, phone = ?5, language = ?6, country = ?7,
       address = ?8, source = ?9, guests = ?10, children_ages = ?11, check_in = ?12,
       check_out = ?13, nights = ?14, total_eur = ?15, full_total_eur = ?16,
       discount_pct = ?17, message = ?18
     WHERE id = ?1`
  ).bind(
    id, row.status, row.full_name, row.email, row.phone, row.language, row.country,
    row.address, row.source, row.guests, row.children_ages, row.check_in,
    row.check_out, row.nights, row.total_eur, row.full_total_eur,
    row.discount_pct, row.message,
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

/**
 * Stamps the send time for one tracked guest email. The column name comes from the
 * GUEST_EMAIL_COLUMNS whitelist — never from caller-supplied strings — so it is safe
 * to interpolate into the statement.
 */
export async function markGuestEmailSent(db: D1Database, id: string, kind: GuestEmailKind): Promise<void> {
  const column = GUEST_EMAIL_COLUMNS[kind];
  await db.prepare(
    `UPDATE reservations SET ${column} = unixepoch() WHERE id = ?1`
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
  db: D1Database, month: number, rateEur: number, discountRateEur: number,
): Promise<void> {
  await db.prepare(
    `INSERT INTO pricing_rules (month, rate_eur, discount_rate_eur, updated_at) VALUES (?1, ?2, ?3, unixepoch())
       ON CONFLICT(month) DO UPDATE SET rate_eur = excluded.rate_eur, discount_rate_eur = excluded.discount_rate_eur, updated_at = excluded.updated_at`
  ).bind(month, rateEur, discountRateEur).run();
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

/**
 * Combination of the key-locker outside the apartment door — sent only in the eVisitor
 * email. The real code is never committed: it is set in admin -> Settings and read from
 * the DB. The default below is a placeholder for a DB that has no value stored yet.
 */
export const KEY_LOCKER_CODE_KEY = 'key_locker_code';
export const KEY_LOCKER_CODE_DEFAULT = '0000';

/** Four digits, no leading/trailing space — the physical locker takes nothing else. */
export function isValidKeyLockerCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

export async function getKeyLockerCode(db: D1Database): Promise<string> {
  const stored = await getSetting(db, KEY_LOCKER_CODE_KEY);
  return stored !== null && isValidKeyLockerCode(stored) ? stored : KEY_LOCKER_CODE_DEFAULT;
}

// ── Cleaning crew guests ─────────────────────────────────────────────────────

export interface GuestStayRange {
  id: string;
  guest_id: string;
  sort_order: number;
  start_date: string;
  end_date: string;
  full_price: number;
  discounted_price: number;
  nights: number;
  range_total: number;
}

export interface CleaningGuestRow {
  id: string;
  created_at: number;
  guest_name: string;
  booking_number: string | null;
  country: string | null;
  check_in: string;
  check_out: string;
  booking_date: string | null;
  total_guests: number;
  adults: number;
  children: number;
  children_ages: string | null;
  nights: number;
  email: string | null;
  phone: string | null;
  notes: string | null;
  checkin_hour: string | null;
  checkout_hour: string | null;
  channel: string;
  commission: number | null;
  commission_pct: number | null;
  vat: number;
  vat_amount: number | null;
  cleaning_fee: number | null;
  final_price: number | null;
  payout: number | null;
  net_gain: number | null;
}

export interface InvoiceRow {
  guest_id: string;
  invoice_number: string;
  invoice_year: number;
  invoice_seq: number;
  r2_key: string;
  sent_at: number;
  created_at: number;
}

export interface CleaningGuestWithRanges extends CleaningGuestRow {
  ranges: GuestStayRange[];
  invoice: { invoice_number: string; sent_at: number } | null;
}

/** Operational-fields-only row returned to the cleaning crew — no financials. */
export interface CrewGuestRow {
  id: string;
  created_at: number;
  guest_name: string;
  booking_number: string | null;
  country: string | null;
  check_in: string;
  check_out: string;
  booking_date: string | null;
  total_guests: number;
  adults: number;
  children: number;
  children_ages: string | null;
  nights: number;
  email: string | null;
  phone: string | null;
  notes: string | null;
  checkin_hour: string | null;
  checkout_hour: string | null;
}

export async function listCrewGuests(db: D1Database): Promise<CrewGuestRow[]> {
  const rs = await db
    .prepare(
      `SELECT id, created_at, guest_name, booking_number, country,
              check_in, check_out, booking_date, total_guests, adults, children,
              children_ages, nights, email, phone, notes, checkin_hour, checkout_hour
         FROM cleaning_guests ORDER BY check_in ASC`,
    )
    .all<CrewGuestRow>();
  return rs.results ?? [];
}

export async function listCleaningGuests(db: D1Database): Promise<CleaningGuestWithRanges[]> {
  const guestRs = await db
    .prepare('SELECT * FROM cleaning_guests ORDER BY check_in ASC')
    .all<CleaningGuestRow>();
  const guests = guestRs.results ?? [];
  if (guests.length === 0) return [];

  const rangeRs = await db
    .prepare('SELECT * FROM guest_stay_ranges ORDER BY guest_id, sort_order ASC')
    .all<GuestStayRange>();
  const byGuest = new Map<string, GuestStayRange[]>();
  for (const r of rangeRs.results ?? []) {
    const arr = byGuest.get(r.guest_id) ?? [];
    arr.push(r);
    byGuest.set(r.guest_id, arr);
  }

  const invoiceRs = await db
    .prepare('SELECT guest_id, invoice_number, sent_at FROM invoices')
    .all<{ guest_id: string; invoice_number: string; sent_at: number }>();
  const invoiceByGuest = new Map<string, { invoice_number: string; sent_at: number }>();
  for (const inv of invoiceRs.results ?? []) {
    invoiceByGuest.set(inv.guest_id, { invoice_number: inv.invoice_number, sent_at: inv.sent_at });
  }

  return guests.map(g => ({
    ...g,
    ranges: byGuest.get(g.id) ?? [],
    invoice: invoiceByGuest.get(g.id) ?? null,
  }));
}

export async function getCleaningGuestWithRanges(
  db: D1Database, id: string,
): Promise<CleaningGuestWithRanges | null> {
  const guest = await db
    .prepare('SELECT * FROM cleaning_guests WHERE id = ?1').bind(id)
    .first<CleaningGuestRow>();
  if (!guest) return null;
  const rangeRs = await db
    .prepare('SELECT * FROM guest_stay_ranges WHERE guest_id = ?1 ORDER BY sort_order ASC').bind(id)
    .all<GuestStayRange>();
  const invoice = await getInvoice(db, id);
  return {
    ...guest,
    ranges: rangeRs.results ?? [],
    invoice: invoice ? { invoice_number: invoice.invoice_number, sent_at: invoice.sent_at } : null,
  };
}

export async function insertCleaningGuest(
  db: D1Database,
  row: Omit<CleaningGuestRow, 'created_at'>,
  ranges: GuestStayRange[],
): Promise<void> {
  await db.batch([
    db.prepare(
      `INSERT INTO cleaning_guests
        (id, created_at, guest_name, booking_number, country,
         check_in, check_out, booking_date, total_guests, adults, children,
         children_ages, nights, email, phone, notes, checkin_hour, checkout_hour,
         channel, commission, commission_pct, vat, vat_amount, cleaning_fee,
         final_price, payout, net_gain)
       VALUES (?1, unixepoch(), ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17,
               ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26)`,
    ).bind(
      row.id, row.guest_name, row.booking_number, row.country,
      row.check_in, row.check_out, row.booking_date, row.total_guests,
      row.adults, row.children, row.children_ages, row.nights,
      row.email, row.phone, row.notes, row.checkin_hour, row.checkout_hour,
      row.channel, row.commission, row.commission_pct, row.vat, row.vat_amount,
      row.cleaning_fee, row.final_price, row.payout, row.net_gain,
    ),
    ...ranges.map(r => db.prepare(
      `INSERT INTO guest_stay_ranges
         (id, guest_id, sort_order, start_date, end_date, full_price, discounted_price, nights, range_total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(r.id, r.guest_id, r.sort_order, r.start_date, r.end_date, r.full_price, r.discounted_price, r.nights, r.range_total)),
  ]);
}

export async function updateCleaningGuest(
  db: D1Database,
  id: string,
  fields: Omit<CleaningGuestRow, 'id' | 'created_at'>,
  ranges: GuestStayRange[],
): Promise<void> {
  await db.batch([
    db.prepare(
      `UPDATE cleaning_guests SET
        guest_name = ?1, booking_number = ?2, country = ?3,
        check_in = ?4, check_out = ?5, booking_date = ?6,
        total_guests = ?7, adults = ?8, children = ?9,
        children_ages = ?10, nights = ?11, email = ?12,
        phone = ?13, notes = ?14, checkin_hour = ?15, checkout_hour = ?16,
        channel = ?17, commission = ?18, commission_pct = ?19,
        vat = ?20, vat_amount = ?21, cleaning_fee = ?22,
        final_price = ?23, payout = ?24, net_gain = ?25
       WHERE id = ?26`,
    ).bind(
      fields.guest_name, fields.booking_number, fields.country,
      fields.check_in, fields.check_out, fields.booking_date,
      fields.total_guests, fields.adults, fields.children,
      fields.children_ages, fields.nights, fields.email,
      fields.phone, fields.notes, fields.checkin_hour, fields.checkout_hour,
      fields.channel, fields.commission, fields.commission_pct,
      fields.vat, fields.vat_amount, fields.cleaning_fee,
      fields.final_price, fields.payout, fields.net_gain, id,
    ),
    db.prepare('DELETE FROM guest_stay_ranges WHERE guest_id = ?1').bind(id),
    ...ranges.map(r => db.prepare(
      `INSERT INTO guest_stay_ranges
         (id, guest_id, sort_order, start_date, end_date, full_price, discounted_price, nights, range_total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(r.id, r.guest_id, r.sort_order, r.start_date, r.end_date, r.full_price, r.discounted_price, r.nights, r.range_total)),
  ]);
}

export async function deleteCleaningGuest(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM guest_stay_ranges WHERE guest_id = ?1').bind(id),
    db.prepare('DELETE FROM cleaning_guests WHERE id = ?1').bind(id),
  ]);
}

// ── Invoices ─────────────────────────────────────────────────────────────────

export async function getInvoice(db: D1Database, guestId: string): Promise<InvoiceRow | null> {
  const r = await db.prepare('SELECT * FROM invoices WHERE guest_id = ?1').bind(guestId).first<InvoiceRow>();
  return r ?? null;
}

/** Next sequence number ("no") for a given year — resets per year. */
export async function getNextInvoiceSeq(db: D1Database, year: number): Promise<number> {
  const r = await db
    .prepare('SELECT MAX(invoice_seq) AS max_seq FROM invoices WHERE invoice_year = ?1').bind(year)
    .first<{ max_seq: number | null }>();
  return (r?.max_seq ?? 0) + 1;
}

export async function upsertInvoice(
  db: D1Database,
  row: { guest_id: string; invoice_number: string; invoice_year: number; invoice_seq: number; r2_key: string },
): Promise<void> {
  await db.prepare(
    `INSERT INTO invoices (guest_id, invoice_number, invoice_year, invoice_seq, r2_key, sent_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, unixepoch(), unixepoch())
     ON CONFLICT(guest_id) DO UPDATE SET
       invoice_number = excluded.invoice_number,
       invoice_year   = excluded.invoice_year,
       invoice_seq    = excluded.invoice_seq,
       r2_key         = excluded.r2_key,
       sent_at        = excluded.sent_at`
  ).bind(row.guest_id, row.invoice_number, row.invoice_year, row.invoice_seq, row.r2_key).run();
}

// ── Crew docs ─────────────────────────────────────────────────────────────────

export interface CrewDocRow {
  id: string;
  title: string;
  content_md: string;
  content_html: string;
  created_at: number;
  updated_at: number;
}

export async function listCrewDocs(
  db: D1Database,
): Promise<Pick<CrewDocRow, 'id' | 'title' | 'updated_at'>[]> {
  const rs = await db
    .prepare('SELECT id, title, updated_at FROM crew_docs ORDER BY created_at ASC')
    .all<Pick<CrewDocRow, 'id' | 'title' | 'updated_at'>>();
  return rs.results ?? [];
}

export async function getCrewDoc(db: D1Database, id: string): Promise<CrewDocRow | null> {
  const r = await db.prepare('SELECT * FROM crew_docs WHERE id = ?1').bind(id).first<CrewDocRow>();
  return r ?? null;
}

export async function insertCrewDoc(
  db: D1Database,
  row: { id: string; title: string; content_md: string; content_html: string },
): Promise<void> {
  await db.prepare(
    `INSERT INTO crew_docs (id, title, content_md, content_html, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, unixepoch(), unixepoch())`,
  ).bind(row.id, row.title, row.content_md, row.content_html).run();
}

export async function updateCrewDoc(
  db: D1Database,
  id: string,
  fields: { title: string; content_md: string; content_html: string },
): Promise<void> {
  await db.prepare(
    `UPDATE crew_docs SET title = ?1, content_md = ?2, content_html = ?3, updated_at = unixepoch()
     WHERE id = ?4`,
  ).bind(fields.title, fields.content_md, fields.content_html, id).run();
}

export async function deleteCrewDoc(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM crew_docs WHERE id = ?1').bind(id).run();
}
