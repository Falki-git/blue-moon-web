-- Sent-at stamp for the goodbye mail: the thank-you note that goes out the day before
-- check-out, carrying the check-out reminder, the key-return instructions and the
-- key-locker code, an invitation to reply with feedback, and the early-bird offer for
-- next season.
--
-- Sent by hand only, from admin -> Booking -> "Send goodbye mail", so existing rows
-- correctly stay NULL and there is nothing to backfill.
--
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0016_goodbye_email_sent.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0016_goodbye_email_sent.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0016_goodbye_email_sent.sql

ALTER TABLE reservations ADD COLUMN goodbye_email_sent_at INTEGER;

-- Name must match the filename exactly, including the .sql extension: `wrangler d1
-- migrations apply` compares filenames against this column, so a name recorded without
-- the extension makes wrangler think the migration is unapplied and re-run it.
INSERT INTO d1_migrations (name) VALUES ('0016_goodbye_email_sent.sql');
