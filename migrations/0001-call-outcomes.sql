-- Adds the columns that distinguish an answered call from a missed one.
--
-- schema.sql is CREATE TABLE IF NOT EXISTS, so it is the right file for a fresh
-- fork (Kokomo) and does nothing at all to a database that already has a calls
-- table. This file is for the databases that already exist. Both were changed
-- in the same commit; keep them in step.
--
-- Apply:  npx wrangler d1 execute muncie-radon --remote --file=./migrations/0001-call-outcomes.sql
--
-- SQLite has no ADD COLUMN IF NOT EXISTS, so re-running this errors with
-- "duplicate column name". That is the intended safety behaviour, not a bug.

ALTER TABLE calls ADD COLUMN talk_sec INTEGER;
ALTER TABLE calls ADD COLUMN recording_kind TEXT;
