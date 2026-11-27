#!/bin/bash
# Frame time, GPU time, draw calls, GPU memory and requests on the GPU browser
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

resolve_assets() {
  if [ -n "${ASSETS:-}" ]; then
    [ -d "$ASSETS" ] || { echo "dbench.sh: ASSETS directory does not exist: $ASSETS" >&2; exit 1; }
    [ -n "$(ls -A "$ASSETS" 2>/dev/null)" ] || { echo "dbench.sh: ASSETS directory is empty: $ASSETS" >&2; exit 1; }
    ASSETS="$(cd "$ASSETS" && pwd)"
    return 0
  fi
  if [ -d "$ROOT/public/assets" ] && [ ! -L "$ROOT/public/assets" ] && [ -n "$(ls -A "$ROOT/public/assets" 2>/dev/null)" ]; then
    ASSETS="$ROOT/public/assets"
    return 0
  fi
  local common main_assets
  if common="$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null)"; then
    main_assets="$(cd "$ROOT" && cd "$common/.." && pwd)/public/assets"
    if [ -d "$main_assets" ] && [ ! -L "$main_assets" ] && [ -n "$(ls -A "$main_assets" 2>/dev/null)" ]; then
      ASSETS="$main_assets"
      return 0
    fi
  fi
  echo "dbench.sh: missing packed assets; run python3 tools/pack.py or set ASSETS=/path/to/public/assets" >&2
  exit 1
}

DEV=()
[ -d /dev/dri ] && DEV=(--device /dev/dri)

SITE_MOUNTS=()
SERVE=0
if [ -n "${ORIGIN:-}" ]; then
  TARGET_ORIGIN="${ORIGIN%/}"
else
  resolve_assets
  SERVE=1
  TARGET_ORIGIN="http://127.0.0.1:8080"
  [ -f "$ROOT/dist/index.html" ] || { echo "dbench.sh: no built site in dist/; run pnpm build" >&2; exit 1; }
  if [ ! -e "$ROOT/dist/assets" ] && [ ! -L "$ROOT/dist/assets" ]; then
    mkdir -p "$ROOT/dist/assets"
  fi
  SITE_MOUNTS=(-v "$ROOT/dist":/site:ro)
  if [ "$ASSETS" != "$ROOT/public/assets" ]; then
    SITE_MOUNTS+=(-v "$ASSETS":/site/assets:ro)
  fi
fi

Q="${1:-}"; Q="${Q#/}"

docker run --rm --ipc=host "${DEV[@]}" \
  -e ORIGIN="$TARGET_ORIGIN" \
  -v "$ROOT/tools/docker":/work:ro \
  "${SITE_MOUNTS[@]}" \
  -v lobby_pw_modules:/w:ro \
  mcr.microsoft.com/playwright:v1.64.1-noble bash -c '
    set -e
    X=$(mktemp -d)
    SERVE_PID=""
    cleanup() { [ -n "$SERVE_PID" ] && kill "$SERVE_PID" 2>/dev/null || true; rm -rf "$X"; }
    trap cleanup EXIT
    cp /work/*.mjs "$X"/
    if [ -d /w/node_modules/playwright ]; then
      ln -s /w/node_modules "$X/node_modules"
    else
      npm --prefix "$X" i --silent --no-save playwright@1.64.1 >/dev/null 2>&1
    fi
    cd "$X"
    serve="$1"; shift
    if [ "$serve" = "1" ]; then
      node serve.mjs /site 8080 2>/dev/null &
      SERVE_PID=$!
      for _ in $(seq 1 100); do
        if (echo >/dev/tcp/127.0.0.1/8080) 2>/dev/null; then break; fi
        kill -0 "$SERVE_PID" 2>/dev/null || { echo "serve.mjs exited early" >&2; exit 1; }
        sleep 0.05
      done
      (echo >/dev/tcp/127.0.0.1/8080) 2>/dev/null || { echo "serve.mjs not ready" >&2; exit 1; }
    fi
    set +e
    node bench.mjs "$@"
  ' _ "$SERVE" "$TARGET_ORIGIN/$Q" 1920 1080 "${3:-8}" "${2:-3}" 2>&1 | grep -v "GL Driver" | python3 -c "
import json, sys, statistics as st
rs = []
for l in sys.stdin:
    if l.startswith('{'):
        rs.append(json.loads(l))
    else:
        print(l, end='', file=sys.stderr)
if not rs:
    sys.exit(1)
f = lambda k: [r[k] for r in rs]; s = lambda a: ' '.join('%.1f' % x for x in a)
print('frame %.1f ms [%s]  p95 %.1f [%s]  GPU %.2f ms [%s]  calls %d  tris %d  textures %d  WebGL memory %.0f MB  %d requests %d KB  formats %s' % (
  st.median(f('med')), s(f('med')), st.median(f('p95')), s(f('p95')), st.median(f('gpu')), s(f('gpu')), rs[0]['calls'], rs[0]['tris'], rs[0]['tex'], rs[0]['mem']['mb'], rs[0]['full']['requests'], rs[0]['full']['kb'], rs[0]['mem'].get('formats', '')))"
ps=("${PIPESTATUS[@]}")
rc=${ps[0]}; py=${ps[2]}
[ "$rc" -ne 0 ] && exit "$rc"
exit "$py"
