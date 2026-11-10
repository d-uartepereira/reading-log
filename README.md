# Reading Log

A personal reading stopwatch that you host yourself. Start and stop the timer from your phone, your
Mac (Raycast), Siri, or Alexa. Every session is saved, and a dashboard shows how much you read, like
Screen Time for books.

The app records **time only**. It does not record what you read.

## Features

- **One timer, many devices.** Start on Alexa at bedtime, stop from the phone. Only one session can
  run at a time. A second "start" tells you how long the current session has run.
- **Dashboard** that you can add to the phone home screen: a live timer, today's total, charts for
  7, 30 and 90 days, the daily average, the average per reading day, streaks, the longest session,
  and the change against the previous period. You can edit, delete, or add sessions, and export a
  CSV file.
- **Raycast** script commands for the Mac.
- **Siri** through the Shortcuts app.
- **Alexa** through a private custom skill (Portuguese (Brazil) and English (US)).
- **Forgotten timers:** if you fall asleep with the timer on, a job closes the session after 3 hours
  (you can change this). You can then correct the duration on the dashboard.
- **Time zones:** the daily totals use your local time zone. A session that crosses midnight counts
  on both days.
- **Languages:** the dashboard and the spoken or text replies are in English or Portuguese.

## How it works

```
Phone (home-screen app, Siri Shortcuts) ─┐
Mac (Raycast, browser)                  ─┼──► Cloudflare Worker ──► D1 (SQLite)
Alexa (custom skill)                    ─┘    + a cron job every 15 minutes
```

The backend is one [Cloudflare Worker](https://developers.cloudflare.com/workers/) with one
[D1](https://developers.cloudflare.com/d1/) database. The Cloudflare free plan is sufficient for
personal use. The Worker serves the API, the dashboard, and the Alexa endpoint. One secret token
protects the API.

## Requirements

- A Cloudflare account (free).
- Node.js 20 or newer, `npm`, `curl` and `openssl`, on macOS or Linux.
- Optional: [Raycast](https://www.raycast.com/) (macOS), an iPhone with the Shortcuts app, an Amazon
  account with an Echo device.

## 1. Deploy

```bash
git clone https://github.com/d-uartepereira/reading-log.git
```

```bash
cd reading-log && npm run setup
```

The setup script does these steps:

1. It installs the dependencies.
2. It makes `wrangler.toml` from `wrangler.example.toml`, with the time zone of your computer.
   Git ignores `wrangler.toml`, so your own values stay local.
3. It opens the browser for the Cloudflare login.
4. It creates the D1 database `reading_log` and applies the schema.
5. It makes a random API token and stores it as the Worker secret `API_TOKEN`.
6. It deploys the Worker to `https://reading-log.<your-subdomain>.workers.dev`.
7. It writes the client config `~/.config/reading-log/env` (URL, token, language). Then it prints
   the dashboard URL and a sign-in link for the phone.

If your Cloudflare account has no `workers.dev` subdomain, the script stops and shows a link. Open
the link, choose a subdomain, and run `npm run setup` again.

CAUTION: The sign-in link and the token give full access to your reading data. Do not share them.

To deploy a code change later, run `npm run deploy`.

### Get the token again

The token is in `~/.config/reading-log/env`. These commands copy it, or the phone sign-in link, to
the clipboard (macOS) without showing it on the screen:

```bash
grep READING_LOG_TOKEN ~/.config/reading-log/env | cut -d= -f2 | tr -d '\n' | pbcopy
```

```bash
. ~/.config/reading-log/env && printf '%s/#t=%s' "$READING_LOG_URL" "$READING_LOG_TOKEN" | pbcopy
```

## 2. Mac: Raycast

1. Open Raycast. Open **Settings → Extensions → Script Commands**.
2. Click **Add Directories**. Select the `raycast` folder of this repository.
3. Raycast shows six commands: **Start Reading**, **Stop Reading**, **Toggle Reading**,
   **Reading Status**, **Reading Stats (7 days)**, and **Reading Dashboard**.
4. Optional: give **Toggle Reading** a hotkey or an alias.

The scripts read `~/.config/reading-log/env`. Set `READING_LOG_LANG=pt` in that file for replies in
Portuguese, or `en` for English.

## 3. Phone: home-screen app

1. Open the sign-in link (`<URL>/#t=<token>`) in the phone browser. The page keeps the token on
   the device and removes it from the address bar.
2. On an iPhone, tap **Share → Add to Home Screen**. On Android, tap **⋮ → Add to Home screen**.

## 4. iPhone: Siri (Shortcuts app)

Make one shortcut for "start" and one for "stop". Each shortcut has two actions.

**Shortcut "Start reading":**

1. Add the action **Get Contents of URL**.
   - URL: `<URL>/api/start`
   - Method: `POST`
   - Headers: `Authorization` = `Bearer <token>`, `Accept` = `text/plain`,
     `Accept-Language` = `en` (or `pt`)
   - Request Body: JSON, key `source` = `siri`
2. Add the action **Speak Text** (or **Show Notification**) with the input **Contents of URL**.

**Shortcut "Stop reading":** do the same steps with `<URL>/api/stop`.

Then say "Hey Siri, start reading". You can also put the shortcuts on the Lock Screen, the Action
Button, Control Center, or the Apple Watch.

Optional shortcuts with the same pattern:

| Name | Method | Path |
|---|---|---|
| Toggle reading | POST | `/api/toggle` |
| Reading status | GET | `/api/status` |
| Reading week | GET | `/api/stats?days=7` |

CAUTION: Use the API URL (`<URL>/api/start`), not the sign-in link. The part after `#` never
reaches the server, so a URL like `<URL>/#t=…/api/start` gets "not found".

CAUTION: Do not share these shortcuts with an iCloud link. An iCloud link is public, and the
shortcut contains your token. If you shared one, change the token (see "Change the token").

## 5. Alexa (private custom skill, free)

The skill stays in "development" status. Only the devices on your Amazon account can use it. You do
not publish it.

1. Go to the [Alexa developer console](https://developer.amazon.com/alexa/console/ask). Sign in
   with the same Amazon account as your Echo.
2. Click **Create Skill**.
   - Name: `Reading Log` (or `Registro de Leitura`).
   - Primary locale: **English (US)** or **Portuguese (BR)**, the same as your Echo.
   - Experience: **Other**. Model: **Custom**. Hosting: **Provision your own**.
   - Template: **Start from scratch**.
3. Open **Interaction Model → JSON Editor**. Paste the contents of
   `alexa/interaction-model.en-US.json` (or `alexa/interaction-model.pt-BR.json`).
   Click **Save**, then **Build skill**.
4. Open **Endpoint**. Select **HTTPS**. Default Region: `<URL>/alexa`. For the certificate type,
   select **"My development endpoint is a sub-domain of a domain that has a wildcard certificate
   from a certificate authority"**. Click **Save**.
5. Copy the **Skill ID** (`amzn1.ask.skill.…`) from the skill list. Run this command and paste the
   id:

   ```bash
   npx wrangler secret put ALEXA_SKILL_ID
   ```

6. Open the **Test** tab. Set "Skill testing is enabled in" to **Development**. Type
   `open reading log` to do a test.

Voice commands:

| English | Portuguese |
|---|---|
| "Alexa, ask reading log to start" | "Alexa, pede para o registro de leitura começar" |
| "Alexa, ask reading log to stop" | "Alexa, pede para o registro de leitura parar" |
| "Alexa, ask reading log how long have I read" | "Alexa, pergunta ao registro de leitura quanto tempo eu li" |
| "Alexa, ask reading log how was my week" | "Alexa, pergunta ao registro de leitura como foi minha semana" |
| "Alexa, open reading log" (then "start" or "stop") | "Alexa, abre o registro de leitura" (then "começar" or "parar") |

Alexa sends the word "stop" ("parar") as its built-in stop command. When a timer runs, the skill
reads that command as "stop the timer".

### Short phrases with an Alexa Routine

To say only "Alexa, I'm reading":

1. In the Alexa app, open **More → Routines → +**.
2. **When this happens → Voice**: `I'm reading`.
3. **Add action → Customized**: `ask reading log to start`.
4. Save. Make a second routine for `I finished reading` with `ask reading log to stop`.

## Configuration

Edit `wrangler.toml` (your local copy) and run `npm run deploy`.

| Variable | Default | Description |
|---|---|---|
| `TIMEZONE` | Time zone of the computer that ran the setup | IANA time zone for the daily totals when a client sends no time zone (Alexa, Siri). |
| `MAX_SESSION_MINUTES` | `180` | The cron job closes a longer session at start + this value. |

Secrets (set with `npx wrangler secret put <NAME>`):

| Secret | Description |
|---|---|
| `API_TOKEN` | Required. The bearer token for the API and the dashboard. |
| `ALEXA_SKILL_ID` | Required for Alexa only. The endpoint refuses requests from other skills. |

### Change the token

1. Run `openssl rand -hex 24` to make a new token.
2. Run `npx wrangler secret put API_TOKEN` and paste the new token.
3. Put the new token in `~/.config/reading-log/env`.
4. Update the `Authorization` header in your Siri shortcuts.
5. Open the new sign-in link on each phone.

## API

All `/api/*` endpoints need the header `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/start` | Start a session. Body (optional): `{"source":"web"}` |
| POST | `/api/stop` | Stop the running session |
| POST | `/api/toggle` | Start or stop |
| GET | `/api/status` | Running state, elapsed time, today's total |
| GET | `/api/stats?days=7` | Totals, averages, streaks, daily series (1 to 366 days) |
| GET | `/api/sessions?limit=50` | Recent sessions |
| POST | `/api/sessions` | Add a session: `{"start_ts":ms,"end_ts":ms}` |
| PATCH | `/api/sessions/:id` | Edit `start_ts` and/or `end_ts` |
| DELETE | `/api/sessions/:id` | Delete a session |
| GET | `/api/export.csv` | All sessions as CSV |
| POST | `/alexa` | Alexa skill endpoint |

Request options:

- `Accept: text/plain` (or `?format=text`): the reply is one line of text. Raycast and Siri use this.
- `Accept-Language: pt` (or `?lang=pt`): the replies are in Portuguese.
- `X-Timezone: Europe/Lisbon` (or `?tz=`): the time zone for the daily totals.
- Valid `source` values: `web`, `raycast`, `siri`, `shortcut`, `alexa`, `cli`, `manual`.

Example:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Accept: text/plain" "$URL/api/start"
```

## Development

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` makes `wrangler.toml` and `.dev.vars` if they are missing, then starts the Worker at
http://localhost:8787 with a local database. You do not need a Cloudflare login for this. The local
token is `dev-token`. Open http://localhost:8787/#t=dev-token.

In a second terminal:

```bash
npm run smoke
```

```bash
npm test
```

- `npm run smoke` does 30 end-to-end checks against the local Worker: the API, text replies, both
  languages, manual sessions, CSV, and Alexa.
- `npm test` runs the unit tests for the time logic (time zones, midnight, DST, streaks).
- `npm run typecheck` checks the TypeScript types.

CAUTION: The smoke checks add and delete sessions. Do not run them against a deploy that has real
data.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| The setup stops with "register a workers.dev subdomain" | Your account has no subdomain. Open the link that the script shows, choose a name, and run the setup again. |
| `SSL handshake failure` just after the first deploy | Cloudflare has not made the certificate for a new subdomain yet. Wait some minutes. |
| `401 unauthorized` | The token is wrong or old. Compare it with `~/.config/reading-log/env`. |
| A Siri shortcut gets `{"error":"not found"}` | The URL is not correct. Use `<URL>/api/start`, not the sign-in link. |
| Alexa says "Okay" and does nothing | Do a test in the **Test** tab of the developer console. Make sure that `ALEXA_SKILL_ID` is the id of your skill. |
| The daily totals use the wrong day | Set `TIMEZONE` in `wrangler.toml`, then run `npm run deploy`. |

## Security

- The API uses one bearer token. The token is a Worker secret, and the server compares it in
  constant time.
- The dashboard page contains no data. Each device keeps the token in the browser `localStorage`.
- The sign-in link puts the token in the URL fragment (`#t=`). Browsers do not send the fragment
  to the server.
- The Alexa endpoint accepts only requests with your skill id and a timestamp that is less than
  150 seconds old. It does not verify the Amazon request signature. Amazon requires that check only
  for published skills. Do not publish the skill without adding it.

## Project files

| Path | Content |
|---|---|
| `src/index.ts` | Router, API, cron job |
| `src/store.ts` | D1 queries |
| `src/stats.ts` | Time zones, daily totals, averages, streaks |
| `src/alexa.ts` | Alexa skill handler (pt-BR and en-US) |
| `src/dashboard.ts` | Dashboard HTML, web app manifest, icon |
| `src/icon.ts` | Home-screen icon (made by `npm run make-icon`) |
| `migrations/` | D1 schema |
| `raycast/` | Raycast script commands |
| `alexa/` | Alexa interaction models |
| `wrangler.example.toml` | Template for your `wrangler.toml` |
| `scripts/setup.sh` | Deploy and client config |
| `scripts/smoke.sh` | End-to-end checks |

## License

[MIT](LICENSE)
