#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Reading Status
# @raycast.mode compact
# @raycast.packageName Reading Log

# Optional parameters:
# @raycast.icon ⏱️
# @raycast.description Show the running timer and today's total

. "$(dirname "$0")/_lib.sh"
curl -sS --max-time 15 "${READING_LOG_URL%/}/api/status" -H "Authorization: Bearer $READING_LOG_TOKEN" -H "Accept: text/plain" -H "Accept-Language: ${READING_LOG_LANG:-en}" -H "X-Timezone: $(readlink /etc/localtime | sed 's#.*/zoneinfo/##')"
