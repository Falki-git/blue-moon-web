-- Sent-at stamps for the two reservation emails that used to fire automatically only:
--   received_email_sent_at — the guest "we got your request" mail AND the owner
--                            notification, which the admin dashboard now sends together
--                            behind one "Send booking received mail" button.
--   approved_email_sent_at — the guest "booking approved" confirmation.
--
-- Both give those emails the same send / resend + timestamp treatment the deposit,
-- welcome and eVisitor mails already have (see GUEST_EMAIL_COLUMNS in src/worker/db.ts).
--
-- Manually created reservations (admin -> Booking -> "Add reservation") send nothing,
-- so their stamps stay NULL and both buttons show as green "Send …".
--
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0011_reservation_email_stamps.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0011_reservation_email_stamps.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0011_reservation_email_stamps.sql

ALTER TABLE reservations ADD COLUMN received_email_sent_at INTEGER;
ALTER TABLE reservations ADD COLUMN approved_email_sent_at INTEGER;

-- Backfill: every reservation that exists today came through the public booking form,
-- which always sends the guest pending + owner notification pair at creation time.
UPDATE reservations SET received_email_sent_at = created_at;

-- Approval mail went out whenever a reservation reached 'confirmed', at decided_at.
UPDATE reservations SET approved_email_sent_at = decided_at
  WHERE status = 'confirmed' AND decided_at IS NOT NULL;

-- Name must match the filename exactly, including the .sql extension: `wrangler d1
-- migrations apply` compares filenames against this column, so a name recorded without
-- the extension makes wrangler think the migration is unapplied and re-run it.
INSERT INTO d1_migrations (name) VALUES ('0011_reservation_email_stamps.sql');
