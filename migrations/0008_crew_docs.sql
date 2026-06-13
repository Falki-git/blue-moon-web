-- Cleaning crew reference documents (checklists, guides, etc.).
-- Markdown is converted to HTML server-side at save time so no client-side parser is needed.
-- Apply with:
--   wrangler d1 execute blue-moon-dev  --env development --local  --file=migrations/0008_crew_docs.sql
--   wrangler d1 execute blue-moon-dev  --env development --remote --file=migrations/0008_crew_docs.sql
--   wrangler d1 execute blue-moon-prod --env production  --remote --file=migrations/0008_crew_docs.sql

CREATE TABLE IF NOT EXISTS crew_docs (
  id           TEXT    PRIMARY KEY,
  title        TEXT    NOT NULL,
  content_md   TEXT    NOT NULL DEFAULT '',
  content_html TEXT    NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

INSERT INTO d1_migrations (name, applied_at) VALUES ('0008_crew_docs', unixepoch());
