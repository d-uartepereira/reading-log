export interface Session {
  id: number;
  start_ts: number;
  end_ts: number | null;
  source: string;
  auto_closed: number;
}

export interface DayTotal {
  date: string; // YYYY-MM-DD in the requested time zone
  ms: number;
}

export interface Stats {
  timezone: string;
  days: number;
  running: boolean;
  runningSince: number | null;
  todayMs: number;
  totalMs: number;
  avgPerDayMs: number;
  avgPerReadingDayMs: number;
  readingDays: number;
  sessionCount: number;
  longestSessionMs: number;
  previousTotalMs: number;
  changeVsPrevious: number | null; // ratio, e.g. 0.25 = +25 %
  currentStreak: number;
  bestStreak: number;
  allTimeMs: number;
  daily: DayTotal[];
}

const DAY = 86_400_000;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

function localParts(ms: number, tz: string) {
  const parts: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of the time zone from UTC at the instant `ms`, in milliseconds. */
export function tzOffset(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

export function dayKey(ms: number, tz: string): string {
  const p = localParts(ms, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The first instant of the local day after the day that contains `ms`. */
export function nextLocalMidnight(ms: number, tz: string): number {
  const off = tzOffset(ms, tz);
  const local = ms + off;
  let boundary = (Math.floor(local / DAY) + 1) * DAY - off;
  // Correct once for a DST change between `ms` and the boundary.
  const off2 = tzOffset(boundary, tz);
  if (off2 !== off) boundary = (Math.floor(local / DAY) + 1) * DAY - off2;
  if (boundary <= ms) boundary = ms + 1;
  return boundary;
}

/** Shift a YYYY-MM-DD key by `delta` calendar days. */
export function shiftKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Total reading time per local day. A session that crosses midnight counts on both days. */
export function totalsByDay(sessions: Session[], now: number, tz: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sessions) {
    const end = Math.min(s.end_ts ?? now, now);
    let cursor = s.start_ts;
    while (cursor < end) {
      const boundary = Math.min(nextLocalMidnight(cursor, tz), end);
      const key = dayKey(cursor, tz);
      out.set(key, (out.get(key) ?? 0) + (boundary - cursor));
      cursor = boundary;
    }
  }
  return out;
}

function streaks(byDay: Map<string, number>, today: string): { current: number; best: number } {
  let current = 0;
  let cursor = (byDay.get(today) ?? 0) > 0 ? today : shiftKey(today, -1);
  while ((byDay.get(cursor) ?? 0) > 0) {
    current++;
    cursor = shiftKey(cursor, -1);
  }
  const keys = [...byDay.keys()].filter((k) => (byDay.get(k) ?? 0) > 0).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    run = prev && shiftKey(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best: Math.max(best, current) };
}

export function computeStats(sessions: Session[], now: number, tz: string, days: number): Stats {
  const byDay = totalsByDay(sessions, now, tz);
  const today = dayKey(now, tz);

  const daily: DayTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftKey(today, -i);
    daily.push({ date, ms: byDay.get(date) ?? 0 });
  }
  const firstKey = daily[0].date;
  let previousTotalMs = 0;
  for (let i = 1; i <= days; i++) previousTotalMs += byDay.get(shiftKey(firstKey, -i)) ?? 0;

  const totalMs = daily.reduce((a, d) => a + d.ms, 0);
  const readingDays = daily.filter((d) => d.ms > 0).length;

  // Sessions that touch the window. The window starts at local midnight of the first day.
  const windowStart = now - (days + 1) * DAY;
  const inWindow = sessions.filter((s) => {
    const end = s.end_ts ?? now;
    return end > windowStart && byDayKeyInRange(dayKey(s.start_ts, tz), firstKey, today, dayKey(end, tz));
  });
  const longestSessionMs = inWindow.reduce((a, s) => Math.max(a, Math.min(s.end_ts ?? now, now) - s.start_ts), 0);

  const open = sessions.find((s) => s.end_ts === null) ?? null;
  const { current, best } = streaks(byDay, today);
  let allTimeMs = 0;
  for (const v of byDay.values()) allTimeMs += v;

  return {
    timezone: tz,
    days,
    running: open !== null,
    runningSince: open?.start_ts ?? null,
    todayMs: byDay.get(today) ?? 0,
    totalMs,
    avgPerDayMs: Math.round(totalMs / days),
    avgPerReadingDayMs: readingDays ? Math.round(totalMs / readingDays) : 0,
    readingDays,
    sessionCount: inWindow.length,
    longestSessionMs,
    previousTotalMs,
    changeVsPrevious: previousTotalMs > 0 ? (totalMs - previousTotalMs) / previousTotalMs : null,
    currentStreak: current,
    bestStreak: best,
    allTimeMs,
    daily,
  };
}

function byDayKeyInRange(startKey: string, first: string, last: string, endKey: string): boolean {
  // The session touches [first, last] if it starts on/before `last` and ends on/after `first`.
  return startKey <= last && endKey >= first;
}

/** Human text for a duration. `lang` is "pt" or "en". */
export function formatDuration(ms: number, lang: "pt" | "en" = "en"): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const w =
    lang === "pt"
      ? { h: ["hora", "horas"], m: ["minuto", "minutos"], and: "e", zero: "menos de um minuto" }
      : { h: ["hour", "hours"], m: ["minute", "minutes"], and: "and", zero: "less than a minute" };
  if (h === 0 && m === 0) return w.zero;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${w.h[h === 1 ? 0 : 1]}`);
  if (m) parts.push(`${m} ${w.m[m === 1 ? 0 : 1]}`);
  return parts.join(` ${w.and} `);
}

/** Short form: 1h 05m, 42m, 0m. */
export function shortDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
