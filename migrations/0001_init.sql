CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  start_ts    INTEGER NOT NULL,          -- epoch milliseconds
  end_ts      INTEGER,                   -- NULL while the session runs
  source      TEXT    NOT NULL DEFAULT 'unknown',
  auto_closed INTEGER NOT NULL DEFAULT 0 -- 1 when the cron job closed it
);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_ts);
CREATE INDEX IF NOT EXISTS idx_sessions_open  ON sessions(end_ts) WHERE end_ts IS NULL;
