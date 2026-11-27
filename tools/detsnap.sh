#!/bin/bash
# Deterministic 1920x1080 snapshots of a fixed list of states
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:?usage: tools/detsnap.sh <name> [frames]}"
O="${OUT:-/tmp/detsnap/$NAME}"
mkdir -p "$O"
O="$(cd "$O" && pwd)"

resolve_assets() {
  if [ -n "${ASSETS:-}" ]; then
    [ -d "$ASSETS" ] || { echo "detsnap.sh: ASSETS directory does not exist: $ASSETS" >&2; exit 1; }
    [ -n "$(ls -A "$ASSETS" 2>/dev/null)" ] || { echo "detsnap.sh: ASSETS directory is empty: $ASSETS" >&2; exit 1; }
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
  echo "detsnap.sh: missing packed assets; run python3 tools/pack.py or set ASSETS=/path/to/public/assets" >&2
  exit 1
}

J=()
rp() { case "$1" in lobby) echo /;; about) echo /about/;; projects) echo /portfolio/;; experience) echo /experience/;; writing) echo /blog/;; comms) echo /contact/;; esac; }
for r in lobby about; do
  for a in 0 45 90 180 300; do J+=("$r-hero-r$a=$(rp $r)?shot=hero&scale=1&tier=0&chand=30&rollat=$a"); done
  J+=("$r-close-r90=$(rp $r)?shot=close&scale=1&tier=0&chand=30&rollat=90" "$r-hero-r45-t1=$(rp $r)?shot=hero&scale=1&tier=1&chand=30&rollat=45")
  J+=("$r-hero-roll=$(rp $r)?shot=hero&scale=1&tier=0" "$r-hero-roll6=$(rp $r)?shot=hero&scale=1&tier=0&roll=6")
  J+=("$r-focus0=$(rp $r)?shot=hero&scale=1&tier=0&chand=30&rollat=45&focus=0" "$r-focus1=$(rp $r)?shot=hero&scale=1&tier=0&chand=30&rollat=45&focus=1")
done
J+=("projects-hero=/portfolio/?shot=hero&scale=1&tier=0" "experience-hero=/experience/?shot=hero&scale=1&tier=0")
if [ -n "${ONLY:-}" ]; then
  mapfile -t J < <(printf '%s\n' "${J[@]}" | grep -E "$ONLY")
fi
[ ${#J[@]} -gt 0 ] || { echo "detsnap.sh: ONLY='$ONLY' matched no states" >&2; exit 1; }

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
  -v "$O":/out \
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
    node detsnap.mjs "$@"
  ' _ "$SERVE" "$TARGET_ORIGIN" /out "${2:-150}" "${J[@]}" 2>&1 | grep -v "GL Driver"
exit ${PIPESTATUS[0]}
