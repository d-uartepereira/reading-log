import { computeStats, formatDuration } from "./stats";
import { allSessions, maxSessionMs, openSession, startSession, stopSession, type Env } from "./store";

/*
 * Alexa custom skill endpoint.
 * Security: the handler accepts a request only when its application id is ALEXA_SKILL_ID
 * and its timestamp is less than 150 seconds old. It does not verify the Amazon
 * signature certificate chain. That check is necessary only for skill certification
 * (a public skill). This skill stays private in "development" status.
 */

type Lang = "pt" | "en";

interface AlexaRequest {
  session?: { new?: boolean; attributes?: Record<string, unknown>; application?: { applicationId?: string } };
  context?: { System?: { application?: { applicationId?: string } } };
  request: {
    type: string;
    locale?: string;
    timestamp?: string;
    intent?: { name: string };
  };
}

const T = {
  en: {
    started: "Okay. I started the reading timer. Enjoy your book.",
    alreadyRunning: (d: string) => `The reading timer already runs. You have read for ${d}.`,
    stopped: (d: string, today: string) => `Done. You read for ${d}. Today you read for ${today} in total.`,
    stoppedCapped: (d: string) => `Done. The session was very long, so I saved only ${d}. You can edit it on the dashboard.`,
    notRunning: "The reading timer does not run now. Say start reading to begin.",
    statusRunning: (d: string, today: string) => `You have read for ${d} in this session, and ${today} today.`,
    statusIdle: (today: string) => `The timer does not run. Today you read for ${today}.`,
    week: (avg: string, total: string, days: number) =>
      `In the last 7 days you read for ${total} in total, on ${days} ${days === 1 ? "day" : "days"}. Your daily average is ${avg}.`,
    welcomeIdle: "Reading log. Say start to begin the timer, or ask for your week.",
    welcomeRunning: (d: string) => `The timer runs. You have read for ${d}. Say stop to finish, or continue to keep reading.`,
    help: "You can say: start reading, stop reading, how long have I read, or how was my week.",
    bye: "Okay.",
    fallback: "Sorry, I did not understand. Say start, stop, or how was my week.",
    reprompt: "Say start, stop, or how was my week.",
  },
  pt: {
    started: "Pronto. Comecei a contar o tempo de leitura. Boa leitura.",
    alreadyRunning: (d: string) => `O cronômetro de leitura já está rodando. Você está lendo há ${d}.`,
    stopped: (d: string, today: string) => `Feito. Você leu por ${d}. Hoje você leu ${today} no total.`,
    stoppedCapped: (d: string) => `Feito. A sessão ficou muito longa, então salvei só ${d}. Você pode editar no painel.`,
    notRunning: "O cronômetro de leitura não está rodando. Diga começar leitura para iniciar.",
    statusRunning: (d: string, today: string) => `Você está lendo há ${d} nesta sessão, e leu ${today} hoje.`,
    statusIdle: (today: string) => `O cronômetro não está rodando. Hoje você leu ${today}.`,
    week: (avg: string, total: string, days: number) =>
      `Nos últimos 7 dias você leu ${total} no total, em ${days} ${days === 1 ? "dia" : "dias"}. Sua média diária é de ${avg}.`,
    welcomeIdle: "Registro de leitura. Diga começar para iniciar o cronômetro, ou pergunte como foi sua semana.",
    welcomeRunning: (d: string) => `O cronômetro está rodando. Você está lendo há ${d}. Diga parar para terminar, ou continuar para seguir lendo.`,
    help: "Você pode dizer: começar leitura, parar leitura, quanto tempo eu li, ou como foi minha semana.",
    bye: "Tá bom.",
    fallback: "Desculpe, não entendi. Diga começar, parar, ou como foi minha semana.",
    reprompt: "Diga começar, parar, ou como foi minha semana.",
  },
};

function speak(text: string, endSession: boolean, reprompt?: string, attributes?: Record<string, unknown>) {
  return {
    version: "1.0",
    sessionAttributes: attributes ?? {},
    response: {
      outputSpeech: { type: "PlainText", text },
      ...(reprompt ? { reprompt: { outputSpeech: { type: "PlainText", text: reprompt } } } : {}),
      shouldEndSession: endSession,
    },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json;charset=UTF-8" } });
}

export async function handleAlexa(request: Request, env: Env, now = Date.now()): Promise<Response> {
  let body: AlexaRequest;
  try {
    body = (await request.json()) as AlexaRequest;
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const appId = body.context?.System?.application?.applicationId ?? body.session?.application?.applicationId;
  if (!env.ALEXA_SKILL_ID || appId !== env.ALEXA_SKILL_ID) return json({ error: "forbidden" }, 403);
  const ts = Date.parse(body.request.timestamp ?? "");
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 150_000) return json({ error: "stale request" }, 400);

  const lang: Lang = (body.request.locale ?? "en").toLowerCase().startsWith("pt") ? "pt" : "en";
  const t = T[lang];
  const tz = env.TIMEZONE ?? "UTC";
  const maxMs = maxSessionMs(env);

  const todayText = async () => {
    const s = computeStats(await allSessions(env.DB), now, tz, 7);
    return { stats: s, today: formatDuration(s.todayMs, lang) };
  };

  const doStart = async () => {
    const { session, alreadyRunning } = await startSession(env.DB, "alexa", now);
    return alreadyRunning ? t.alreadyRunning(formatDuration(now - session.start_ts, lang)) : t.started;
  };

  const doStop = async () => {
    const stopped = await stopSession(env.DB, now, maxMs);
    if (!stopped || stopped.end_ts === null) return t.notRunning;
    const d = formatDuration(stopped.end_ts - stopped.start_ts, lang);
    if (stopped.auto_closed) return t.stoppedCapped(d);
    return t.stopped(d, (await todayText()).today);
  };

  const doStatus = async () => {
    const { stats, today } = await todayText();
    if (stats.running && stats.runningSince !== null) {
      return t.statusRunning(formatDuration(now - stats.runningSince, lang), today);
    }
    return t.statusIdle(today);
  };

  const doWeek = async () => {
    const s = computeStats(await allSessions(env.DB), now, tz, 7);
    return t.week(formatDuration(s.avgPerDayMs, lang), formatDuration(s.totalMs, lang), s.readingDays);
  };

  const req = body.request;
  switch (req.type) {
    case "LaunchRequest": {
      const { stats } = await todayText();
      if (stats.running && stats.runningSince !== null) {
        const text = t.welcomeRunning(formatDuration(now - stats.runningSince, lang));
        return json(speak(text, false, t.reprompt, { offeredStop: true }));
      }
      return json(speak(t.welcomeIdle, false, t.reprompt));
    }
    case "SessionEndedRequest":
      return json({ version: "1.0", response: {} });
    case "IntentRequest": {
      const name = req.intent?.name ?? "";
      const offeredStop = body.session?.attributes?.offeredStop === true;
      switch (name) {
        case "StartReadingIntent":
        case "AMAZON.ResumeIntent":
          return json(speak(await doStart(), true));
        case "StopReadingIntent":
        case "AMAZON.PauseIntent":
          return json(speak(await doStop(), true));
        case "StatusIntent":
          return json(speak(await doStatus(), true));
        case "WeeklySummaryIntent":
          return json(speak(await doWeek(), true));
        case "AMAZON.StopIntent":
          // Alexa sends "pede para o registro de leitura parar" / "ask reading log to stop"
          // as the built-in StopIntent, not as StopReadingIntent. In this skill, "stop"
          // means "stop the timer" when a timer runs.
          if (offeredStop || body.session?.new === true || (await openSession(env.DB))) {
            return json(speak(await doStop(), true));
          }
          return json(speak(t.bye, true));
        case "AMAZON.CancelIntent":
        case "AMAZON.NoIntent":
        case "AMAZON.NavigateHomeIntent":
          return json(speak(t.bye, true));
        case "AMAZON.HelpIntent":
          return json(speak(t.help, false, t.reprompt, body.session?.attributes));
        default:
          return json(speak(t.fallback, false, t.reprompt, body.session?.attributes));
      }
    }
    default:
      return json(speak(t.fallback, true));
  }
}
