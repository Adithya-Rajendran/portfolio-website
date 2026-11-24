#!/bin/bash
# Pixel difference of two tools/detsnap.sh sets: max / mean (0-255, worst channel) and share of pixels off by > 2 and > 8.
#   [SNAP=/dir] tools/pdiff.sh <nameA> <nameB>   (heat maps into $SNAP/<nameB>/heat)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAP="${SNAP:-/tmp/detsnap}"
A="${1:?usage: tools/pdiff.sh <nameA> <nameB>}"
B="${2:?usage: tools/pdiff.sh <nameA> <nameB>}"
mkdir -p "$SNAP/$B/heat"

docker run --rm --ipc=host \
  -v "$ROOT/tools/docker":/work:ro \
  -v "$SNAP":/snap \
  -v lobby_pw_modules:/w:ro \
  mcr.microsoft.com/playwright:v1.64.1-noble bash -c '
    set -e
    X=$(mktemp -d)
    trap "rm -rf \"$X\"" EXIT
    cp /work/*.mjs "$X"/
    if [ -d /w/node_modules/playwright ]; then
      ln -s /w/node_modules "$X/node_modules"
    else
      npm --prefix "$X" i --silent --no-save playwright@1.64.1 >/dev/null 2>&1
    fi
    cd "$X"
    set +e
    node pdiff.mjs "/snap/$1" "/snap/$2" "/snap/$2/heat"
  ' _ "$A" "$B" 2>&1 | grep -v "GL Driver"
exit ${PIPESTATUS[0]}
