/**
 * Propagation of confirmed reservations into the Guest Data tab.
 *
 * Guest data is the single record of every stay across all channels — it is what the
 * cleaning crew reads and what invoices hang off — but it is filled in by hand, because
 * most bookings arrive from Booking.com. A direct booking already holds the same facts,
 * so once it is confirmed it materialises a linked guest row and keeps it in step.
 *
 * Ownership is split by field. The reservation owns what it has (name, contacts, dates,
 * party, price and therefore the pricing ranges) and rewrites those on every sync. The
 * guest row owns everything the reservation has no notion of — arrival hours, crew notes,
 * commission, VAT, cleaning fee, the invoice — and those survive untouched.
 *
 * Creation only ever happens on the transition *into* confirmed, never on an edit. That
 * is what keeps reservations predating this feature out of guest data, where they would
 * otherwise duplicate rows already typed in by hand; `POST /reservations/:id/guest-data`
 * is the deliberate way to pull one of those in.
 *
 * Everything here touches D1 only — no email, no R2, no fetch — so it needs nothing from
 * Env or the ExecutionContext.
 */
import type { CleaningGuestWithRanges, GuestStayRange, ReservationRow } from './db';
import {
  deleteCleaningGuest, getCleaningGuestByReservation, getInvoice,
  insertCleaningGuest, setGuestReservationLink, updateCleaningGuest,
} from './db';
import { reservationRanges } from './ranges';

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Direct bookings are not sold through a channel, so they carry no commission. */
const WEB_CHANNEL = 'web';

/**
 * The four figures the guest-data form shows as derived values. The single
 * implementation: `parseGuestBody` renders the same numbers from a hand-filled form, and
 * the two must not drift. All four stay null while no commission has been entered, which
 * is how the form distinguishes "not costed yet" from "costed at zero".
 */
export function computeGuestDerived(input: {
  finalPrice: number;
  commission: number | null;
  vat: boolean;
  cleaningFee: number;
}): {
  commission_pct: number | null;
  vat_amount: number | null;
  payout: number | null;
  net_gain: number | null;
} {
  const { finalPrice, commission, vat, cleaningFee } = input;
  const commission_pct = commission !== null && finalPrice > 0
    ? round1(commission / finalPrice * 100) : null;
  const payout     = commission !== null ? round2(finalPrice - commission) : null;
  const vat_amount = commission !== null ? (vat ? round2(commission * 0.25) : 0) : null;
  const net_gain   = commission !== null && vat_amount !== null
    ? round2(finalPrice - commission - vat_amount - cleaningFee) : null;
  return { commission_pct, vat_amount, payout, net_gain };
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** The reservation's own pricing ranges, copied across as the guest row's. */
function rangesFromReservation(res: ReservationRow, guestId: string): GuestStayRange[] {
  return reservationRanges(res).map((r, i) => ({
    id: crypto.randomUUID(),
    guest_id: guestId,
    sort_order: i,
    start_date: r.start_date,
    end_date: r.end_date,
    full_price: r.full_price,
    discounted_price: r.discounted_price,
    nights: r.nights,
    range_total: r.range_total,
  }));
}

/** ISO date of the moment the reservation was taken, for the guest row's booking date. */
function bookingDate(createdAt: number): string {
  return new Date(createdAt * 1000).toISOString().slice(0, 10);
}

/** Every guest-data field the reservation owns. Rewritten on each sync. */
function ownedFields(res: ReservationRow) {
  return {
    guest_name: res.full_name,
    country: res.country,
    check_in: res.check_in,
    check_out: res.check_out,
    booking_date: bookingDate(res.created_at),
    total_guests: res.guests,
    adults: res.adults,
    children: res.children,
    children_ages: res.children_ages,
    nights: res.nights,
    email: res.email,
    phone: res.phone,
    channel: WEB_CHANNEL,
    final_price: round2(res.total_eur),
  };
}

/**
 * Creates the guest row for a reservation. A no-op when one already exists, so the
 * approval routes can call it without first checking, and a retry after a failure
 * elsewhere cannot produce a second row.
 */
export async function createGuestFromReservation(
  db: D1Database, res: ReservationRow,
): Promise<void> {
  const existing = await getCleaningGuestByReservation(db, res.id);
  if (existing) return;

  const id = crypto.randomUUID();
  const owned = ownedFields(res);
  // Seeded, then guest-owned: the same default the add-guest form applies, so net gain
  // means something the moment the row appears. A direct booking pays no commission.
  const cleaning_fee = round2(140 + 7 * owned.total_guests);
  const commission = 0;
  const derived = computeGuestDerived({
    finalPrice: owned.final_price, commission, vat: false, cleaningFee: cleaning_fee,
  });

  await insertCleaningGuest(db, {
    id,
    reservation_id: res.id,
    ...owned,
    booking_number: null,
    // The guest's message is their prose to us; notes are instructions shown to the
    // cleaning crew. Seeding one from the other would publish the message to the crew
    // and overwrite anything typed here on the next sync.
    notes: null,
    checkin_hour: null,
    checkout_hour: null,
    commission,
    vat: 0,
    cleaning_fee,
    ...derived,
  }, rangesFromReservation(res, id));
}

/** Everything on a linked guest row that the reservation knows nothing about. */
export interface GuestOwnedFields {
  notes: string | null;
  checkin_hour: string | null;
  checkout_hour: string | null;
  commission: number | null;
  vat: number;
  cleaning_fee: number | null;
}

export function guestOwnedFieldsOf(guest: CleaningGuestWithRanges): GuestOwnedFields {
  return {
    notes: guest.notes,
    checkin_hour: guest.checkin_hour,
    checkout_hour: guest.checkout_hour,
    commission: guest.commission,
    vat: guest.vat,
    cleaning_fee: guest.cleaning_fee,
  };
}

/**
 * Writes a linked row: the given guest-owned fields, and everything else re-derived from
 * the reservation. Both callers go through here — the propagation path passes the row's
 * current guest-owned values back in, and the edit route passes the ones just submitted —
 * so a request body can never reach a field the reservation owns.
 */
export async function saveLinkedGuest(
  db: D1Database, guestId: string, res: ReservationRow, owned: GuestOwnedFields,
): Promise<void> {
  const fromRes = ownedFields(res);
  const cleaning_fee = owned.cleaning_fee ?? round2(140 + 7 * fromRes.total_guests);
  const derived = computeGuestDerived({
    finalPrice: fromRes.final_price,
    commission: owned.commission,
    vat: owned.vat === 1,
    cleaningFee: cleaning_fee,
  });

  await updateCleaningGuest(db, guestId, {
    ...fromRes,
    ...owned,
    // The Booking.com reference. A direct booking has none, and the field is locked in
    // the admin for exactly that reason.
    booking_number: null,
    cleaning_fee,
    ...derived,
  }, rangesFromReservation(res, guestId));
}

/**
 * Rewrites the reservation-owned fields and the ranges on an already-linked row, leaving
 * every guest-owned field as it was. A no-op when the reservation has no linked row —
 * editing a reservation must never create one, or reservations predating this feature
 * would start duplicating guest rows that already exist.
 */
export async function syncGuestFromReservation(
  db: D1Database, res: ReservationRow,
): Promise<void> {
  const guest = await getCleaningGuestByReservation(db, res.id);
  if (!guest) return;
  await saveLinkedGuest(db, guest.id, res, guestOwnedFieldsOf(guest));
}

/**
 * Called when a reservation stops being confirmed. The stay is not happening, so the row
 * has to leave the crew's list and the financial totals — unless an invoice has already
 * gone out against it, in which case deleting would erase a document that exists in the
 * world. Those are unlinked instead and stay behind as ordinary hand-entered rows.
 */
export async function detachGuestForReservation(
  db: D1Database, reservationId: string,
): Promise<'deleted' | 'unlinked' | 'none'> {
  const guest = await getCleaningGuestByReservation(db, reservationId);
  if (!guest) return 'none';

  const invoice = await getInvoice(db, guest.id);
  if (invoice) {
    await setGuestReservationLink(db, guest.id, null);
    return 'unlinked';
  }

  await deleteCleaningGuest(db, guest.id);
  return 'deleted';
}
