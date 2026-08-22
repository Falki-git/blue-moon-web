-- Sent-at stamp for the payment confirmation mail: acknowledges that the whole stay
-- has been paid and that nothing is outstanding. Distinct from the deposit
-- confirmation, which acknowledges the 30% deposit and still names a balance.
--
-- Sent by hand only, from admin -> Booking -> "Send payment confirmation", so existing
-- rows correctly stay NULL and there is nothing to backfill.
--
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0013_payment_confirmation_email.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0013_payment_confirmation_email.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0013_payment_confirmation_email.sql

ALTER TABLE reservations ADD COLUMN payment_confirmation_sent_at INTEGER;

-- Name must match the filename exactly, including the .sql extension: `wrangler d1
-- migrations apply` compares filenames against this column, so a name recorded without
-- the extension makes wrangler think the migration is unapplied and re-run it.
INSERT INTO d1_migrations (name) VALUES ('0013_payment_confirmation_email.sql');
