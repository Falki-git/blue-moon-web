-- Normalized per-range pricing for guest stays
CREATE TABLE IF NOT EXISTS guest_stay_ranges (
  id               TEXT    PRIMARY KEY,
  guest_id         TEXT    NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  start_date       TEXT    NOT NULL,
  end_date         TEXT    NOT NULL,
  full_price       REAL    NOT NULL,
  discounted_price REAL    NOT NULL,
  nights           INTEGER NOT NULL,
  range_total      REAL    NOT NULL
);
CREATE INDEX guest_stay_ranges_guest_idx ON guest_stay_ranges(guest_id);

-- Financial fields on cleaning_guests
ALTER TABLE cleaning_guests ADD COLUMN channel       TEXT    NOT NULL DEFAULT 'booking.com';
ALTER TABLE cleaning_guests ADD COLUMN commission    REAL;
ALTER TABLE cleaning_guests ADD COLUMN commission_pct REAL;
ALTER TABLE cleaning_guests ADD COLUMN vat           INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cleaning_guests ADD COLUMN vat_amount    REAL;
ALTER TABLE cleaning_guests ADD COLUMN cleaning_fee  REAL;
ALTER TABLE cleaning_guests ADD COLUMN final_price   REAL;
ALTER TABLE cleaning_guests ADD COLUMN payout        REAL;
ALTER TABLE cleaning_guests ADD COLUMN net_gain      REAL;
