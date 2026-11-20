#!/bin/bash
# Frame-time benchmark on the host's Intel GPU.   [ORIGIN=http://host:port] tools/dperf.sh [query] [w] [h] [seconds] [dpr]
D="$(cd "$(dirname "$0")/docker" && pwd)"
docker run --rm --ipc=host --device /dev/dri -v "$D":/work:ro -v lobby_pw_modules:/w mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
 "cd /w && cp /work/*.mjs . && node perf.mjs '${ORIGIN:-http://10.0.0.117:8080}/$1' ${2:-1920} ${3:-1080} ${4:-8} ${5:-1}" 2>&1 | grep -v "GL Driver"
