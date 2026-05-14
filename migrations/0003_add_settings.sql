-- Add settings table for configurable booking parameters (e.g. min_advance_days)
-- Apply with:
--   wrangler d1 execute blue-moon-dev --env development --local --file=migrations/0003_add_settings.sql
--   wrangler d1 execute blue-moon-prod --env production --remote --file=migrations/0003_add_settings.sql

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT    PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
