#!/bin/bash
# Regression snapshots on the Intel GPU.   [ORIGIN=http://host:port] [OUT=/dir] tools/dsnap.sh <prefix> name=url [...]   -> $OUT/<prefix>_<name>.png (+ screen canvases)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
P="${1:?usage: tools/dsnap.sh <prefix> name=url [...]}"; shift
OUT="${OUT:-/tmp/snap}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
printf '%s\n' "$@" > "$OUT/$P.jobs"

resolve_assets() {
  if [ -n "${ASSETS:-}" ]; then
    [ -d "$ASSETS" ] || { echo "dsnap.sh: ASSETS directory does not exist: $ASSETS" >&2; exit 1; }
    [ -n "$(ls -A "$ASSETS" 2>/dev/null)" ] || { echo "dsnap.sh: ASSETS directory is empty: $ASSETS" >&2; exit 1; }
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
  echo "dsnap.sh: missing packed assets; run python3 tools/pack.py or set ASSETS=/path/to/public/assets" >&2
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
  if [ ! -e "$ROOT/public/assets" ] && [ ! -L "$ROOT/public/assets" ]; then
    mkdir -p "$ROOT/public/assets"
  fi
  SITE_MOUNTS=(-v "$ROOT/public":/site:ro)
  if [ "$ASSETS" != "$ROOT/public/assets" ]; then
    SITE_MOUNTS+=(-v "$ASSETS":/site/assets:ro)
  fi
fi

docker run --rm --ipc=host "${DEV[@]}" \
  -e ORIGIN="$TARGET_ORIGIN" \
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
    serve="$1"; p="$2"
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
    node snap.mjs "$p"
  ' _ "$SERVE" "$P" 2>&1 | grep -v "GL Driver"
exit ${PIPESTATUS[0]}
