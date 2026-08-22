-- Split the single guest count on a reservation into adults + children, matching the
-- shape guest data already uses (cleaning_guests.adults / children / total_guests).
-- `guests` stays as the stored total, so everything that reads a total is unaffected.
--
-- Backfill sets adults = guests, children = 0 rather than guessing from children_ages:
-- that column is free prose ("4 and 7 years old"), so counting separators would be wrong
-- as often as right. Existing rows keep a correct total and a visible ages string; the
-- few that had children can be corrected with one edit in the admin panel.
--
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0014_reservation_adults_children.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0014_reservation_adults_children.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0014_reservation_adults_children.sql

ALTER TABLE reservations ADD COLUMN adults   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE reservations ADD COLUMN children INTEGER NOT NULL DEFAULT 0;

UPDATE reservations SET adults = guests;

-- Name must match the filename exactly, including the .sql extension: `wrangler d1
-- migrations apply` compares filenames against this column, so a name recorded without
-- the extension makes wrangler think the migration is unapplied and re-run it.
INSERT INTO d1_migrations (name) VALUES ('0014_reservation_adults_children.sql');
