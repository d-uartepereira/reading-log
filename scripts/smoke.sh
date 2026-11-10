#!/usr/bin/env bash
# End-to-end check against a running Worker. Default target: `npm run dev` on port 8787.
set -euo pipefail
URL="${1:-http://localhost:8787}"
TOKEN="${2:-dev-token}"
SKILL="${3:-amzn1.ask.skill.dev}"
pass=0; fail=0
check() { if echo "$2" | grep -q "$3"; then echo "  ok   $1"; pass=$((pass+1)); else echo "  FAIL $1 -> $2"; fail=$((fail+1)); fi; }
A=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

check "dashboard html"     "$(curl -s "$URL/")" "<title>Reading Log</title>"
check "png icon"           "$(curl -s -o /dev/null -w '%{content_type}' "$URL/apple-touch-icon.png")" "image/png"
check "no token -> 401"    "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/api/start")" "401"
check "bad token -> 401"   "$(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer nope' "$URL/api/status")" "401"
curl -s -X POST "${A[@]}" "$URL/api/stop" >/dev/null
check "start"              "$(curl -s -X POST "${A[@]}" -d '{"source":"cli"}' "$URL/api/start")" '"alreadyRunning":false'
check "start again"        "$(curl -s -X POST "${A[@]}" "$URL/api/start")" '"alreadyRunning":true'
check "status running"     "$(curl -s "${A[@]}" "$URL/api/status")" '"running":true'
check "status text"        "$(curl -s "${A[@]}" -H 'Accept: text/plain' "$URL/api/status")" "Reading now"
check "status text pt"     "$(curl -s "${A[@]}" -H 'Accept: text/plain' -H 'Accept-Language: pt-BR' "$URL/api/status")" "Lendo"
check "stop"               "$(curl -s -X POST "${A[@]}" "$URL/api/stop")" '"running":false'
check "stop again"         "$(curl -s -X POST "${A[@]}" -H 'Accept: text/plain' "$URL/api/stop")" "does not run"
check "toggle on"          "$(curl -s -X POST "${A[@]}" "$URL/api/toggle")" '"running":true'
check "toggle off"         "$(curl -s -X POST "${A[@]}" "$URL/api/toggle")" '"running":false'
NOW=$(($(date +%s)*1000)); S=$((NOW-3600000)); E=$((NOW-1800000))
ADD=$(curl -s -X POST "${A[@]}" -d "{\"start_ts\":$S,\"end_ts\":$E}" "$URL/api/sessions")
check "manual add"         "$ADD" '"source":"manual"'
check "bad manual add"     "$(curl -s -o /dev/null -w '%{http_code}' -X POST "${A[@]}" -d "{\"start_ts\":$E,\"end_ts\":$S}" "$URL/api/sessions")" "400"
ID=$(echo "$ADD" | grep -oE '"id":[0-9]+' | head -1 | cut -d: -f2)
check "edit"               "$(curl -s -X PATCH "${A[@]}" -d "{\"end_ts\":$((S+600000))}" "$URL/api/sessions/$ID")" "\"end_ts\":$((S+600000))"
check "stats"              "$(curl -s "${A[@]}" "$URL/api/stats?days=7&tz=America/Sao_Paulo")" '"readingDays"'
check "stats text"         "$(curl -s "${A[@]}" -H 'Accept: text/plain' "$URL/api/stats?days=7")" "Last 7 days"
check "csv"                "$(curl -s "${A[@]}" "$URL/api/export.csv")" "id,start_iso"
check "delete"             "$(curl -s -X DELETE "${A[@]}" "$URL/api/sessions/$ID")" "Deleted"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
alexa() { # intent-or-launch locale [appId]
  local req
  if [ "$1" = "launch" ]; then req='{"type":"LaunchRequest"'; else req="{\"type\":\"IntentRequest\",\"intent\":{\"name\":\"$1\"}"; fi
  curl -s -X POST -H 'Content-Type: application/json' "$URL/alexa" -d "{\"version\":\"1.0\",\"session\":{\"new\":true,\"attributes\":{}},\"context\":{\"System\":{\"application\":{\"applicationId\":\"${3:-$SKILL}\"}}},\"request\":$req,\"locale\":\"$2\",\"timestamp\":\"$(ts)\"}}"
}
check "alexa wrong skill"  "$(alexa StartReadingIntent pt-BR amzn1.ask.skill.other)" "forbidden"
check "alexa start pt"     "$(alexa StartReadingIntent pt-BR)" "Comecei a contar"
check "alexa launch run"   "$(alexa launch en-US)" "The timer runs"
check "alexa status"       "$(alexa StatusIntent en-US)" "in this session"
check "alexa stop pt"      "$(alexa StopReadingIntent pt-BR)" "Você leu por"
check "alexa start again"  "$(alexa StartReadingIntent pt-BR)" "Comecei a contar"
check "alexa built-in stop" "$(alexa AMAZON.StopIntent pt-BR)" "Você leu por"
check "alexa stop idle"    "$(alexa AMAZON.StopIntent pt-BR)" "não está rodando"
check "alexa week"         "$(alexa WeeklySummaryIntent pt-BR)" "Nos últimos 7 dias"
check "alexa help"         "$(alexa AMAZON.HelpIntent en-US)" "start reading"

echo; echo "passed: $pass, failed: $fail"; [ "$fail" -eq 0 ]
