-- Tracks when the pre-arrival eVisitor email (guest registration details + key-locker
-- code) was sent, so the admin dashboard can show "Resend eVisitor request" plus a
-- sent-at stamp — the same treatment welcome_email_sent_at gets.
--
-- The key-locker combination itself is NOT stored here: it lives in the settings table
-- under the key 'key_locker_code' and is editable from the admin Settings section.
--
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0010_evisitor_email_sent.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0010_evisitor_email_sent.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0010_evisitor_email_sent.sql

ALTER TABLE reservations ADD COLUMN evisitor_email_sent_at INTEGER;

-- Placeholder only — this repo is public, so the real combination never appears here.
-- Set it in admin -> Settings -> "Key-locker combination" after applying this migration;
-- until then guests would receive 0000, so do it before sending the first arrival email.
INSERT INTO settings (key, value, updated_at) VALUES ('key_locker_code', '0000', unixepoch())
  ON CONFLICT(key) DO NOTHING;

-- Name must match the filename exactly, including the .sql extension: `wrangler d1
-- migrations apply` compares filenames against this column, so a name recorded without
-- the extension makes wrangler think the migration is unapplied and re-run it.
-- applied_at is left to the column default (CURRENT_TIMESTAMP) so it stores a readable
-- datetime, matching migrations 0001-0009.
INSERT INTO d1_migrations (name) VALUES ('0010_evisitor_email_sent.sql');
