#!/bin/bash
# Everything for the content and its reading in the rooms, in one command; exit 1 if any step failed (every step is run, then listed).
#   tools/check.sh          env: OUT (host folder for screenshots, default /tmp/dtest), ASSETS (baked rooms; see tools/dtest.sh), CHECK_JOBS (parallel browser workers, default 8)
# The browser steps need Docker (tools/dtest.sh serves public/ inside a container). The posts' pages are regenerated first.
cd "$(dirname "$0")/.." || exit 1

SUITE_T0=$(date +%s)
JOBS="${CHECK_JOBS:-8}"
if ! [[ "$JOBS" =~ ^[1-9][0-9]*$ ]]; then
  echo "check.sh: CHECK_JOBS must be a positive integer (got '$JOBS')" >&2
  exit 2
fi

OUT="${OUT:-/tmp/dtest}"
mkdir -p "$OUT" || exit 1
OUT="$(cd "$OUT" && pwd)"

FAILED=()
Q_NAME=()
Q_CMD=()
STEP_IDX=0
STEP_OUT=""
declare -A PID_NAME=() PID_LOG=() PID_T0=()
LOG_DIR=""

cleanup() {
  local pid
  for pid in "${!PID_NAME[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  for pid in "${!PID_NAME[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
  if [ -n "$LOG_DIR" ] && [ -d "$LOG_DIR" ]; then
    rm -rf "$LOG_DIR"
  fi
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

step() {
  local name="$1"; shift
  local t0 dur rc
  t0=$(date +%s)
  echo
  echo "=== $name"
  "$@"
  rc=$?
  dur=$(( $(date +%s) - t0 ))
  if [ "$rc" -eq 0 ]; then
    echo "--- ok: $name (${dur}s)"
  else
    echo "--- FAILED: $name (${dur}s, exit $rc)"
    FAILED+=("$name")
  fi
}

# Sets STEP_OUT (and bumps STEP_IDX) in the calling shell: never call it in $(...), or every step gets the same number.
next_step_out() {
  local name="$1" safe_name
  STEP_IDX=$((STEP_IDX + 1))
  safe_name="$(printf '%s' "$name" | tr -c 'A-Za-z0-9._-' '_')"
  safe_name="${safe_name#_}"
  safe_name="${safe_name%_}"
  safe_name="${safe_name:0:80}"
  STEP_OUT="$OUT/steps/$(printf '%02d' "$STEP_IDX")-$safe_name"
  mkdir -p "$STEP_OUT"
}

dt() { tools/dtest.sh "$@"; }

dt_serial() {
  local name="$1"; shift
  next_step_out "$name"
  step "$name" env OUT="$STEP_OUT" tools/dtest.sh "$@"
}

queue() {
  local name="$1"; shift
  local cmd
  printf -v cmd '%s\x1f' "$@"
  Q_NAME+=("$name")
  Q_CMD+=("${cmd%$'\x1f'}")
}

run_parallel() {
  local total=${#Q_NAME[@]} next=0 active=0
  local step_out log_file pid done_pid rc dur name now
  local -a args
  local IFS=$'\x1f'

  LOG_DIR="$(mktemp -d "$OUT/.check-logs.XXXXXX")"

  while [ "$next" -lt "$total" ] || [ "$active" -gt 0 ]; do
    while [ "$active" -lt "$JOBS" ] && [ "$next" -lt "$total" ]; do
      name="${Q_NAME[$next]}"
      read -r -a args <<< "${Q_CMD[$next]}"
      next_step_out "$name"
      step_out="$STEP_OUT"
      log_file="$LOG_DIR/$(printf '%02d' "$STEP_IDX").log"
      now=$(date +%s)
      echo "[+$((now - SUITE_T0))s] start: $name"
      (
        export OUT="$step_out"
        dt "${args[@]}"
      ) > "$log_file" 2>&1 &
      pid=$!
      PID_NAME[$pid]="$name"
      PID_LOG[$pid]="$log_file"
      PID_T0[$pid]="$now"
      active=$((active + 1))
      next=$((next + 1))
    done

    if [ "$active" -gt 0 ]; then
      done_pid=""
      wait -n -p done_pid
      rc=$?
      [ -n "$done_pid" ] || break
      name="${PID_NAME[$done_pid]}"
      log_file="${PID_LOG[$done_pid]}"
      dur=$(( $(date +%s) - PID_T0[$done_pid] ))
      unset "PID_NAME[$done_pid]" "PID_LOG[$done_pid]" "PID_T0[$done_pid]"
      active=$((active - 1))

      echo
      echo "=== $name"
      cat "$log_file"
      rm -f "$log_file"
      if [ "$rc" -eq 0 ]; then
        echo "--- ok: $name (${dur}s)"
      else
        echo "--- FAILED: $name (${dur}s, exit $rc)"
        FAILED+=("$name")
      fi
    fi
  done
}

# Phase 1: static preflight (serial)
step "content.py" python3 tools/content.py
for t in tools/test_*.py; do step "unittest $t" python3 -m unittest "$t"; done
step "site.py" python3 tools/site.py

if [[ " ${FAILED[*]} " == *" site.py "* ]]; then
  echo; echo "site.py failed: there are no pages to test in a browser"
else
  if [ ! -e "public/assets" ] && [ ! -L "public/assets" ]; then
    mkdir -p "public/assets"
  fi

  SLUGS=$(basename -a data/posts/*.md | sed 's/\.md$//'); FIRST=$(echo "$SLUGS" | head -1)
  PROJECTS=$(basename -a data/projects/*.md | sed 's/\.md$//')

  # Phase 2: independent browser steps, longest first (seconds each took on the CI host with 8 workers, 2026-11-25),
  # so the long ones start at once and the short ones fill the gaps at the end.
  queue "rooms.cross.mjs (desktop)" rooms.cross.mjs desktop                    # 300
  queue "rooms.read.mjs (desktop)" rooms.read.mjs desktop                      # 290
  queue "rooms.cross.mjs (phone)" rooms.cross.mjs phone                        # 290
  queue "rooms.read.mjs (phone)" rooms.read.mjs phone                          # 290
  queue "rooms.read.mjs (reduced)" rooms.read.mjs reduced                      # 135
  queue "plainpage.mjs (no JavaScript, no WebGL, 404)" plainpage.mjs           # 105
  queue "library.mjs (desktop)" library.mjs desktop                            # 105
  queue "library.mjs (phone)" library.mjs phone                                # 90
  queue "history.mjs (the address, Back and the reader)" history.mjs           # 85
  queue "opening.mjs (desktop)" opening.mjs desktop                            # 85
  queue "contact.mjs (desktop; legibility)" contact.mjs desktop                # 85
  queue "rooms.text.mjs (desktop)" rooms.text.mjs desktop                      # 80
  queue "rooms.deeplink.mjs (phone)" rooms.deeplink.mjs phone                  # 80 (once 230)
  queue "rooms.deeplink.mjs (desktop)" rooms.deeplink.mjs desktop              # 80
  queue "opening.mjs (phone)" opening.mjs phone                                # 65
  queue "rooms.others.mjs (desktop)" rooms.others.mjs desktop                  # 65
  queue "hostile.mjs (the rooms against hostile and thin data)" hostile.mjs    # 60
  queue "rooms.others.mjs (phone)" rooms.others.mjs phone                      # 60
  queue "contact.mjs (phone)" contact.mjs phone                                # 60
  queue "opening.mjs (reduced)" opening.mjs reduced                            # 60
  queue "rooms.text.mjs (phone)" rooms.text.mjs phone                          # 30
  queue "contact.mjs (reduced)" contact.mjs reduced                            # 20
  queue "deeplink.mjs $FIRST (desktop)" deeplink.mjs "$FIRST"                  # 20
  queue "deeplink.mjs $FIRST (phone)" deeplink.mjs "$FIRST" 390 844            # 15
  queue "library.mjs (reduced)" library.mjs reduced                            # 15
  queue "writing-alias.mjs" writing-alias.mjs                                  # 10
  for u in "/" "/?room=about" "/?room=projects" "/?room=experience" "/?room=comms" "/blog/"; do
    queue "errs.mjs $u" errs.mjs "http://127.0.0.1:8080$u"
  done
  for s in $SLUGS; do queue "page.mjs /blog/$s/" page.mjs "/blog/$s/"; done
  for u in /about/ /portfolio/ /experience/ /contact/; do queue "page.mjs $u" page.mjs "$u"; done
  for s in $PROJECTS; do queue "page.mjs /portfolio/$s/" page.mjs "/portfolio/$s/"; done
  queue "endpoints.mjs" endpoints.mjs
  queue "plaincheck-selftest.mjs" plaincheck-selftest.mjs

  echo
  echo "=== phase 2: running ${#Q_NAME[@]} browser steps ($JOBS workers) [+$(( $(date +%s) - SUITE_T0 ))s]"
  run_parallel

  # Phase 3: motion/stillness-sensitive steps (serial, alone on GPU)
  echo
  echo "=== phase 3: serial motion and stillness checks [+$(( $(date +%s) - SUITE_T0 ))s]"
  # They time or sample frames (stillness, the lock's transition, the map's turn, the cue's place and the drone's
  # errand), so each runs alone with nothing else on the GPU.
  dt_serial "hud.mjs (the visitor's display: the lock, names, caption, hint; still unless READ is asked)" hud.mjs all
  dt_serial "turn.mjs (Navigation's map turns; its hint)" turn.mjs all
  dt_serial "cue.mjs (the Library's cue; the drone's errand)" cue.mjs all
fi

TOTAL_DUR=$(( $(date +%s) - SUITE_T0 ))
echo; echo "=== summary (${TOTAL_DUR}s)"
if [ ${#FAILED[@]} -eq 0 ]; then echo "all steps passed"; exit 0; fi
printf 'FAILED: %s\n' "${FAILED[@]}"; exit 1
