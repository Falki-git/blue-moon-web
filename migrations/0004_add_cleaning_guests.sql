CREATE TABLE IF NOT EXISTS cleaning_guests (
  id             TEXT     PRIMARY KEY,
  created_at     INTEGER  NOT NULL,
  guest_name     TEXT     NOT NULL,
  booking_number TEXT,
  country        TEXT,
  check_in       TEXT     NOT NULL,
  check_out      TEXT     NOT NULL,
  booking_date   TEXT,
  total_guests   INTEGER  NOT NULL DEFAULT 1,
  adults         INTEGER  NOT NULL DEFAULT 1,
  children       INTEGER  NOT NULL DEFAULT 0,
  children_ages  TEXT,
  nights         INTEGER  NOT NULL,
  email          TEXT,
  phone          TEXT,
  notes          TEXT,
  checkin_hour   TEXT,
  checkout_hour  TEXT
);

CREATE INDEX cleaning_guests_checkin_idx ON cleaning_guests(check_in);
