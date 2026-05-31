-- Add discount_rate_eur to pricing_rules; add discount snapshot columns to reservations
-- Apply with:
--   wrangler d1 execute blue-moon-dev --env development --remote --file=migrations/0005_add_discounts.sql
--   wrangler d1 execute blue-moon-prod --env production --remote --file=migrations/0005_add_discounts.sql

ALTER TABLE pricing_rules ADD COLUMN discount_rate_eur INTEGER;

ALTER TABLE reservations ADD COLUMN full_total_eur   INTEGER;
ALTER TABLE reservations ADD COLUMN discount_pct     INTEGER;
ALTER TABLE reservations ADD COLUMN pricing_snapshot TEXT;
