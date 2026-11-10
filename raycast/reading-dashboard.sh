#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Reading Dashboard
# @raycast.mode silent
# @raycast.packageName Reading Log

# Optional parameters:
# @raycast.icon 📚
# @raycast.description Open the reading dashboard in the browser

. "$(dirname "$0")/_lib.sh"
open "${READING_LOG_URL%/}/"
