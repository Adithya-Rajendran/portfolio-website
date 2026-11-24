#!/bin/bash
# Run one CI check tier on this checkout, either under /srv/arcadia/bin/ci (CI_JOB + CI_HOME) or standalone locally.
#   tools/ci/run.sh <tier> [args...]
# Tiers: static | smoke | script <name.mjs> [args...] | suite | bench "<query>" [runs] [seconds] | snap <name> <state=query>... | pdiff <dirA> <dirB>
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${OUT:-${CI_JOB:+$CI_JOB/out}}"
OUT="${OUT:-/tmp/arcadia-ci-out}"
IMG="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.64.1-noble}"

asset_key() {
  ( cd "$ROOT" && find assets-src tools/pack.py -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -c1-20 )
}

assets() {
  if [ -n "${ASSETS:-}" ]; then
    [ -d "$ASSETS" ] || { echo "ci: ASSETS directory does not exist: $ASSETS" >&2; exit 3; }
    if [ -L "$ROOT/public/assets" ]; then rm -f "$ROOT/public/assets"; fi
    mkdir -p "$ROOT/public/assets"
    export ASSETS
    return 0
  fi

  if [ -n "${CI_HOME:-}" ]; then
    local key log_dir
    key="$(asset_key)"
    ASSETS="$CI_HOME/cache/assets/$key"
    log_dir="${CI_JOB:-$OUT}"
    mkdir -p "$CI_HOME/cache/assets" "$log_dir"
    (
      flock 9
      if [ ! -d "$ASSETS" ]; then
        echo "ci: packing rooms ($key)"
        rm -rf "$ROOT/public/assets"
        if ( cd "$ROOT" && python3 tools/pack.py ) > "$log_dir/pack.log" 2>&1; then
          local tmp_assets="$CI_HOME/cache/assets/.tmp-$key-$$"
          rm -rf "$tmp_assets"
          mv "$ROOT/public/assets" "$tmp_assets"
          mv "$tmp_assets" "$ASSETS"
        else
          echo "ci: pack failed, see $log_dir/pack.log" >&2
          tail -20 "$log_dir/pack.log" >&2 || true
          rm -rf "$ROOT/public/assets"
          exit 3
        fi
      fi
    ) 9>"$CI_HOME/cache/pack.lock" || exit 3
    if [ -L "$ROOT/public/assets" ]; then rm -f "$ROOT/public/assets"; fi
    mkdir -p "$ROOT/public/assets"
    export ASSETS
    return 0
  fi

  # Standalone local run without CI_HOME or ASSETS
  if [ -d "$ROOT/public/assets" ] && [ ! -L "$ROOT/public/assets" ] && [ -n "$(ls -A "$ROOT/public/assets" 2>/dev/null)" ]; then
    ASSETS="$ROOT/public/assets"
  elif git -C "$ROOT" rev-parse --git-common-dir >/dev/null 2>&1; then
    local common main_assets
    common="$(git -C "$ROOT" rev-parse --git-common-dir)"
    main_assets="$(cd "$ROOT" && cd "$common/.." && pwd)/public/assets"
    if [ -d "$main_assets" ] && [ ! -L "$main_assets" ] && [ -n "$(ls -A "$main_assets" 2>/dev/null)" ]; then
      ASSETS="$main_assets"
    fi
  fi

  if [ -z "${ASSETS:-}" ]; then
    mkdir -p "$OUT"
    echo "ci: packing rooms locally"
    rm -rf "$ROOT/public/assets"
    if ! ( cd "$ROOT" && python3 tools/pack.py ) > "$OUT/pack.log" 2>&1; then
      echo "ci: pack failed, see $OUT/pack.log" >&2
      tail -20 "$OUT/pack.log" >&2 || true
      exit 3
    fi
    ASSETS="$ROOT/public/assets"
  fi

  if [ -L "$ROOT/public/assets" ]; then rm -f "$ROOT/public/assets"; fi
  mkdir -p "$ROOT/public/assets"
  export ASSETS
}

site() {
  local log_dir="${CI_JOB:-$OUT}"
  mkdir -p "$log_dir"
  if ! ( cd "$ROOT" && python3 tools/site.py ) > "$log_dir/site.log" 2>&1; then
    echo "ci: site.py failed" >&2
    tail -10 "$log_dir/site.log" >&2 || true
    return 1
  fi
}

gpu() {
  # /srv/arcadia/bin/ci already holds quiet.lock on fd 8; only take gpu.lock here.
  if [ -n "${CI_HOME:-}" ]; then
    ( flock 7; "$@" 7>&- ) 7>"$CI_HOME/gpu.lock"
  else
    "$@"
  fi
}

dt() {
  mkdir -p "$OUT"
  ( cd "$ROOT" && OUT="$OUT" ASSETS="$ASSETS" tools/dtest.sh "$@" )
}

pw() {
  local s="${1:?missing script}"; shift
  mkdir -p "$OUT"
  local dev=()
  [ -d /dev/dri ] && dev=(--device /dev/dri)
  local assets_mount=()
  if [ "$ASSETS" != "$ROOT/public/assets" ]; then
    assets_mount=(-v "$ASSETS":/site/assets:ro)
  fi
  docker run --rm --ipc=host "${dev[@]}" \
    -e ORIGIN=http://127.0.0.1:8080 -e SETUP -e UNTIL \
    -v "$ROOT/tools/docker":/work:ro \
    -v "$ROOT/public":/site:ro \
    "${assets_mount[@]}" \
    -v "$OUT":/out \
    -v lobby_pw_modules:/w:ro \
    "$IMG" bash -c '
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
      node serve.mjs /site 8080 2>/dev/null &
      SERVE_PID=$!
      for _ in $(seq 1 100); do
        if (echo >/dev/tcp/127.0.0.1/8080) 2>/dev/null; then break; fi
        kill -0 "$SERVE_PID" 2>/dev/null || { echo "serve.mjs exited early" >&2; exit 1; }
        sleep 0.05
      done
      (echo >/dev/tcp/127.0.0.1/8080) 2>/dev/null || { echo "serve.mjs not ready" >&2; exit 1; }
      s="$1"; shift
      set +e
      node "$s" "$@"
    ' _ "$s" "$@" 2>&1 | grep -v "GL Driver"
  return ${PIPESTATUS[0]}
}

tier="${1:?usage: tools/ci/run.sh <tier> [args...]}"; shift

case "$tier" in
  static)
    (
      cd "$ROOT" &&
      python3 tools/content.py &&
      for t in tools/test_*.py; do python3 -m unittest -q "$t" || exit 1; done &&
      python3 tools/site.py > /dev/null
    )
    ;;
  smoke)
    assets
    site || exit 1
    bad=0
    for u in "/" "/?room=about" "/?room=projects" "/?room=experience" "/?room=comms" "/blog/"; do
      gpu dt errs.mjs "http://127.0.0.1:8080$u" || bad=1
    done
    exit "$bad"
    ;;
  script)
    [ $# -ge 1 ] || { echo "usage: tools/ci/run.sh script <name.mjs> [args...]" >&2; exit 2; }
    assets
    site || exit 1
    gpu dt "$@"
    ;;
  suite)
    assets
    ( cd "$ROOT" && OUT="$OUT" ASSETS="$ASSETS" gpu tools/check.sh )
    ;;
  bench)
    assets
    site || exit 1
    q="${1:-}"
    q="${q#/}"
    gpu pw bench.mjs "http://127.0.0.1:8080/$q" 1920 1080 "${3:-8}" "${2:-3}"
    ;;
  snap)
    name="${1:?usage: tools/ci/run.sh snap <name> <state=query>...}"; shift
    [ $# -ge 1 ] || { echo "usage: tools/ci/run.sh snap <name> <state=query>..." >&2; exit 2; }
    assets
    site || exit 1
    mkdir -p "$OUT/$name"
    gpu pw detsnap.mjs http://127.0.0.1:8080 "/out/$name" 60 "$@"
    ;;
  pdiff)
    a="${1:?usage: tools/ci/run.sh pdiff <jobA/out/name> <jobB/out/name>}"
    b="${2:?usage: tools/ci/run.sh pdiff <jobA/out/name> <jobB/out/name>}"
    if [ -n "${CI_HOME:-}" ] && [[ "$a" != /* || "$a" == "$CI_HOME/jobs/"* ]] && [[ "$b" != /* || "$b" == "$CI_HOME/jobs/"* ]]; then
      a_rel="${a#"$CI_HOME/jobs/"}"
      b_rel="${b#"$CI_HOME/jobs/"}"
      a_rel="${a_rel#/}"
      b_rel="${b_rel#/}"
      [ -d "$CI_HOME/jobs/$a_rel" ] || { echo "ci: pdiff dir not found: $CI_HOME/jobs/$a_rel" >&2; exit 2; }
      [ -d "$CI_HOME/jobs/$b_rel" ] || { echo "ci: pdiff dir not found: $CI_HOME/jobs/$b_rel" >&2; exit 2; }
      docker run --rm --ipc=host \
        -v "$ROOT/tools/docker":/work:ro \
        -v "$CI_HOME/jobs":/jobs:ro \
        -v lobby_pw_modules:/w:ro \
        "$IMG" bash -c '
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
          node pdiff.mjs "/jobs/$1" "/jobs/$2"
        ' _ "$a_rel" "$b_rel" 2>&1 | grep -v "GL Driver"
      exit ${PIPESTATUS[0]}
    else
      a_abs="$(cd "$a" 2>/dev/null && pwd)" || { echo "ci: pdiff dir not found: $a" >&2; exit 2; }
      b_abs="$(cd "$b" 2>/dev/null && pwd)" || { echo "ci: pdiff dir not found: $b" >&2; exit 2; }
      docker run --rm --ipc=host \
        -v "$ROOT/tools/docker":/work:ro \
        -v "$a_abs":/dirA:ro \
        -v "$b_abs":/dirB:ro \
        -v lobby_pw_modules:/w:ro \
        "$IMG" bash -c '
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
          node pdiff.mjs /dirA /dirB
        ' 2>&1 | grep -v "GL Driver"
      exit ${PIPESTATUS[0]}
    fi
    ;;
  *)
    echo "ci: unknown tier '$tier'" >&2
    exit 2
    ;;
esac
