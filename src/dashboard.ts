export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f3a5f"/><path d="M11 19c7-2 14-2 20 1v27c-6-3-13-3-20-1z" fill="#f7f3e8"/><path d="M53 19c-7-2-14-2-20 1v27c6-3 13-3 20-1z" fill="#f7f3e8"/><rect x="31" y="18" width="2" height="31" fill="#e08e45"/></svg>`;

export const MANIFEST = JSON.stringify({
  name: "Reading Log",
  short_name: "Reading",
  start_url: "/",
  display: "standalone",
  background_color: "#1f3a5f",
  theme_color: "#1f3a5f",
  icons: [
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
  ],
});

export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Reading Log</title>
<meta name="description" content="Personal reading stopwatch">
<meta name="theme-color" content="#1f3a5f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Reading">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
:root{
  --bg:#f6f4ef; --card:#ffffff; --ink:#1d2430; --muted:#6b7280; --line:#e6e2d8;
  --accent:#1f3a5f; --accent-ink:#ffffff; --warm:#e08e45; --stop:#b4432f; --bar:#1f3a5f; --bar-dim:#c9d3e0;
  --radius:18px;
}
@media (prefers-color-scheme: dark){
  :root{ --bg:#0f141b; --card:#18202b; --ink:#e8ecf1; --muted:#97a3b3; --line:#263140;
    --accent:#7fa7d9; --accent-ink:#0f141b; --warm:#f0a565; --stop:#e07a63; --bar:#7fa7d9; --bar-dim:#2b3a4d; }
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:720px;margin:0 auto;padding:calc(16px + env(safe-area-inset-top)) 16px calc(32px + env(safe-area-inset-bottom))}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
header h1{font-size:20px;margin:0;display:flex;gap:10px;align-items:center}
header h1 img{width:28px;height:28px;border-radius:7px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px;margin-bottom:14px}
.timer{text-align:center;padding:28px 18px}
.clock{font-size:clamp(48px,14vw,76px);font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-1px}
.sub{color:var(--muted);font-size:14px;min-height:20px}
button{font:inherit;cursor:pointer;border:0;border-radius:999px}
.big{margin-top:18px;width:100%;max-width:340px;padding:18px;font-size:20px;font-weight:600;background:var(--accent);color:var(--accent-ink)}
.big.running{background:var(--stop);color:#fff}
.big:disabled{opacity:.6}
.ghost{background:transparent;color:var(--muted);padding:6px 10px;font-size:14px}
.ghost:hover{color:var(--ink)}
.seg{display:inline-flex;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:3px}
.seg button{background:transparent;color:var(--muted);padding:6px 14px;font-size:14px}
.seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}
@media(min-width:560px){.tiles{grid-template-columns:repeat(4,1fr)}}
.tile{background:var(--bg);border-radius:14px;padding:12px}
.tile .v{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.tile .k{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.chart{display:flex;align-items:flex-end;gap:4px;height:150px;margin-top:18px;position:relative}
.chart .col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.chart .b{width:100%;max-width:38px;background:var(--bar);border-radius:6px 6px 2px 2px;min-height:2px}
.chart .b.zero{background:var(--bar-dim)}
.chart .lbl{font-size:11px;color:var(--muted);margin-top:6px;white-space:nowrap}
.chart .avg{position:absolute;left:0;right:0;border-top:2px dashed var(--warm);pointer-events:none}
.chart .avg span{position:absolute;right:0;top:-20px;font-size:11px;color:var(--warm);background:var(--card);padding:0 4px}
h2{font-size:16px;margin:0}
ul.list{list-style:none;margin:10px 0 0;padding:0}
ul.list li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-top:1px solid var(--line);font-size:15px}
ul.list li:first-child{border-top:0}
ul.list li>div:first-child{min-width:0}
ul.list li>div:last-child{display:flex;flex-shrink:0}
ul.list .when{display:block;color:var(--muted);font-size:13px}
.pill{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:1px 8px;margin-left:6px}
.pill.warn{color:var(--warm);border-color:var(--warm)}
form.add{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-top:12px}
@media(max-width:520px){form.add{grid-template-columns:1fr 1fr}}
input{font:inherit;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);width:100%;min-width:0}
.btn{background:var(--accent);color:var(--accent-ink);padding:10px 16px;font-weight:600}
.login{max-width:420px;margin:12vh auto 0;text-align:center}
.login input{margin:16px 0}
.err{color:var(--stop);font-size:14px;min-height:20px}
.hidden{display:none!important}
.foot{text-align:center;color:var(--muted);font-size:13px}
.foot a{color:inherit}
</style>
</head>
<body>
<main>
  <section id="login" class="login hidden">
    <img src="/icon.svg" width="64" height="64" alt="">
    <h1 data-t="title"></h1>
    <p class="sub" data-t="loginHelp"></p>
    <form id="loginForm"><input id="tokenInput" type="password" autocomplete="current-password" data-ph="tokenPh"><button class="big" data-t="enter"></button></form>
    <p class="err" id="loginErr"></p>
  </section>

  <section id="app" class="hidden">
    <header>
      <h1><img src="/icon.svg" alt=""><span data-t="title"></span></h1>
      <button class="ghost" id="logout" data-t="logout"></button>
    </header>

    <div class="card timer">
      <div class="sub" id="state"></div>
      <div class="clock" id="clock">0:00:00</div>
      <div class="sub" id="today"></div>
      <button class="big" id="toggle"></button>
      <p class="err" id="err"></p>
    </div>

    <div class="card">
      <div class="row">
        <h2 data-t="overview"></h2>
        <div class="seg" id="range">
          <button data-days="7" class="on">7d</button><button data-days="30">30d</button><button data-days="90">90d</button>
        </div>
      </div>
      <div class="tiles">
        <div class="tile"><div class="k" data-t="avgDay"></div><div class="v" id="tAvg">–</div></div>
        <div class="tile"><div class="k" data-t="total"></div><div class="v" id="tTotal">–</div></div>
        <div class="tile"><div class="k" data-t="streak"></div><div class="v" id="tStreak">–</div></div>
        <div class="tile"><div class="k" data-t="vsPrev"></div><div class="v" id="tDelta">–</div></div>
        <div class="tile"><div class="k" data-t="readingDays"></div><div class="v" id="tDays">–</div></div>
        <div class="tile"><div class="k" data-t="avgReadingDay"></div><div class="v" id="tAvgRd">–</div></div>
        <div class="tile"><div class="k" data-t="longest"></div><div class="v" id="tLong">–</div></div>
        <div class="tile"><div class="k" data-t="allTime"></div><div class="v" id="tAll">–</div></div>
      </div>
      <div class="chart" id="chart"></div>
    </div>

    <div class="card">
      <div class="row"><h2 data-t="sessions"></h2><button class="ghost" id="showAdd" data-t="addManual"></button></div>
      <form class="add hidden" id="addForm">
        <input type="date" id="addDate" required>
        <input type="time" id="addTime" required>
        <input type="number" id="addMin" min="1" max="1440" data-ph="minutes" required>
        <button class="btn" data-t="add"></button>
      </form>
      <ul class="list" id="list"></ul>
    </div>

    <p class="foot"><a href="#" id="csv" data-t="export"></a></p>
  </section>
</main>
<script>
(() => {
  const L = (navigator.language || "en").toLowerCase().startsWith("pt") ? "pt" : "en";
  const I18N = {
    en: { title:"Reading Log", loginHelp:"Paste your API token. This device keeps it.", tokenPh:"API token", enter:"Open",
      logout:"Sign out", start:"Start reading", stop:"Stop", reading:"Reading now", idle:"Not reading", today:"Today",
      overview:"Overview", avgDay:"Daily average", total:"Total", streak:"Streak", vsPrev:"vs previous", readingDays:"Reading days",
      avgReadingDay:"Avg per reading day", longest:"Longest session", allTime:"All time", sessions:"Sessions",
      addManual:"+ Add manually", add:"Add", minutes:"Minutes", export:"Export CSV", del:"Delete", edit:"Edit",
      confirmDel:"Delete this session?", editPrompt:"Duration in minutes:", days:"d", badToken:"The token is not correct.",
      autoClosed:"auto-closed", running:"running", empty:"No sessions yet. Press Start reading." },
    pt: { title:"Registro de Leitura", loginHelp:"Cole o seu token da API. Este aparelho guarda o token.", tokenPh:"Token da API", enter:"Entrar",
      logout:"Sair", start:"Começar a ler", stop:"Parar", reading:"Lendo agora", idle:"Sem leitura agora", today:"Hoje",
      overview:"Resumo", avgDay:"Média diária", total:"Total", streak:"Sequência", vsPrev:"vs anterior", readingDays:"Dias com leitura",
      avgReadingDay:"Média por dia lido", longest:"Maior sessão", allTime:"Desde o início", sessions:"Sessões",
      addManual:"+ Adicionar manual", add:"Adicionar", minutes:"Minutos", export:"Exportar CSV", del:"Apagar", edit:"Editar",
      confirmDel:"Apagar esta sessão?", editPrompt:"Duração em minutos:", days:"d", badToken:"O token não está correto.",
      autoClosed:"fechada auto", running:"rodando", empty:"Nenhuma sessão ainda. Toque em Começar a ler." },
  }[L];
  document.documentElement.lang = L === "pt" ? "pt-BR" : "en";
  document.querySelectorAll("[data-t]").forEach(el => el.textContent = I18N[el.dataset.t]);
  document.querySelectorAll("[data-ph]").forEach(el => el.placeholder = I18N[el.dataset.ph]);
  document.title = I18N.title;

  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const $ = id => document.getElementById(id);
  const store = {
    get(){ try { return localStorage.getItem("rl_token"); } catch { return null; } },
    set(v){ try { localStorage.setItem("rl_token", v); } catch {} },
    del(){ try { localStorage.removeItem("rl_token"); } catch {} },
  };
  let token = store.get();
  let memToken = token;
  // A bookmark like https://host/#t=TOKEN signs this device in. The hash never reaches the server.
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("t")) { memToken = h.get("t"); store.set(memToken); history.replaceState(null, "", location.pathname); }
  token = memToken;

  let days = 7, status = null, offset = 0, tick = null, busy = false;
  try { const d = Number(localStorage.getItem("rl_days")); if ([7,30,90].includes(d)) days = d; } catch {}

  async function call(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { "authorization": "Bearer " + token, "content-type": "application/json",
      "x-timezone": TZ, "accept-language": L, ...(opts.headers || {}) } });
    if (res.status === 401) { showLogin(I18N.badToken); throw new Error("unauthorized"); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
  }

  const pad = n => String(n).padStart(2, "0");
  const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s/3600) + ":" + pad(Math.floor(s/60)%60) + ":" + pad(s%60); };
  const short = ms => { const m = Math.floor(ms / 60000); const h = Math.floor(m / 60); return h ? h + "h " + pad(m % 60) + "m" : m + "m"; };
  const fmtDate = (ms, o) => new Intl.DateTimeFormat(L === "pt" ? "pt-BR" : "en", o).format(new Date(ms));

  function showLogin(msg) {
    $("app").classList.add("hidden"); $("login").classList.remove("hidden"); $("loginErr").textContent = msg || "";
    clearInterval(tick);
  }
  function showApp() { $("login").classList.add("hidden"); $("app").classList.remove("hidden"); }

  function renderTimer() {
    if (!status) return;
    const now = Date.now() + offset;
    const running = status.running;
    const elapsed = running ? now - status.session.start_ts : 0;
    $("clock").textContent = clock(elapsed);
    $("state").textContent = running ? I18N.reading + " · " + fmtDate(status.session.start_ts, { hour: "2-digit", minute: "2-digit" }) : I18N.idle;
    $("today").textContent = I18N.today + ": " + short(status.todayMs + (running ? now - status.now : 0));
    const b = $("toggle"); b.textContent = running ? I18N.stop : I18N.start; b.classList.toggle("running", running);
  }

  async function refreshStatus() {
    status = await call("/api/status");
    offset = status.now - Date.now();
    renderTimer();
  }

  async function refreshStats() {
    const s = await call("/api/stats?days=" + days);
    $("tAvg").textContent = short(s.avgPerDayMs);
    $("tTotal").textContent = short(s.totalMs);
    $("tStreak").textContent = s.currentStreak + I18N.days;
    $("tDelta").textContent = s.changeVsPrevious === null ? "–" : (s.changeVsPrevious >= 0 ? "+" : "") + Math.round(s.changeVsPrevious * 100) + "%";
    $("tDays").textContent = s.readingDays + "/" + s.days;
    $("tAvgRd").textContent = short(s.avgPerReadingDayMs);
    $("tLong").textContent = short(s.longestSessionMs);
    $("tAll").textContent = short(s.allTimeMs);
    const max = Math.max(...s.daily.map(d => d.ms), s.avgPerDayMs, 60000);
    const chart = $("chart"); chart.innerHTML = "";
    const every = s.days <= 7 ? 1 : s.days <= 30 ? 5 : 15;
    s.daily.forEach((d, i) => {
      const col = document.createElement("div"); col.className = "col";
      col.title = d.date + " · " + short(d.ms);
      const bar = document.createElement("div"); bar.className = "b" + (d.ms ? "" : " zero");
      bar.style.height = (d.ms ? Math.max(3, d.ms / max * 100) : 2) + "%";
      const lbl = document.createElement("div"); lbl.className = "lbl";
      const dt = new Date(d.date + "T12:00:00Z");
      lbl.textContent = (s.days - 1 - i) % every === 0 ? (s.days <= 7 ? fmtDate(dt, { weekday: "short", timeZone: "UTC" }) : fmtDate(dt, { day: "numeric", month: "short", timeZone: "UTC" })) : "";
      col.append(bar, lbl); chart.append(col);
    });
    if (s.avgPerDayMs > 0) {
      const line = document.createElement("div"); line.className = "avg";
      line.style.bottom = "calc(" + (s.avgPerDayMs / max) + " * (100% - 22px) + 22px)";
      const sp = document.createElement("span"); sp.textContent = "⌀ " + short(s.avgPerDayMs); line.append(sp); chart.append(line);
    }
  }

  async function refreshList() {
    const { sessions, now } = await call("/api/sessions?limit=30");
    const ul = $("list"); ul.innerHTML = "";
    if (!sessions.length) { const li = document.createElement("li"); li.textContent = I18N.empty; li.style.color = "var(--muted)"; ul.append(li); return; }
    for (const s of sessions) {
      const li = document.createElement("li");
      const left = document.createElement("div");
      const dur = (s.end_ts ?? now) - s.start_ts;
      left.innerHTML = "<strong></strong>";
      left.querySelector("strong").textContent = short(dur);
      const src = document.createElement("span"); src.className = "pill"; src.textContent = s.source; left.append(src);
      if (s.end_ts === null) { const p = document.createElement("span"); p.className = "pill warn"; p.textContent = I18N.running; left.append(p); }
      if (s.auto_closed) { const p = document.createElement("span"); p.className = "pill warn"; p.textContent = I18N.autoClosed; left.append(p); }
      const when = document.createElement("span"); when.className = "when";
      when.textContent = fmtDate(s.start_ts, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      left.append(when);
      const right = document.createElement("div");
      if (s.end_ts !== null) {
        const e = document.createElement("button"); e.className = "ghost"; e.textContent = I18N.edit;
        e.onclick = async () => {
          const v = prompt(I18N.editPrompt, String(Math.round(dur / 60000)));
          const n = Number(v); if (!v || !Number.isFinite(n) || n <= 0) return;
          await call("/api/sessions/" + s.id, { method: "PATCH", body: JSON.stringify({ end_ts: s.start_ts + Math.round(n * 60000) }) }).catch(err => $("err").textContent = err.message);
          refreshAll();
        };
        right.append(e);
      }
      const d = document.createElement("button"); d.className = "ghost"; d.textContent = I18N.del;
      d.onclick = async () => { if (!confirm(I18N.confirmDel)) return; await call("/api/sessions/" + s.id, { method: "DELETE" }); refreshAll(); };
      right.append(d);
      li.append(left, right); ul.append(li);
    }
  }

  async function refreshAll() {
    try { $("err").textContent = ""; await Promise.all([refreshStatus(), refreshStats(), refreshList()]); }
    catch (e) { if (e.message !== "unauthorized") $("err").textContent = e.message; }
  }

  $("toggle").onclick = async () => {
    if (busy) return; busy = true; $("toggle").disabled = true;
    try { await call(status && status.running ? "/api/stop" : "/api/start", { method: "POST", body: JSON.stringify({ source: "web" }) }); await refreshAll(); }
    catch (e) { $("err").textContent = e.message; }
    finally { busy = false; $("toggle").disabled = false; }
  };
  $("range").onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    days = Number(b.dataset.days); try { localStorage.setItem("rl_days", String(days)); } catch {}
    [...$("range").children].forEach(x => x.classList.toggle("on", x === b));
    refreshStats().catch(() => {});
  };
  [...$("range").children].forEach(x => x.classList.toggle("on", Number(x.dataset.days) === days));
  $("showAdd").onclick = () => {
    const f = $("addForm"); f.classList.toggle("hidden");
    const n = new Date(); $("addDate").value = n.getFullYear() + "-" + pad(n.getMonth()+1) + "-" + pad(n.getDate());
    $("addTime").value = pad(n.getHours()) + ":" + pad(n.getMinutes());
  };
  $("addForm").onsubmit = async e => {
    e.preventDefault();
    const start = new Date($("addDate").value + "T" + $("addTime").value).getTime();
    const end = start + Number($("addMin").value) * 60000;
    try { await call("/api/sessions", { method: "POST", body: JSON.stringify({ start_ts: start, end_ts: end }) }); $("addForm").classList.add("hidden"); $("addMin").value = ""; refreshAll(); }
    catch (err) { $("err").textContent = err.message; }
  };
  $("csv").onclick = async e => {
    e.preventDefault();
    const res = await fetch("/api/export.csv", { headers: { authorization: "Bearer " + token } });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = "reading-log.csv"; a.click(); URL.revokeObjectURL(url);
  };
  $("logout").onclick = () => { store.del(); token = null; showLogin(); };
  $("loginForm").onsubmit = async e => {
    e.preventDefault(); token = $("tokenInput").value.trim(); if (!token) return;
    store.set(token); start();
  };
  document.addEventListener("visibilitychange", () => { if (!document.hidden && token) refreshAll(); });

  function start() {
    if (!token) return showLogin();
    showApp(); refreshAll();
    clearInterval(tick); tick = setInterval(renderTimer, 1000);
    setInterval(() => { if (!document.hidden) refreshStatus().catch(() => {}); }, 30000);
  }
  start();
})();
</script>
</body>
</html>`;
