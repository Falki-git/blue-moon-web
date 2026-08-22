-- Links a guest-data row back to the reservation it was propagated from, so a confirmed
-- direct booking materialises a guest row automatically and stays in sync with it.
-- NULL means a hand-entered row (every Booking.com guest, and any row that was unlinked).
--
-- The partial unique index is what guarantees one reservation can never propagate twice.
--
-- Nothing is backfilled: reservations that already existed keep out of guest data until
-- they are pulled in deliberately with admin -> Booking -> "Add to guest data", so no
-- duplicates appear against rows that were already typed in by hand.
--
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0015_guest_reservation_link.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0015_guest_reservation_link.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0015_guest_reservation_link.sql

ALTER TABLE cleaning_guests ADD COLUMN reservation_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS cleaning_guests_reservation_idx
  ON cleaning_guests(reservation_id) WHERE reservation_id IS NOT NULL;

-- Name must match the filename exactly, including the .sql extension: `wrangler d1
-- migrations apply` compares filenames against this column, so a name recorded without
-- the extension makes wrangler think the migration is unapplied and re-run it.
INSERT INTO d1_migrations (name) VALUES ('0015_guest_reservation_link.sql');
