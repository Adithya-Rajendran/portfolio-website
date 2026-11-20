#!/bin/bash
# Frame time (median / p95 of rAF intervals, each frame waited for with readPixels), GPU time of the whole frame
# (timer query), draw calls, GPU memory allocated through WebGL, requests/bytes once loading is complete.
#   [ORIGIN=http://host:port] tools/dbench.sh "<query>" [runs] [seconds]   -> one summary line (all runs in a fresh context)
D="$(cd "$(dirname "$0")/docker" && pwd)"
docker run --rm --ipc=host --device /dev/dri -v "$D":/work:ro -v lobby_pw_modules:/w mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
 "cd /w && cp /work/*.mjs . && node bench.mjs '${ORIGIN:-http://10.0.0.117:8080}/$1' 1920 1080 ${3:-8} ${2:-3}" 2>&1 | grep -v "GL Driver" | python3 -c "
import json, sys, statistics as st
rs = [json.loads(l) for l in sys.stdin if l.startswith('{')]
f = lambda k: [r[k] for r in rs]; s = lambda a: ' '.join('%.1f' % x for x in a)
print('frame %.1f ms [%s]  p95 %.1f [%s]  GPU %.2f ms [%s]  calls %d  tris %d  textures %d  WebGL memory %.0f MB  %d requests %d KB  formats %s' % (
  st.median(f('med')), s(f('med')), st.median(f('p95')), s(f('p95')), st.median(f('gpu')), s(f('gpu')), rs[0]['calls'], rs[0]['tris'], rs[0]['tex'], rs[0]['mem']['mb'], rs[0]['full']['requests'], rs[0]['full']['kb'], rs[0]['mem'].get('formats', '')))"
