-- Add country column to reservations
-- Apply with:
--   wrangler d1 execute blue-moon-dev --env development --remote --file=migrations/0002_add_country.sql
--   wrangler d1 execute blue-moon-prod --env production --remote --file=migrations/0002_add_country.sql

ALTER TABLE reservations ADD COLUMN country TEXT;
