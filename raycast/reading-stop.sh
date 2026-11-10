#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Stop Reading
# @raycast.mode compact
# @raycast.packageName Reading Log

# Optional parameters:
# @raycast.icon ⏹️
# @raycast.description Stop the reading timer and save the session

. "$(dirname "$0")/_lib.sh"
rl_call POST /api/stop
