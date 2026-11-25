#!/bin/bash
# Run a perf measurement or bench on the local Intel HD 630 from a clean git archive of <ref>,
# serialized with an exclusive lock, bounded by timeout, with before/after load average checks.
#   tools/ci/hd630.sh <ref> [perf] <passes|cpuprof|unpinned|load|loadprof|blurdiff|bench> [args...]
set -u

usage() {
  cat >&2 <<'EOF'
usage: tools/ci/hd630.sh <ref> [perf] <subcommand> [args...]
subcommands:
  passes   "<query>" [secs=6] [w=1920] [h=1080]
  cpuprof  "<query>" [secs=6] [w=1920] [h=1080]
  unpinned "<query>" [secs=30] [w=1920] [h=1080] [dpr=1]
  load     "<query>" [mbps=50] [rtt=20]
  loadprof "<query>"
  blurdiff <dirA|a1.png> <dirB|b1.png> [...]
  bench    "<query>" [runs=3] [seconds=8]
EOF
  exit 2
}

[ $# -ge 2 ] || usage
REF="$1"; shift
if [ "$1" = "perf" ]; then
  shift
  [ $# -ge 1 ] || usage
fi
SUBCMD="$1"; shift
case "$SUBCMD" in
  passes|cpuprof|unpinned|load|loadprof|blurdiff|bench) ;;
  *) echo "hd630: unknown subcommand '$SUBCMD'" >&2; usage ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GDIR="$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null)" || {
  echo "hd630: not inside a git repository: $ROOT" >&2
  exit 2
}
[[ "$GDIR" != /* ]] && GDIR="$(cd "$ROOT" && cd "$GDIR" && pwd)"

resolve_commit() {
  local ref="$1"
  git -C "$ROOT" rev-parse --verify -q "$ref^{commit}" 2>/dev/null \
    || git --git-dir="$GDIR" rev-parse --verify -q "$ref^{commit}" 2>/dev/null \
    || git --git-dir="$GDIR" rev-parse --verify -q "origin/$ref^{commit}" 2>/dev/null \
    || git --git-dir="$GDIR" rev-parse --verify -q "ci/$ref^{commit}" 2>/dev/null
}

SHA="$(resolve_commit "$REF")" || {
  echo "hd630: unknown ref '$REF'" >&2
  exit 2
}
SHA8="${SHA:0:8}"

JOBS_ROOT="${HD630_JOBS:-${XDG_STATE_HOME:-$HOME/.local/state}/arcadia/hd630-jobs}"
CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}/arcadia/hd630-assets"
LOCK_FILE="${HD630_LOCK:-/tmp/arcadia-local-hd630.lock}"
RUN_TIMEOUT="${HD630_TIMEOUT:-300}"
IMG="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.64.1-noble}"
LOCK_WAIT="${HD630_LOCK_WAIT:-3600}"

# Exclusive HD 630 lock, taken before any preparation (archive, packing, site.py) so that a second run's
# preparation never overlaps the first run's measurement. The measurement timeout starts after this point.
exec 9>"$LOCK_FILE"
flock -w "$LOCK_WAIT" 9 || {
  echo "hd630: timed out waiting ${LOCK_WAIT}s for lock $LOCK_FILE" >&2
  exit 75
}

JOB="$JOBS_ROOT/$(date +%Y%m%d-%H%M%S)-${SHA8}-${SUBCMD}-$$"
W="$JOB/src"
OUT_DIR="${OUT:-$JOB/out}"
mkdir -p "$W" "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
CID="arcadia-hd630-${SHA8}-$$"

cleanup() {
  docker rm -f "$CID" >/dev/null 2>&1 || true
  rm -rf "$W" 2>/dev/null || true
}
trap cleanup EXIT

git --git-dir="$GDIR" archive "$SHA" | tar -x -C "$W" || {
  echo "hd630: failed to archive $SHA" >&2
  exit 2
}

asset_key_for() {
  local src="$1"
  ( cd "$src" && find assets-src tools/pack.py -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -c1-20 )
}

resolve_hd630_assets() {
  if [ -n "${ASSETS:-}" ]; then
    [ -d "$ASSETS" ] || { echo "hd630: ASSETS directory does not exist: $ASSETS" >&2; exit 3; }
    [ -n "$(ls -A "$ASSETS" 2>/dev/null)" ] || { echo "hd630: ASSETS directory is empty: $ASSETS" >&2; exit 3; }
    ASSETS="$(cd "$ASSETS" && pwd)"
    return 0
  fi

  local key cand main_root
  key="$(asset_key_for "$W")"

  for cand in "$ROOT/public/assets" "$(cd "$GDIR/.." && pwd)/public/assets"; do
    main_root="$(dirname "$(dirname "$cand")")"
    if [ -d "$cand" ] && [ ! -L "$cand" ] && [ -n "$(ls -A "$cand" 2>/dev/null)" ] \
       && [ -d "$main_root/assets-src" ] && [ -f "$main_root/tools/pack.py" ]; then
      if [ "$(asset_key_for "$main_root")" = "$key" ]; then
        ASSETS="$(cd "$cand" && pwd)"
        return 0
      fi
    fi
  done

  mkdir -p "$CACHE_ROOT"
  local cached="$CACHE_ROOT/$key"
  (
    flock 8
    if [ ! -d "$cached" ] || [ -z "$(ls -A "$cached" 2>/dev/null)" ]; then
      echo "hd630: packing rooms into cache ($key)"
      rm -rf "$W/public/assets"
      if ( cd "$W" && python3 tools/pack.py ) > "$JOB/pack.log" 2>&1; then
        local tmp_assets="$CACHE_ROOT/.tmp-$key-$$"
        rm -rf "$tmp_assets"
        mv "$W/public/assets" "$tmp_assets"
        rm -rf "$cached"
        mv "$tmp_assets" "$cached"
      else
        echo "hd630: pack failed, see $JOB/pack.log" >&2
        tail -20 "$JOB/pack.log" >&2 || true
        exit 3
      fi
    fi
  ) 8>"$CACHE_ROOT/pack.lock" || exit 3
  ASSETS="$cached"
}

if [ "$SUBCMD" != "blurdiff" ]; then
  resolve_hd630_assets || exit 3
  export ASSETS
  if [ -L "$W/public/assets" ]; then rm -f "$W/public/assets"; fi
  mkdir -p "$W/public/assets"
  if ! ( cd "$W" && python3 tools/site.py ) > "$JOB/site.log" 2>&1; then
    echo "hd630: site.py failed, see $JOB/site.log" >&2
    tail -20 "$JOB/site.log" >&2 || true
    exit 1
  fi
fi

# Choose runner:
# 1. The extracted commit's tools/ci/run.sh when it supports the requested tier/subcommand.
# 2. Direct container execution fallback (for commits older than the perf tier).
RUNNER=""
RUNNER_ARGS=()
if [ -x "$W/tools/ci/run.sh" ]; then
  if [ "$SUBCMD" = "bench" ]; then
    RUNNER="$W/tools/ci/run.sh"
    RUNNER_ARGS=(bench "$@")
  elif grep -qE '^[[:space:]]*perf\)' "$W/tools/ci/run.sh"; then
    RUNNER="$W/tools/ci/run.sh"
    RUNNER_ARGS=(perf "$SUBCMD" "$@")
  fi
fi

# Direct Docker invocation arguments for fallback mode (no GPU run until inside flock + timeout)
build_direct_cmd() {
  local script="" sargs=()
  local q="${1:-}"
  q="${q#/}"
  case "$SUBCMD" in
    passes)   script="passes.mjs";   sargs=("http://127.0.0.1:8080/$q" "${2:-6}" "${3:-1920}" "${4:-1080}") ;;
    cpuprof)  script="cpuprof.mjs";  sargs=("http://127.0.0.1:8080/$q" "${2:-6}" "${3:-1920}" "${4:-1080}") ;;
    unpinned) script="unpinned.mjs"; sargs=("http://127.0.0.1:8080/$q" "${2:-30}" "${3:-1920}" "${4:-1080}" "${5:-1}") ;;
    load)     script="load.mjs";     sargs=("http://127.0.0.1:8080/$q" "${2:-50}" "${3:-20}") ;;
    loadprof) script="loadprof.mjs"; sargs=("http://127.0.0.1:8080/$q") ;;
    bench)    script="bench.mjs";    sargs=("http://127.0.0.1:8080/$q" 1920 1080 "${3:-8}" "${2:-3}") ;;
    blurdiff) script="blurdiff.mjs" ;;
  esac

  local docker_src="$ROOT/tools/docker"
  [ -f "$W/tools/docker/$script" ] && docker_src="$W/tools/docker"

  if [ "$SUBCMD" = "blurdiff" ]; then
    [ $# -ge 2 ] || { echo "usage: tools/ci/hd630.sh <ref> blurdiff <dirA|a1.png> <dirB|b1.png> [...]" >&2; exit 2; }
    local mounts=() cargs=() idx=0 a abs parent base
    for a in "$@"; do
      [ -e "$a" ] || { echo "hd630: blurdiff path not found: $a" >&2; exit 2; }
      if [ -d "$a" ]; then
        abs="$(cd "$a" && pwd)"
        base="$(basename "$abs")"
        mounts+=(-v "$abs:/in/$idx/$base:ro")
        cargs+=("/in/$idx/$base")
      else
        abs="$(cd "$(dirname "$a")" && pwd)/$(basename "$a")"
        parent="$(basename "$(dirname "$abs")")"
        base="$(basename "$abs")"
        mounts+=(-v "$abs:/in/$idx/$parent/$base:ro")
        cargs+=("/in/$idx/$parent/$base")
      fi
      idx=$((idx + 1))
    done
    DIRECT_CMD=(
      docker run --rm --init --name "$CID" --ipc=host
      -v "$docker_src:/work:ro"
      "${mounts[@]}"
      -v lobby_pw_modules:/w:ro
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
      ' _ "${cargs[@]}"
    )
    return 0
  fi

  local dev=()
  [ -d /dev/dri ] && dev=(--device /dev/dri)
  local assets_mount=()
  [ "$ASSETS" != "$W/public/assets" ] && assets_mount=(-v "$ASSETS:/site/assets:ro")

  DIRECT_CMD=(
    docker run --rm --init --name "$CID" --ipc=host "${dev[@]}"
    -e ORIGIN=http://127.0.0.1:8080 -e SETUP -e UNTIL
    -v "$docker_src:/work:ro"
    -v "$W/public:/site:ro"
    "${assets_mount[@]}"
    -v "$OUT_DIR:/out"
    -v lobby_pw_modules:/w:ro
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
    ' _ "$script" "${sargs[@]}"
  )
}

DIRECT_CMD=()
if [ -z "$RUNNER" ]; then
  build_direct_cmd "$@"
fi

NPROC="$(nproc)"
DEFAULT_MAX_LOAD=$(( NPROC / 2 ))
[ "$DEFAULT_MAX_LOAD" -lt 1 ] && DEFAULT_MAX_LOAD=1
LOAD_LIMIT="${HD630_MAX_LOAD:-$DEFAULT_MAX_LOAD}"

# Preparation just ran inside the lock; let its load fade before sampling "before" (bounded wait).
SETTLE="${HD630_SETTLE:-120}"
while [ "$SETTLE" -gt 0 ] && awk -v l="$(cut -d' ' -f1 /proc/loadavg)" -v m="$LOAD_LIMIT" 'BEGIN{exit !(l>m)}'; do
  sleep 5; SETTLE=$((SETTLE - 5))
done
LOAD_BEFORE="$(cat /proc/loadavg)"
T0=$(date +%s)

if [ -n "$RUNNER" ]; then
  timeout -k 10s "${RUN_TIMEOUT}s" \
    env OUT="$OUT_DIR" ASSETS="$ASSETS" CI_CONTAINER_NAME="$CID" \
    "$RUNNER" "${RUNNER_ARGS[@]}" 2>&1 | grep -v "GL Driver" | tee "$JOB/log.txt"
  RC=${PIPESTATUS[0]}
else
  timeout -k 10s "${RUN_TIMEOUT}s" \
    "${DIRECT_CMD[@]}" 2>&1 | grep -v "GL Driver" | tee "$JOB/log.txt"
  RC=${PIPESTATUS[0]}
fi

docker rm -f "$CID" >/dev/null 2>&1 || true

T1=$(date +%s)
SECONDS_ELAPSED=$(( T1 - T0 ))
LOAD_AFTER="$(cat /proc/loadavg)"

SUMMARY="$(python3 - "$JOB/result.json" "$REF" "$SHA" "$SUBCMD" "$RC" "$SECONDS_ELAPSED" "$LOAD_BEFORE" "$LOAD_AFTER" "$LOAD_LIMIT" "$NPROC" "$JOB" "$@" <<'PY'
import json, sys

res_path, ref, sha, subcmd, rc_s, sec_s, lb_s, la_s, limit_s, nproc_s, job, *args = sys.argv[1:]
rc = int(rc_s)
secs = int(sec_s)
limit = float(limit_s)
nproc = int(nproc_s)
lb = [float(x) for x in lb_s.split()[:3]]
la = [float(x) for x in la_s.split()[:3]]

reasons = []
if lb[0] > limit:
    reasons.append(f"load1_before={lb[0]:.2f} > limit={limit:g}")
if la[0] > limit:
    reasons.append(f"load1_after={la[0]:.2f} > limit={limit:g}")

usable = len(reasons) == 0
unusable = not usable
status = "pass" if rc == 0 else "fail"

data = {
    "ref": ref,
    "sha": sha,
    "tier": "perf",
    "subcommand": subcmd,
    "args": args,
    "status": status,
    "exit_code": rc,
    "usable": usable,
    "unusable": unusable,
    "unusable_reason": "; ".join(reasons) if reasons else None,
    "load_before": lb,
    "load_after": la,
    "load_limit": limit,
    "nproc": nproc,
    "seconds": secs,
    "job": job,
}
with open(res_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

u_tag = "USABLE" if usable else "UNUSABLE"
s_tag = "PASS" if rc == 0 else "FAIL"
print(f"hd630 {subcmd} {sha[:8]} {s_tag} {u_tag} {secs}s (load {lb[0]:.2f} -> {la[0]:.2f}, limit {limit:g})  {job}")
PY
)"

echo "$SUMMARY"
if [[ "$SUMMARY" == *" UNUSABLE "* ]]; then
  echo "hd630: WARNING: machine load exceeded HD630_MAX_LOAD ($LOAD_LIMIT); run marked unusable in $JOB/result.json" >&2
fi

exit "$RC"