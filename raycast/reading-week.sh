#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Reading Stats (7 days)
# @raycast.mode fullOutput
# @raycast.packageName Reading Log

# Optional parameters:
# @raycast.icon 📊
# @raycast.description Show the reading summary for the last 7 days

. "$(dirname "$0")/_lib.sh"
curl -sS --max-time 15 "${READING_LOG_URL%/}/api/stats?days=7" -H "Authorization: Bearer $READING_LOG_TOKEN" -H "Accept: text/plain" -H "Accept-Language: ${READING_LOG_LANG:-en}" -H "X-Timezone: $(readlink /etc/localtime | sed 's#.*/zoneinfo/##')"
