import type { Session } from "./stats";

export interface Env {
  DB: D1Database;
  API_TOKEN: string;
  ALEXA_SKILL_ID?: string;
  TIMEZONE?: string;
  MAX_SESSION_MINUTES?: string;
}

export function maxSessionMs(env: Env): number {
  const n = Number(env.MAX_SESSION_MINUTES ?? "180");
  return (Number.isFinite(n) && n > 0 ? n : 180) * 60_000;
}

const COLS = "id, start_ts, end_ts, source, auto_closed";

export async function openSession(db: D1Database): Promise<Session | null> {
  return db.prepare(`SELECT ${COLS} FROM sessions WHERE end_ts IS NULL ORDER BY start_ts DESC LIMIT 1`).first<Session>();
}

/** Start a session. When one already runs, return it with `alreadyRunning: true`. */
export async function startSession(
  db: D1Database,
  source: string,
  now: number,
): Promise<{ session: Session; alreadyRunning: boolean }> {
  // One statement, so two quick requests cannot open two sessions.
  const inserted = await db
    .prepare(
      `INSERT INTO sessions (start_ts, source)
       SELECT ?1, ?2 WHERE NOT EXISTS (SELECT 1 FROM sessions WHERE end_ts IS NULL)
       RETURNING ${COLS}`,
    )
    .bind(now, source)
    .first<Session>();
  if (inserted) return { session: inserted, alreadyRunning: false };
  const open = await openSession(db);
  if (!open) throw new Error("No open session and the insert did not happen");
  return { session: open, alreadyRunning: true };
}

/** Stop the open session. Returns null when nothing runs. */
export async function stopSession(db: D1Database, now: number, maxMs: number): Promise<Session | null> {
  const open = await openSession(db);
  if (!open) return null;
  const capped = now - open.start_ts > maxMs;
  const end = capped ? open.start_ts + maxMs : now;
  return db
    .prepare(`UPDATE sessions SET end_ts = ?1, auto_closed = ?2 WHERE id = ?3 AND end_ts IS NULL RETURNING ${COLS}`)
    .bind(end, capped ? 1 : 0, open.id)
    .first<Session>();
}

/** Close sessions that run longer than the limit. The cron trigger calls this. */
export async function closeStale(db: D1Database, now: number, maxMs: number): Promise<number> {
  const res = await db
    .prepare(`UPDATE sessions SET end_ts = start_ts + ?1, auto_closed = 1 WHERE end_ts IS NULL AND ?2 - start_ts > ?1`)
    .bind(maxMs, now)
    .run();
  return res.meta.changes ?? 0;
}

export async function allSessions(db: D1Database): Promise<Session[]> {
  const res = await db.prepare(`SELECT ${COLS} FROM sessions ORDER BY start_ts ASC`).all<Session>();
  return res.results;
}

export async function recentSessions(db: D1Database, limit: number): Promise<Session[]> {
  const res = await db.prepare(`SELECT ${COLS} FROM sessions ORDER BY start_ts DESC LIMIT ?1`).bind(limit).all<Session>();
  return res.results;
}

export async function addSession(db: D1Database, start: number, end: number, source: string): Promise<Session | null> {
  return db
    .prepare(`INSERT INTO sessions (start_ts, end_ts, source) VALUES (?1, ?2, ?3) RETURNING ${COLS}`)
    .bind(start, end, source)
    .first<Session>();
}

export async function updateSession(
  db: D1Database,
  id: number,
  start: number,
  end: number | null,
): Promise<Session | null> {
  return db
    .prepare(`UPDATE sessions SET start_ts = ?1, end_ts = ?2, auto_closed = 0 WHERE id = ?3 RETURNING ${COLS}`)
    .bind(start, end, id)
    .first<Session>();
}

export async function deleteSession(db: D1Database, id: number): Promise<boolean> {
  const res = await db.prepare(`DELETE FROM sessions WHERE id = ?1`).bind(id).run();
  return (res.meta.changes ?? 0) > 0;
}
