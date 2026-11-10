#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Start Reading
# @raycast.mode compact
# @raycast.packageName Reading Log

# Optional parameters:
# @raycast.icon 📖
# @raycast.description Start the reading timer

. "$(dirname "$0")/_lib.sh"
rl_call POST /api/start
