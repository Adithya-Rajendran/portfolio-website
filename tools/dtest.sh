#!/bin/bash
# Run a Playwright script against THIS checkout, with no port opened on the host: the site is served inside the container.
#   tools/dtest.sh <script.mjs in tools/docker> [args...]      env: OUT (host folder for screenshots, default /tmp/dtest)
# The script gets ORIGIN=http://127.0.0.1:8080 and writes files to /out. The baked rooms (public/assets, generated and
# not in git) come from ASSETS, by default the main checkout's, so a git worktree can be tested without packing them.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="${OUT:-/tmp/dtest}"; ASSETS="${ASSETS:-/home/ubuntu/Projects/Website/public/assets}"
S="$1"; shift; mkdir -p "$OUT" "$ROOT/public/assets"
docker run --rm --ipc=host --device /dev/dri -e ORIGIN=http://127.0.0.1:8080 -v "$ROOT/tools/docker":/work:ro -v "$ROOT/public":/site:ro -v "$ASSETS":/site/assets:ro \
  -v "$OUT":/out -v lobby_pw_modules:/w mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
  "cd /w && { [ -d node_modules/playwright ] || npm i --silent playwright@1.64.1 >/dev/null 2>&1; } && cp /work/*.mjs . && (node serve.mjs /site 8080 2>/dev/null &) && sleep 0.5 && node $S $(printf "'%s' " "$@")" 2>&1 | grep -v "GL Driver"
exit ${PIPESTATUS[0]}
