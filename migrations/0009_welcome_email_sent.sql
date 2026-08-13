-- Tracks when the welcome info email (link to the guest guide) was sent to a guest,
-- so the admin dashboard can show "Resend welcome info" plus a sent-at stamp —
-- the same treatment deposit_confirmation_sent_at gets.
--
-- Further guest emails (e.g. eVisitor) follow this pattern: add one column here, one
-- entry in GUEST_EMAIL_COLUMNS in src/worker/db.ts, and one guestEmailButton() call
-- in src/pages/admin/index.astro.
--
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0009_welcome_email_sent.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0009_welcome_email_sent.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0009_welcome_email_sent.sql

ALTER TABLE reservations ADD COLUMN welcome_email_sent_at INTEGER;

INSERT INTO d1_migrations (name, applied_at) VALUES ('0009_welcome_email_sent', unixepoch());
