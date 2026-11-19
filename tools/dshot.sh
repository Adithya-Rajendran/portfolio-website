#!/bin/bash
# Screenshot the site from a browser inside the Playwright Docker image (Chromium uses the host's Intel GPU).
#   tools/dshot.sh <name> [engine] [w] [h] [mouseX] [mouseY] [hud] [query]   -> /tmp/dshot/<name>.png
D="$(cd "$(dirname "$0")/docker" && pwd)"; mkdir -p /tmp/dshot
docker run --rm --ipc=host --device /dev/dri -e SOFT="$SOFT" -v "$D":/work:ro -v /tmp/dshot:/out -v lobby_pw_modules:/w mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
 "cd /w && { [ -d node_modules/playwright ] || npm i --silent playwright@1.64.1 >/dev/null 2>&1; } && cp /work/*.mjs . && node shot.mjs 'http://10.0.0.117:8080/$8' /out/$1.png ${2:-chromium} ${3:-1600} ${4:-900} '$5' '$6' ${7:-1}" 2>&1 | grep -v "GL Driver"
