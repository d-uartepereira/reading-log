#!/bin/bash
# Shared helper for the Raycast script commands. Not a command itself.
CONFIG="${READING_LOG_CONFIG:-$HOME/.config/reading-log/env}"
if [ -f "$CONFIG" ]; then . "$CONFIG"; fi
if [ -z "$READING_LOG_URL" ] || [ -z "$READING_LOG_TOKEN" ]; then
  echo "Missing config. Run scripts/setup.sh or create $CONFIG"
  exit 1
fi
rl_call() { # method path
  curl -sS --max-time 15 -X "$1" "${READING_LOG_URL%/}$2" \
    -H "Authorization: Bearer $READING_LOG_TOKEN" \
    -H "Accept: text/plain" \
    -H "Accept-Language: ${READING_LOG_LANG:-en}" \
    -H "X-Timezone: $(readlink /etc/localtime | sed 's#.*/zoneinfo/##')" \
    -H "Content-Type: application/json" \
    -d '{"source":"raycast"}' 2>&1
}
