-- Sent-at stamp for the no-deposit variant of the booking approved mail: the whole
-- amount is settled by the day of check-in, so that mail names no deposit and drops
-- the check-in information section.
--
-- It is never sent automatically — only by hand from admin -> Booking -> "Send
-- no-deposit approved mail" — so existing rows correctly stay NULL and there is
-- nothing to backfill.
--
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0012_no_deposit_approved_email.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0012_no_deposit_approved_email.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0012_no_deposit_approved_email.sql

ALTER TABLE reservations ADD COLUMN no_deposit_approved_email_sent_at INTEGER;

-- Name must match the filename exactly, including the .sql extension: `wrangler d1
-- migrations apply` compares filenames against this column, so a name recorded without
-- the extension makes wrangler think the migration is unapplied and re-run it.
INSERT INTO d1_migrations (name) VALUES ('0012_no_deposit_approved_email.sql');
