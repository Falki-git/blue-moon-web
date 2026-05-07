-- Blue Moon Apartment — booking system schema (initial)
-- Apply with:
--   wrangler d1 execute <db-name> --local --file=migrations/0001_init.sql   (dev)
--   wrangler d1 execute <db-name> --remote --file=migrations/0001_init.sql  (prod)

CREATE TABLE pricing_rules (
  month       INTEGER PRIMARY KEY,
  rate_eur    INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

INSERT INTO pricing_rules (month, rate_eur, updated_at) VALUES
  (6, 250, unixepoch()),
  (7, 300, unixepoch()),
  (8, 300, unixepoch()),
  (9, 250, unixepoch());

CREATE TABLE reservations (
  id              TEXT PRIMARY KEY,
  created_at      INTEGER NOT NULL,
  status          TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  language        TEXT,
  address         TEXT,
  source          TEXT,
  guests          INTEGER NOT NULL,
  children_ages   TEXT,
  check_in        TEXT NOT NULL,
  check_out       TEXT NOT NULL,
  nights          INTEGER NOT NULL,
  total_eur       INTEGER NOT NULL,
  message         TEXT,
  decision_token  TEXT NOT NULL,
  decided_at      INTEGER
);

CREATE INDEX reservations_status_dates_idx
  ON reservations(status, check_in, check_out);

CREATE TABLE manual_blocks (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  from_date   TEXT NOT NULL,
  to_date     TEXT NOT NULL,
  note        TEXT
);

CREATE INDEX manual_blocks_dates_idx ON manual_blocks(from_date, to_date);
