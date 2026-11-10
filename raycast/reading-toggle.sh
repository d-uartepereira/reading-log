#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Toggle Reading
# @raycast.mode compact
# @raycast.packageName Reading Log

# Optional parameters:
# @raycast.icon ⏯️
# @raycast.description Start or stop the reading timer

. "$(dirname "$0")/_lib.sh"
rl_call POST /api/toggle
