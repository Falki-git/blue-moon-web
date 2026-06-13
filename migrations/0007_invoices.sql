-- Guest invoices: one row per guest (resend overwrites it).
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0007_invoices.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0007_invoices.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0007_invoices.sql

CREATE TABLE IF NOT EXISTS invoices (
  guest_id       TEXT    PRIMARY KEY,   -- FK -> cleaning_guests.id
  invoice_number TEXT    NOT NULL,      -- full "yyyy-no" as sent
  invoice_year   INTEGER NOT NULL,      -- check-in year (per-year counter)
  invoice_seq    INTEGER NOT NULL,      -- the "no" part
  r2_key         TEXT    NOT NULL,      -- object key in the INVOICES bucket
  sent_at        INTEGER NOT NULL,      -- unixepoch of (last) send
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS invoices_year_idx ON invoices(invoice_year);
