#!/usr/bin/env bash
# One-time setup: deploys the Worker to your Cloudflare account and writes the client config
# (~/.config/reading-log/env) that the Raycast scripts use.
# You can run it again at any time. It keeps the existing database and token.
# Works on macOS and Linux. Needs Node.js 20+, npm, curl and openssl.
set -euo pipefail
cd "$(dirname "$0")/.."
W="npx wrangler"
CONF_DIR="${READING_LOG_CONFIG_DIR:-$HOME/.config/reading-log}"
CONF="$CONF_DIR/env"

node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' \
  || { echo "Node.js 20 or newer is necessary. Found: $(node -v)"; exit 1; }

echo "==> 1/7 Install dependencies"
[ -d node_modules ] || npm install

echo "==> 2/7 Local config"
node scripts/init-config.mjs

echo "==> 3/7 Cloudflare login"
$W whoami >/dev/null 2>&1 || $W login

echo "==> 4/7 D1 database"
if grep -q '00000000-0000-0000-0000-000000000000' wrangler.toml; then
  ID=$($W d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const x=JSON.parse(s).find(d=>d.name==="reading_log");console.log(x?x.uuid:"")}catch{console.log("")}})')
  if [ -z "$ID" ]; then
    ID=$($W d1 create reading_log 2>&1 | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  fi
  [ -n "$ID" ] || { echo "Could not create or find the D1 database."; exit 1; }
  node scripts/init-config.mjs --set-db "$ID"
  echo "    database_id = $ID"
fi
$W d1 migrations apply reading_log --remote

echo "==> 5/7 API token"
mkdir -p "$CONF_DIR"; chmod 700 "$CONF_DIR"
TOKEN=""
if [ -f "$CONF" ]; then . "$CONF"; TOKEN="${READING_LOG_TOKEN:-}"; fi
if [ -z "$TOKEN" ]; then
  TOKEN=$(openssl rand -hex 24)
fi

echo "==> 6/7 Deploy"
OUT=$($W deploy 2>&1 | tee /dev/stderr) || {
  if echo "$OUT" | grep -q "workers.dev subdomain"; then
    LINK=$(echo "$OUT" | grep -oE 'https://dash\.cloudflare\.com/[^ ]*/workers/onboarding' | head -1)
    cat <<MSG

ACTION NEEDED: this Cloudflare account has no workers.dev subdomain.
  1. Open ${LINK:-https://dash.cloudflare.com/?to=/:account/workers/onboarding}
  2. Choose a subdomain name and confirm it.
  3. Run 'npm run setup' again. The database step is already done.
MSG
  fi
  exit 1
}
URL=$(echo "$OUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)
[ -n "$URL" ] || { echo "Could not read the Worker URL from the deploy output."; exit 1; }
printf '%s' "$TOKEN" | $W secret put API_TOKEN >/dev/null

if [ "$(uname)" = "Darwin" ]; then
  LANG_GUESS=$(defaults read -g AppleLanguages 2>/dev/null | grep -qi '"pt' && echo pt || echo en)
else
  case "${LANG:-en}" in pt*) LANG_GUESS=pt ;; *) LANG_GUESS=en ;; esac
fi
cat > "$CONF" <<CONF
READING_LOG_URL=$URL
READING_LOG_TOKEN=$TOKEN
READING_LOG_LANG=$LANG_GUESS
CONF
chmod 600 "$CONF"

echo "==> 7/7 Check"
# A new workers.dev subdomain can need some minutes before its TLS certificate is ready.
OK=""
for _ in $(seq 1 12); do
  if curl -fsS --max-time 10 -H "Authorization: Bearer $TOKEN" -H "Accept: text/plain" "$URL/api/status" 2>/dev/null; then OK=1; break; fi
  sleep 10
done
[ -n "$OK" ] || echo "    The Worker does not respond yet. If the subdomain is new, wait some minutes and open $URL."

cat <<DONE

Done.
  Dashboard : $URL
  Config    : $CONF (the Raycast scripts read this file)

  Sign-in link for the phone (keep it private, it contains your token):
  $URL/#t=$TOKEN

Next steps: see README.md, sections 2 to 5.
DONE
