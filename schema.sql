-- D1 schema for muncieradon.com
--
-- This database is the receipts. When the time comes to pitch a renter, the
-- argument is not "the site ranks well", it is "here are 47 inbound leads and
-- 31 calls from the last 90 days, with timestamps". Everything here exists to
-- make that query trivial.
--
-- Apply:  wrangler d1 execute muncie-radon --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT    NOT NULL,           -- ISO 8601 UTC
  name        TEXT    NOT NULL,
  phone       TEXT    NOT NULL,           -- as typed
  phone_e164  TEXT,                       -- normalized for dedupe / dialing
  email       TEXT,
  service     TEXT,                       -- service slug, or '' for undecided
  message     TEXT,
  page        TEXT,                       -- path the form was submitted from
  form_id     TEXT,                       -- which form instance converted
  utm         TEXT,                       -- raw query string, truncated
  referrer    TEXT,
  user_agent  TEXT,
  ip_country  TEXT,                       -- from CF, not the raw IP
  status      TEXT    NOT NULL DEFAULT 'new',   -- new | contacted | routed | won | lost | spam
  routed_to   TEXT,                       -- which operator got it
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_ts      ON leads (ts DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_page    ON leads (page);


CREATE TABLE IF NOT EXISTS calls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            TEXT    NOT NULL,
  call_sid      TEXT    UNIQUE,           -- Twilio CallSid, dedupes retried webhooks
  from_number   TEXT,
  to_number     TEXT,
  direction     TEXT,
  status        TEXT,                     -- completed | no-answer | busy | failed
  duration_sec  INTEGER,
  recording_url TEXT,
  from_city     TEXT,
  from_state    TEXT,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_calls_ts   ON calls (ts DESC);
CREATE INDEX IF NOT EXISTS idx_calls_from ON calls (from_number);


-- Click-to-call events. A click is not a call: people tap and hang up, and
-- mobile Safari fires the tel: handler without always completing. Kept in a
-- separate table so the calls table stays honest about actual conversations.
CREATE TABLE IF NOT EXISTS call_clicks (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL,
  placement TEXT,                          -- hero | header | footer-cta:home | ...
  page      TEXT,
  utm       TEXT,
  country   TEXT
);

CREATE INDEX IF NOT EXISTS idx_clicks_ts        ON call_clicks (ts DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_placement ON call_clicks (placement);
