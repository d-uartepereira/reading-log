import { handleAlexa } from "./alexa";
import { APPLE_TOUCH_ICON_PNG_BASE64 } from "./icon";
import { DASHBOARD_HTML, ICON_SVG, MANIFEST } from "./dashboard";
import { computeStats, formatDuration, isValidTimeZone, shortDuration } from "./stats";
import {
  addSession,
  allSessions,
  closeStale,
  deleteSession,
  maxSessionMs,
  openSession,
  recentSessions,
  startSession,
  stopSession,
  updateSession,
  type Env,
} from "./store";

const SOURCES = new Set(["web", "raycast", "siri", "shortcut", "alexa", "cli", "manual", "unknown"]);

function json(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json;charset=UTF-8", "cache-control": "no-store", ...extra },
  });
}

/** Clients that send `Accept: text/plain` (Raycast, Siri Shortcuts) get only the message line. */
function reply(request: Request, body: { message: string } & Record<string, unknown>, status = 200): Response {
  const accept = request.headers.get("accept") ?? "";
  const url = new URL(request.url);
  if (accept.includes("text/plain") || url.searchParams.get("format") === "text") {
    return new Response(body.message + "\n", {
      status,
      headers: { "content-type": "text/plain;charset=UTF-8", "cache-control": "no-store" },
    });
  }
  return json(body, status);
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function authorized(request: Request, env: Env): boolean {
  if (!env.API_TOKEN) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : request.headers.get("x-api-token") ?? "";
  return token.length > 0 && timingSafeEqual(token, env.API_TOKEN);
}

function langOf(request: Request): "pt" | "en" {
  const url = new URL(request.url);
  const l = url.searchParams.get("lang") ?? request.headers.get("accept-language") ?? "en";
  return l.toLowerCase().startsWith("pt") ? "pt" : "en";
}

function tzOf(request: Request, env: Env): string {
  const tz = new URL(request.url).searchParams.get("tz") ?? request.headers.get("x-timezone") ?? env.TIMEZONE ?? "UTC";
  return isValidTimeZone(tz) ? tz : env.TIMEZONE ?? "UTC";
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET" || request.method === "DELETE") return {};
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function sourceOf(request: Request, body: Record<string, unknown>): string {
  const raw = String(body.source ?? new URL(request.url).searchParams.get("source") ?? "unknown").toLowerCase();
  return SOURCES.has(raw) ? raw : "unknown";
}

const MSG = {
  en: {
    started: "Reading timer started.",
    already: (d: string) => `Already reading for ${d}.`,
    stopped: (d: string, today: string) => `Stopped. You read for ${d}. Today: ${today}.`,
    capped: (d: string) => `Stopped. The session was too long, so it was saved as ${d}. Edit it on the dashboard.`,
    notRunning: "The reading timer does not run.",
    status: (d: string, today: string) => `Reading now for ${d}. Today: ${today}.`,
    idle: (today: string) => `Not reading. Today: ${today}.`,
  },
  pt: {
    started: "Cronômetro de leitura iniciado.",
    already: (d: string) => `Você já está lendo há ${d}.`,
    stopped: (d: string, today: string) => `Parado. Você leu por ${d}. Hoje: ${today}.`,
    capped: (d: string) => `Parado. A sessão ficou longa demais, então foi salva com ${d}. Edite no painel.`,
    notRunning: "O cronômetro de leitura não está rodando.",
    status: (d: string, today: string) => `Lendo há ${d}. Hoje: ${today}.`,
    idle: (today: string) => `Não está lendo. Hoje: ${today}.`,
  },
};

async function api(request: Request, env: Env, path: string, now: number): Promise<Response> {
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 401, { "www-authenticate": "Bearer" });

  const lang = langOf(request);
  const m = MSG[lang];
  const tz = tzOf(request, env);
  const maxMs = maxSessionMs(env);
  const method = request.method;
  const body = await readBody(request);
  const today = async () => computeStats(await allSessions(env.DB), now, tz, 1).todayMs;

  const start = async () => {
    const { session, alreadyRunning } = await startSession(env.DB, sourceOf(request, body), now);
    const message = alreadyRunning ? m.already(shortDuration(now - session.start_ts)) : m.started;
    return reply(request, { message, running: true, alreadyRunning, session });
  };
  const stop = async () => {
    const session = await stopSession(env.DB, now, maxMs);
    if (!session || session.end_ts === null) return reply(request, { message: m.notRunning, running: false, session: null });
    const d = shortDuration(session.end_ts - session.start_ts);
    const message = session.auto_closed ? m.capped(d) : m.stopped(d, shortDuration(await today()));
    return reply(request, { message, running: false, durationMs: session.end_ts - session.start_ts, session });
  };

  if (path === "/api/start" && method === "POST") return start();
  if (path === "/api/stop" && method === "POST") return stop();
  if (path === "/api/toggle" && method === "POST") return (await openSession(env.DB)) ? stop() : start();

  if (path === "/api/status" && method === "GET") {
    const open = await openSession(env.DB);
    const todayMs = await today();
    const message = open ? m.status(shortDuration(now - open.start_ts), shortDuration(todayMs)) : m.idle(shortDuration(todayMs));
    return reply(request, {
      message,
      running: open !== null,
      session: open,
      elapsedMs: open ? now - open.start_ts : 0,
      todayMs,
      now,
    });
  }

  if (path === "/api/stats" && method === "GET") {
    const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days") ?? 7) || 7, 1), 366);
    const stats = computeStats(await allSessions(env.DB), now, tz, days);
    const message =
      lang === "pt"
        ? `Últimos ${days} dias: ${shortDuration(stats.totalMs)} no total, média de ${shortDuration(stats.avgPerDayMs)} por dia, ${stats.readingDays} ${stats.readingDays === 1 ? "dia" : "dias"} com leitura, sequência atual de ${stats.currentStreak} ${stats.currentStreak === 1 ? "dia" : "dias"}. Hoje: ${shortDuration(stats.todayMs)}.`
        : `Last ${days} days: ${shortDuration(stats.totalMs)} total, ${shortDuration(stats.avgPerDayMs)} per day on average, ${stats.readingDays} reading ${stats.readingDays === 1 ? "day" : "days"}, current streak ${stats.currentStreak} ${stats.currentStreak === 1 ? "day" : "days"}. Today: ${shortDuration(stats.todayMs)}.`;
    return reply(request, { message, ...stats, now });
  }

  if (path === "/api/sessions" && method === "GET") {
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50, 1), 500);
    return json({ sessions: await recentSessions(env.DB, limit), now });
  }

  if (path === "/api/sessions" && method === "POST") {
    const s = Number(body.start_ts);
    const e = Number(body.end_ts);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || e > now + 60_000) {
      return json({ error: "start_ts and end_ts must be epoch ms, with start < end, and not in the future" }, 400);
    }
    const session = await addSession(env.DB, s, e, "manual");
    return json({ message: `Added ${formatDuration(e - s, lang)}.`, session }, 201);
  }

  const idMatch = path.match(/^\/api\/sessions\/(\d+)$/);
  if (idMatch) {
    const id = Number(idMatch[1]);
    if (method === "DELETE") {
      return (await deleteSession(env.DB, id)) ? json({ message: "Deleted." }) : json({ error: "not found" }, 404);
    }
    if (method === "PATCH") {
      const all = await allSessions(env.DB);
      const current = all.find((x) => x.id === id);
      if (!current) return json({ error: "not found" }, 404);
      const s = body.start_ts === undefined ? current.start_ts : Number(body.start_ts);
      const e = body.end_ts === undefined ? current.end_ts : body.end_ts === null ? null : Number(body.end_ts);
      if (!Number.isFinite(s) || s > now) return json({ error: "bad start_ts" }, 400);
      if (e === null && current.end_ts !== null) return json({ error: "cannot reopen a closed session" }, 400);
      if (e !== null && (!Number.isFinite(e) || e <= s || e > now + 60_000)) return json({ error: "bad end_ts" }, 400);
      return json({ session: await updateSession(env.DB, id, s, e) });
    }
  }

  if (path === "/api/export.csv" && method === "GET") {
    const rows = await allSessions(env.DB);
    const lines = ["id,start_iso,end_iso,minutes,source,auto_closed"];
    for (const r of rows) {
      const end = r.end_ts ?? now;
      lines.push(
        [r.id, new Date(r.start_ts).toISOString(), r.end_ts ? new Date(r.end_ts).toISOString() : "", ((end - r.start_ts) / 60_000).toFixed(1), r.source, r.auto_closed].join(","),
      );
    }
    return new Response(lines.join("\n") + "\n", {
      headers: { "content-type": "text/csv;charset=UTF-8", "content-disposition": 'attachment; filename="reading-log.csv"' },
    });
  }

  return json({ error: "not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const now = Date.now();

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "authorization,content-type,x-api-token,x-timezone",
        },
      });
    }

    try {
      if (path === "/" && request.method === "GET") {
        return new Response(DASHBOARD_HTML, {
          headers: { "content-type": "text/html;charset=UTF-8", "cache-control": "no-cache" },
        });
      }
      if (path === "/manifest.webmanifest") {
        return new Response(MANIFEST, { headers: { "content-type": "application/manifest+json" } });
      }
      if (path === "/icon.svg") return new Response(ICON_SVG, { headers: { "content-type": "image/svg+xml" } });
      if (path === "/apple-touch-icon.png" || path === "/icon-512.png") {
        const bin = Uint8Array.from(atob(APPLE_TOUCH_ICON_PNG_BASE64), (c) => c.charCodeAt(0));
        return new Response(bin, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
      }
      if (path === "/health") return json({ ok: true });
      if (path === "/alexa" && request.method === "POST") return await handleAlexa(request, env, now);
      if (path.startsWith("/api/")) return await api(request, env, path, now);
      return json({ error: "not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "internal error" }, 500);
    }
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const closed = await closeStale(env.DB, Date.now(), maxSessionMs(env));
    if (closed) console.log(`Closed ${closed} stale session(s).`);
  },
} satisfies ExportedHandler<Env>;
