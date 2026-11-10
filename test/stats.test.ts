import { describe, expect, it } from "vitest";
import { computeStats, dayKey, formatDuration, nextLocalMidnight, shortDuration, totalsByDay, type Session } from "../src/stats";

const MIN = 60_000;
const SP = "America/Sao_Paulo"; // UTC-3, no DST since 2019
const s = (id: number, startIso: string, minutes: number | null): Session => {
  const start = Date.parse(startIso);
  return { id, start_ts: start, end_ts: minutes === null ? null : start + minutes * MIN, source: "web", auto_closed: 0 };
};

describe("time zone helpers", () => {
  it("gives the local day", () => {
    expect(dayKey(Date.parse("2026-11-10T02:00:00Z"), SP)).toBe("2026-11-09");
    expect(dayKey(Date.parse("2026-11-10T03:00:00Z"), SP)).toBe("2026-11-10");
  });
  it("finds the next local midnight", () => {
    expect(new Date(nextLocalMidnight(Date.parse("2026-11-09T20:00:00Z"), SP)).toISOString()).toBe("2026-11-10T03:00:00.000Z");
  });
  it("handles a DST change (New York, 2026-11-01)", () => {
    const ny = "America/New_York";
    expect(new Date(nextLocalMidnight(Date.parse("2026-11-01T12:00:00Z"), ny)).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
});

describe("totalsByDay", () => {
  it("splits a session across midnight", () => {
    // 23:30 local -> 00:45 local next day
    const m = totalsByDay([s(1, "2026-11-10T02:30:00Z", 75)], Date.parse("2026-11-11T00:00:00Z"), SP);
    expect(m.get("2026-11-09")).toBe(30 * MIN);
    expect(m.get("2026-11-10")).toBe(45 * MIN);
  });
  it("counts an open session up to now", () => {
    const now = Date.parse("2026-11-09T15:20:00Z");
    const m = totalsByDay([s(1, "2026-11-09T15:00:00Z", null)], now, SP);
    expect(m.get("2026-11-09")).toBe(20 * MIN);
  });
});

describe("computeStats", () => {
  const now = Date.parse("2026-11-09T22:00:00Z"); // 19:00 local, 2026-11-09
  const sessions = [
    s(1, "2026-11-03T22:00:00Z", 30), // 11-03 (in 7d window: 11-03..11-09)
    s(2, "2026-11-07T22:00:00Z", 20), // 11-07
    s(3, "2026-11-08T22:00:00Z", 40), // 11-08
    s(4, "2026-11-09T12:00:00Z", 10), // 11-09
    s(5, "2026-11-09T21:30:00Z", null), // 11-09 open, 30 min so far
    s(6, "2026-10-30T22:00:00Z", 60), // previous period (10-27..11-02)
  ];
  const st = computeStats(sessions, now, SP, 7);

  it("builds a 7-day window that ends today", () => {
    expect(st.daily.map((d) => d.date)).toEqual([
      "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09",
    ]);
  });
  it("computes totals and averages", () => {
    expect(st.todayMs).toBe(40 * MIN);
    expect(st.totalMs).toBe(130 * MIN);
    expect(st.avgPerDayMs).toBe(Math.round((130 * MIN) / 7));
    expect(st.readingDays).toBe(4);
    expect(st.avgPerReadingDayMs).toBe(Math.round((130 * MIN) / 4));
    expect(st.longestSessionMs).toBe(40 * MIN);
    expect(st.sessionCount).toBe(5);
  });
  it("compares with the previous period", () => {
    expect(st.previousTotalMs).toBe(60 * MIN);
    expect(st.changeVsPrevious).toBeCloseTo(130 / 60 - 1);
  });
  it("computes streaks", () => {
    expect(st.currentStreak).toBe(3); // 11-07, 11-08, 11-09
    expect(st.bestStreak).toBe(3);
  });
  it("reports the running session", () => {
    expect(st.running).toBe(true);
    expect(st.runningSince).toBe(Date.parse("2026-11-09T21:30:00Z"));
  });
  it("keeps the streak when today has no reading yet", () => {
    const st2 = computeStats(sessions.slice(0, 3), now, SP, 7);
    expect(st2.currentStreak).toBe(2); // 11-07, 11-08
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(65 * MIN, "en")).toBe("1 hour and 5 minutes");
    expect(formatDuration(120 * MIN, "pt")).toBe("2 horas");
    expect(formatDuration(1 * MIN, "pt")).toBe("1 minuto");
    expect(formatDuration(10_000, "en")).toBe("less than a minute");
    expect(shortDuration(65 * MIN)).toBe("1h 05m");
    expect(shortDuration(42 * MIN)).toBe("42m");
  });
});
