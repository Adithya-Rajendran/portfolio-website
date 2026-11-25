#!/bin/bash
# Run one CI check tier on this checkout, either under /srv/arcadia/bin/ci (CI_JOB + CI_HOME) or standalone locally.
#   tools/ci/run.sh <tier> [args...]
# Tiers: static | smoke | script <name.mjs> [args...] | suite | bench "<query>" [runs] [seconds] | snap <name> <state=query>... | pdiff <dirA> <dirB> | pictures [--against <base>] | e2e [playwright args...] | perf <passes|cpuprof|unpinned|load|loadprof|blurdiff|bench> [args...]
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -n "${CI_HOME:-}" ] && CI_HOME="${CI_HOME%/}"
OUT="${OUT:-${CI_JOB:+$CI_JOB/out}}"
OUT="${OUT:-/tmp/arcadia-ci-out}"
if [[ "$OUT" != /* ]]; then
  mkdir -p "$OUT" && OUT="$(cd "$OUT" && pwd)"
elif [ -d "$OUT" ]; then
  OUT="$(cd "$OUT" && pwd)"
fi
USER_ASSETS=""
if [ -n "${ASSETS:-}" ]; then
  if [ -d "$ASSETS" ]; then
    USER_ASSETS="$(cd "$ASSETS" && pwd)"
    ASSETS="$USER_ASSETS"
  else
    USER_ASSETS="$ASSETS"
  fi
fi
IMG="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.64.1-noble}"
E2E_IMG="${PLAYWRIGHT_E2E_IMAGE:-mcr.microsoft.com/playwright:v1.65.1-noble}"
BASE_SRC_CLEANUP=""
cleanup_run() {
  [ -n "$BASE_SRC_CLEANUP" ] && rm -rf "$BASE_SRC_CLEANUP" || true
}
trap cleanup_run EXIT

asset_key_for() {
  local src="${1:-$ROOT}"
  ( cd "$src" && find assets-src tools/pack.py -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -c1-20 )
}

asset_key() {
  asset_key_for "$ROOT"
}

resolve_assets_for() {
  local src="${1:-$ROOT}"
  local log_name="${2:-pack.log}"
  local resolved=""

  if [ "$src" = "$ROOT" ] && [ -n "$USER_ASSETS" ]; then
    [ -d "$USER_ASSETS" ] || { echo "ci: ASSETS directory does not exist: $USER_ASSETS" >&2; exit 3; }
    [ -n "$(ls -A "$USER_ASSETS" 2>/dev/null)" ] || { echo "ci: ASSETS directory is empty: $USER_ASSETS" >&2; exit 3; }
    if [ -L "$src/public/assets" ]; then rm -f "$src/public/assets"; fi
    mkdir -p "$src/public/assets"
    RESOLVED_ASSETS="$USER_ASSETS"
    return 0
  fi

  if [ -n "${CI_HOME:-}" ]; then
    local key log_dir
    key="$(asset_key_for "$src")"
    resolved="$CI_HOME/cache/assets/$key"
    log_dir="${CI_JOB:-$OUT}"
    mkdir -p "$CI_HOME/cache/assets" "$log_dir"
    (
      flock 9
      if [ ! -d "$resolved" ]; then
        echo "ci: packing rooms ($key)"
        rm -rf "$src/public/assets"
        if ( cd "$src" && python3 tools/pack.py ) > "$log_dir/$log_name" 2>&1; then
          local tmp_assets="$CI_HOME/cache/assets/.tmp-$key-$$"
          rm -rf "$tmp_assets"
          mv "$src/public/assets" "$tmp_assets"
          mv "$tmp_assets" "$resolved"
        else
          echo "ci: pack failed, see $log_dir/$log_name" >&2
          tail -20 "$log_dir/$log_name" >&2 || true
          rm -rf "$src/public/assets"
          exit 3
        fi
      fi
    ) 9>"$CI_HOME/cache/pack.lock" || exit 3
    if [ -L "$src/public/assets" ]; then rm -f "$src/public/assets"; fi
    mkdir -p "$src/public/assets"
    RESOLVED_ASSETS="$resolved"
    return 0
  fi

  # Standalone local run without CI_HOME or ASSETS
  if [ -d "$src/public/assets" ] && [ ! -L "$src/public/assets" ] && [ -n "$(ls -A "$src/public/assets" 2>/dev/null)" ]; then
    resolved="$src/public/assets"
  elif git -C "$ROOT" rev-parse --git-common-dir >/dev/null 2>&1; then
    local common main_assets
    common="$(git -C "$ROOT" rev-parse --git-common-dir)"
    main_assets="$(cd "$ROOT" && cd "$common/.." && pwd)/public/assets"
    if [ "$src" = "$ROOT" ] && [ -d "$main_assets" ] && [ ! -L "$main_assets" ] && [ -n "$(ls -A "$main_assets" 2>/dev/null)" ]; then
      resolved="$main_assets"
    fi
  fi

  if [ -z "$resolved" ]; then
    mkdir -p "$OUT"
    echo "ci: packing rooms locally ($src)"
    rm -rf "$src/public/assets"
    if ! ( cd "$src" && python3 tools/pack.py ) > "$OUT/$log_name" 2>&1; then
      echo "ci: pack failed, see $OUT/$log_name" >&2
      tail -20 "$OUT/$log_name" >&2 || true
      exit 3
    fi
    resolved="$src/public/assets"
  fi

  if [ -L "$src/public/assets" ]; then rm -f "$src/public/assets"; fi
  mkdir -p "$src/public/assets"
  RESOLVED_ASSETS="$resolved"
}

assets() {
  resolve_assets_for "$ROOT" "pack.log"
  ASSETS="$RESOLVED_ASSETS"
  export ASSETS
}

site_for() {
  local src="${1:-$ROOT}"
  local log_name="${2:-site.log}"
  local log_dir="${CI_JOB:-$OUT}"
  mkdir -p "$log_dir"
  if ! ( cd "$src" && python3 tools/site.py ) > "$log_dir/$log_name" 2>&1; then
    echo "ci: site.py failed" >&2
    tail -10 "$log_dir/$log_name" >&2 || true
    return 1
  fi
}

site() {
  site_for "$ROOT" "site.log"
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

pw_for() {
  local site_src="${1:?missing src}" assets_dir="${2:?missing assets}" out_dir="${3:?missing out}" s="${4:?missing script}"
  shift 4
  mkdir -p "$out_dir"
  local dev=()
  [ -d /dev/dri ] && dev=(--device /dev/dri)
  local assets_mount=()
  if [ "$assets_dir" != "$site_src/public/assets" ]; then
    assets_mount=(-v "$assets_dir":/site/assets:ro)
  fi
  docker run --rm ${CI_CONTAINER_NAME:+--name "$CI_CONTAINER_NAME"} --ipc=host "${dev[@]}" \
    -e ORIGIN=http://127.0.0.1:8080 -e SETUP -e UNTIL \
    -v "$ROOT/tools/docker":/work:ro \
    -v "$site_src/public":/site:ro \
    "${assets_mount[@]}" \
    -v "$out_dir":/out \
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

pw() {
  local s="${1:?missing script}"; shift
  pw_for "$ROOT" "$ASSETS" "$OUT" "$s" "$@"
}

run_e2e() {
  mkdir -p "$OUT/test-results" "$OUT/playwright-report"
  local dev=()
  [ -d /dev/dri ] && dev=(--device /dev/dri)
  local assets_mount=()
  if [ "$ASSETS" != "$ROOT/public/assets" ]; then
    assets_mount=(-v "$ASSETS":/repo/public/assets:ro)
  fi
  docker run --rm --init --ipc=host "${dev[@]}" \
    -e CI=1 \
    -e PLAYWRIGHT_OUTPUT_DIR=/out/test-results \
    -e PLAYWRIGHT_HTML_REPORT=/out/playwright-report \
    -e SITE_DIR=/repo/public \
    -e ASSETS=/repo/public/assets \
    -v "$ROOT":/repo:ro \
    "${assets_mount[@]}" \
    -v "$OUT":/out \
    "$E2E_IMG" bash -c '
      set -e
      TMP_E2E=$(mktemp -d /out/e2e-tmp.XXXXXX)
      trap "rm -rf \"$TMP_E2E\"" EXIT
      export TMPDIR="$TMP_E2E"
      cd /repo
      set +e
      xvfb-run -a -s "-screen 0 1280x720x24" node tests/e2e/run.mjs "$@"
    ' _ "$@" 2>&1 | grep -v "GL Driver"
  return ${PIPESTATUS[0]}
}

resolve_commit() {
  local gdir="$1" ref="$2"
  git --git-dir="$gdir" rev-parse --verify -q "$ref^{commit}" 2>/dev/null \
    || { [[ "$ref" == origin/* ]] && git --git-dir="$gdir" rev-parse --verify -q "${ref#origin/}^{commit}" 2>/dev/null; } \
    || { [[ "$ref" == ci/* ]] && git --git-dir="$gdir" rev-parse --verify -q "${ref#ci/}^{commit}" 2>/dev/null; }
}

render_pictures_checkout() {
  local src_dir="$1" out_dir="$2" tag="$3"
  local RESOLVED_ASSETS=""
  resolve_assets_for "$src_dir" "${tag}-pack.log"
  site_for "$src_dir" "${tag}-site.log" || return 1
  mkdir -p "$out_dir"
  gpu pw_for "$src_dir" "$RESOLVED_ASSETS" "$out_dir" detsnap.mjs http://127.0.0.1:8080 /out 90 "${PIC_STATES[@]}"
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
  pictures)
    against=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --against)
          [ $# -ge 2 ] || { echo "ci: --against requires a ref" >&2; exit 2; }
          against="$2"; shift 2
          ;;
        --against=*)
          against="${1#--against=}"; shift
          ;;
        *)
          echo "ci: unknown pictures arg '$1'" >&2; exit 2
          ;;
      esac
    done

    LIST_FILE="$ROOT/tools/ci/pictures.txt"
    [ -f "$LIST_FILE" ] || { echo "ci: missing state list: $LIST_FILE" >&2; exit 2; }
    mapfile -t PIC_STATES < <(grep -vE '^\s*(#|$)' "$LIST_FILE")
    [ ${#PIC_STATES[@]} -gt 0 ] || { echo "ci: empty state list: $LIST_FILE" >&2; exit 2; }
    list_hash="$(sha256sum "$LIST_FILE" | cut -c1-12)"

    cur_sha=""
    repo_git=""
    is_dirty=0
    if [ -n "${CI_HOME:-}" ]; then
      repo_git="$CI_HOME/repo.git"
      job_base="$(basename "${CI_JOB:-}")"
      if [[ "$job_base" =~ ^[0-9]{8}-[0-9]{6}-([0-9a-f]{7,40})- ]]; then
        cur_sha="$(git --git-dir="$repo_git" rev-parse --verify -q "${BASH_REMATCH[1]}^{commit}" 2>/dev/null || true)"
      fi
      [ -n "$cur_sha" ] || cur_sha="$(git -C "$ROOT" rev-parse --verify -q HEAD 2>/dev/null || true)"
    else
      if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
        repo_git="$(cd "$ROOT" && cd "$(git -C "$ROOT" rev-parse --git-dir)" && pwd)"
        cur_sha="$(git -C "$ROOT" rev-parse --verify -q HEAD 2>/dev/null || true)"
        if git -C "$ROOT" status --porcelain 2>/dev/null | grep -q .; then
          is_dirty=1
        fi
      fi
    fi

    base_sha=""
    if [ -n "$against" ]; then
      [ -n "$repo_git" ] || { echo "ci: cannot resolve --against '$against' without git repo" >&2; exit 2; }
      base_sha="$(resolve_commit "$repo_git" "$against")" || { echo "ci: unknown base ref '$against'" >&2; exit 2; }
    else
      base_sha="$cur_sha"
    fi

    cur_dir="$OUT/current"
    rm -rf "$cur_dir"
    echo "ci: rendering current pictures (${#PIC_STATES[@]} states, list=$list_hash)"
    render_pictures_checkout "$ROOT" "$cur_dir" "cur" || exit 1

    base_dir=""
    if [ -n "${CI_HOME:-}" ]; then
      mkdir -p "$CI_HOME/cache/pictures"
      if [ -n "$cur_sha" ]; then
        cur_cache="$CI_HOME/cache/pictures/${cur_sha}_${list_hash}"
        if [ ! -d "$cur_cache" ]; then
          tmp_cur="$CI_HOME/cache/pictures/.tmp-${cur_sha}_${list_hash}-$$"
          rm -rf "$tmp_cur"
          cp -a "$cur_dir" "$tmp_cur"
          (
            flock 6
            if [ ! -d "$cur_cache" ]; then
              mv "$tmp_cur" "$cur_cache"
            else
              rm -rf "$tmp_cur"
            fi
          ) 6>"$CI_HOME/cache/pictures.lock"
        fi
      fi

      [ -n "$base_sha" ] || { echo "ci: could not resolve base commit" >&2; exit 2; }
      base_dir="$CI_HOME/cache/pictures/${base_sha}_${list_hash}"
      if [ ! -d "$base_dir" ]; then
        echo "ci: rendering base golden (${base_sha:0:8}_${list_hash})"
        base_src="${CI_JOB:-$OUT}/base-src"
        rm -rf "$base_src"
        mkdir -p "$base_src"
        BASE_SRC_CLEANUP="$base_src"
        git --git-dir="$repo_git" archive "$base_sha" | tar -x -C "$base_src"
        tmp_base="$CI_HOME/cache/pictures/.tmp-${base_sha}_${list_hash}-$$"
        rm -rf "$tmp_base"
        if ! render_pictures_checkout "$base_src" "$tmp_base" "base"; then
          rm -rf "$tmp_base"
          exit 1
        fi
        (
          flock 6
          if [ ! -d "$base_dir" ]; then
            mv "$tmp_base" "$base_dir"
          else
            rm -rf "$tmp_base"
          fi
        ) 6>"$CI_HOME/cache/pictures.lock"
        rm -rf "$base_src"
        BASE_SRC_CLEANUP=""
      else
        echo "ci: using cached golden (${base_sha:0:8}_${list_hash})"
      fi
    else
      # Local run without CI_HOME
      if [ -n "$against" ]; then
        base_dir="$OUT/base"
        rm -rf "$base_dir"
        base_src="$OUT/base-src"
        rm -rf "$base_src"
        mkdir -p "$base_src"
        BASE_SRC_CLEANUP="$base_src"
        git --git-dir="$repo_git" archive "$base_sha" | tar -x -C "$base_src"
        render_pictures_checkout "$base_src" "$base_dir" "base" || exit 1
        rm -rf "$base_src"
        BASE_SRC_CLEANUP=""
      elif [ "$is_dirty" -eq 0 ] && [ -n "$cur_sha" ]; then
        local_cache="${XDG_CACHE_HOME:-$HOME/.cache}/arcadia/pictures/${cur_sha}_${list_hash}"
        mkdir -p "$(dirname "$local_cache")"
        if [ ! -d "$local_cache" ]; then
          cp -a "$cur_dir" "$local_cache"
        fi
        base_dir="$local_cache"
      else
        base_dir="$OUT/base"
        rm -rf "$base_dir"
        render_pictures_checkout "$ROOT" "$base_dir" "base" || exit 1
      fi
    fi

    mkdir -p "$OUT/heat"
    echo "ci: comparing pictures (${base_sha:+${base_sha:0:8} -> }${cur_sha:+${cur_sha:0:8}})"
    docker run --rm --ipc=host \
      -v "$ROOT/tools/docker":/work:ro \
      -v "$base_dir":/dirA:ro \
      -v "$cur_dir":/dirB:ro \
      -v "$OUT/heat":/heat \
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
        node pdiff.mjs --strict --fail-max=0 /dirA /dirB /heat
      ' 2>&1 | grep -v "GL Driver"
    exit ${PIPESTATUS[0]}
    ;;
  perf)
    sub="${1:-}"
    [ -n "$sub" ] || { echo "usage: tools/ci/run.sh perf <passes|cpuprof|unpinned|load|loadprof|blurdiff|bench> [args...]" >&2; exit 2; }
    shift
    case "$sub" in
      passes|cpuprof|unpinned|load|loadprof)
        q="${1:-}"; q="${q#/}"; [ $# -ge 1 ] && shift
        case "$sub" in
          passes|cpuprof) pargs=("${1:-6}" "${2:-1920}" "${3:-1080}") ;;
          unpinned)       pargs=("${1:-30}" "${2:-1920}" "${3:-1080}" "${4:-1}") ;;
          load)           pargs=("${1:-50}" "${2:-20}") ;;
          loadprof)       pargs=() ;;
        esac
        assets
        site || exit 1
        gpu pw "$sub.mjs" "http://127.0.0.1:8080/$q" "${pargs[@]}"
        ;;
      bench)
        assets
        site || exit 1
        q="${1:-}"; q="${q#/}"
        gpu pw bench.mjs "http://127.0.0.1:8080/$q" 1920 1080 "${3:-8}" "${2:-3}"
        ;;
      blurdiff)
        [ $# -ge 2 ] || { echo "usage: tools/ci/run.sh perf blurdiff <dirA> <dirB> | <a1.png> <b1.png> ..." >&2; exit 2; }
        mounts=(); margs=(); i=0
        for p in "$@"; do
          if [ -n "${CI_HOME:-}" ] && [ -e "$CI_HOME/jobs/${p#"$CI_HOME/jobs/"}" ] && [[ "$p" != /* || "$p" == "$CI_HOME/jobs/"* ]]; then
            p="$CI_HOME/jobs/${p#"$CI_HOME/jobs/"}"
          fi
          [ -e "$p" ] || { echo "ci: blurdiff path not found: $p" >&2; exit 2; }
          abs="$(cd "$(dirname "$p")" && pwd)/$(basename "$p")"
          mounts+=(-v "$abs":/in/$i:ro); margs+=("/in/$i"); i=$((i + 1))
        done
        docker run --rm ${CI_CONTAINER_NAME:+--name "$CI_CONTAINER_NAME"} --ipc=host \
          -v "$ROOT/tools/docker":/work:ro \
          "${mounts[@]}" \
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
            node blurdiff.mjs "$@"
          ' _ "${margs[@]}" 2>&1 | grep -v "GL Driver"
        exit ${PIPESTATUS[0]}
        ;;
      *)
        echo "ci: unknown perf subcommand '$sub'" >&2; exit 2
        ;;
    esac
    ;;
  e2e)
    assets
    site || exit 1
    log_dir="${CI_JOB:-$OUT}"
    mkdir -p "$log_dir"
    if command -v pnpm >/dev/null 2>&1; then
      ( cd "$ROOT" && pnpm install --frozen-lockfile --ignore-scripts ) > "$log_dir/pnpm.log" 2>&1 || {
        echo "ci: pnpm install failed, see $log_dir/pnpm.log" >&2
        tail -20 "$log_dir/pnpm.log" >&2 || true
        exit 1
      }
    else
      ( cd "$ROOT" && npx --yes pnpm@12.23.0 install --frozen-lockfile --ignore-scripts ) > "$log_dir/pnpm.log" 2>&1 || {
        echo "ci: pnpm install failed, see $log_dir/pnpm.log" >&2
        tail -20 "$log_dir/pnpm.log" >&2 || true
        exit 1
      }
    fi
    gpu run_e2e "$@"
    ;;
  *)
    echo "ci: unknown tier '$tier'" >&2
    exit 2
    ;;
esac
