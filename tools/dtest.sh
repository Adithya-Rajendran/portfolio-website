#!/bin/bash
# Run a Playwright script against THIS checkout, with no port opened on the host: the site is served inside the container.
#   tools/dtest.sh <script.mjs in tools/docker> [args...]      env: OUT (default /tmp/dtest), ASSETS, ORIGIN
# The script gets ORIGIN (http://127.0.0.1:8080 when serving locally) and writes files to /out.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${OUT:-/tmp/dtest}"
S="${1:?usage: tools/dtest.sh <script.mjs> [args...]}"; shift
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

resolve_assets() {
  if [ -n "${ASSETS:-}" ]; then
    [ -d "$ASSETS" ] || { echo "dtest.sh: ASSETS directory does not exist: $ASSETS" >&2; exit 1; }
    [ -n "$(ls -A "$ASSETS" 2>/dev/null)" ] || { echo "dtest.sh: ASSETS directory is empty: $ASSETS" >&2; exit 1; }
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
  echo "dtest.sh: missing packed assets; run python3 tools/pack.py or set ASSETS=/path/to/public/assets" >&2
  exit 1
}

DEV=()
[ -d /dev/dri ] && DEV=(--device /dev/dri)
# tools/check.sh sets CHECK_RUN: its containers carry it as a label, so an interrupted suite can remove them (docker rm -f by label).
LABEL=()
[ -n "${CHECK_RUN:-}" ] && LABEL=(--label "arcadia.check=$CHECK_RUN")

SITE_MOUNTS=()
SERVE=0
if [ -n "${ORIGIN:-}" ]; then
  TARGET_ORIGIN="${ORIGIN%/}"
else
  resolve_assets
  SERVE=1
  TARGET_ORIGIN="http://127.0.0.1:8080"
  if [ ! -e "$ROOT/public/assets" ] && [ ! -L "$ROOT/public/assets" ]; then
    mkdir -p "$ROOT/public/assets"
  fi
  SITE_MOUNTS=(-v "$ROOT/public":/site:ro)
  if [ "$ASSETS" != "$ROOT/public/assets" ]; then
    SITE_MOUNTS+=(-v "$ASSETS":/site/assets:ro)
  fi
fi

docker run --rm --ipc=host "${LABEL[@]}" "${DEV[@]}" \
  -e ORIGIN="$TARGET_ORIGIN" -e SETUP -e UNTIL \
  -v "$ROOT/tools/docker":/work:ro \
  "${SITE_MOUNTS[@]}" \
  -v "$OUT":/out \
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
    serve="$1"; s="$2"; shift 2
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
    node "$s" "$@"
  ' _ "$SERVE" "$S" "$@" 2>&1 | grep -v "GL Driver"
exit ${PIPESTATUS[0]}
