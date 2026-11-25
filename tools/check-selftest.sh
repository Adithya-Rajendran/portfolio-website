#!/bin/bash
# Drives tools/check.sh's step runner with stand-in steps (tools/docker/selftest-sleep.mjs, run by the real tools/dtest.sh in a container):
#   1. SIGTERM while steps run in parallel      -> no step process and no container left
#   2. SIGTERM while a serial step runs         -> the same
#   3. wait -n returns no finished step         -> every running and every queued step is reported FAILED, none left running
#   4. a normal run with one failing step       -> only that step FAILED; each step's log is kept in $OUT/steps/NN-<name>/log.txt
# Needs Docker. Prints "ok" / "FAIL" per scenario; exit 1 if any failed. Takes about a minute.
#   tools/check-selftest.sh
cd "$(dirname "$0")/.." || exit 1
export ORIGIN="http://127.0.0.1:1"        # dtest.sh serves nothing: the stand-in step needs no site
FAILS=0
verdict() { if [ "$1" -eq 0 ]; then echo "ok   $2"; else echo "FAIL $2"; FAILS=$((FAILS + 1)); fi; }

# --- the child: a shell that sources check.sh without running the suite, then runs one scenario
if [ "$1" = "--child" ]; then
  export OUT="$2/out" CHECK_SOURCE_ONLY=1 CHECK_JOBS=2
  mkdir -p "$OUT"
  source tools/check.sh
  case "$3" in
    parallel)
      for k in 1 2 3 4; do queue "stand-in $k" selftest-sleep.mjs 777$k; done
      run_parallel ;;
    serial)
      dt_serial "stand-in serial" selftest-sleep.mjs 7775 ;;
    waitfail)
      for k in 1 2 3 4; do queue "stand-in $k" selftest-sleep.mjs 777$k; done
      wait() { if [ "$1" = "-n" ]; then return 127; fi; builtin wait "$@"; }
      run_parallel ;;
    normal)
      queue "stand-in ok" selftest-sleep.mjs 1
      queue "stand-in bad" selftest-sleep.mjs 1 3
      run_parallel ;;
  esac
  printf 'FAILED: %s\n' "${FAILED[@]}"
  exit 0
fi

BASE="$(mktemp -d)"
stand_ins() { pgrep -f 'selftest-sleep.mjs 777[0-9]' | wc -l; }
containers() { docker ps -aq --filter "label=arcadia.check" | wc -l; }

# signal_case <scenario> <containers that must be up before the signal>
signal_case() {
  local dir="$BASE/$1" n=0 i pid rc
  mkdir -p "$dir"
  bash "$0" --child "$dir" "$1" > "$dir/stdout.txt" 2>&1 &
  pid=$!
  for i in $(seq 1 150); do n=$(containers); [ "$n" -ge "$2" ] && break; sleep 0.2; done
  echo "$1: before SIGTERM: $(containers) containers, $(stand_ins) stand-in processes"
  kill -TERM "$pid"
  wait "$pid"; rc=$?
  sleep 1
  echo "$1: child exit $rc; after SIGTERM: $(containers) containers, $(stand_ins) stand-in processes"
  [ "$n" -ge "$2" ] && [ "$rc" -eq 143 ] && [ "$(containers)" -eq 0 ] && [ "$(stand_ins)" -eq 0 ]
  verdict $? "SIGTERM during the $1 phase leaves no step process and no container"
}

signal_case parallel 2
signal_case serial 1

# --- 3. wait -n gives nothing
dir="$BASE/waitfail"; mkdir -p "$dir"
bash "$0" --child "$dir" waitfail > "$dir/stdout.txt" 2>&1
grep -E '^(---|check.sh|FAILED)' "$dir/stdout.txt"
n=$(grep -c '^FAILED: ' "$dir/stdout.txt")
[ "$n" -eq 4 ] && [ "$(containers)" -eq 0 ] && [ "$(stand_ins)" -eq 0 ]
verdict $? "when wait returns no finished step, the 2 running and 2 queued steps are all FAILED and none is left running"

# --- 4. a normal run
dir="$BASE/normal"; mkdir -p "$dir"
bash "$0" --child "$dir" normal > "$dir/stdout.txt" 2>&1
grep -E '^(---|FAILED)' "$dir/stdout.txt"
ls "$dir"/out/steps/*/log.txt
[ "$(grep -c '^FAILED: ' "$dir/stdout.txt")" -eq 1 ] && grep -q '^FAILED: stand-in bad$' "$dir/stdout.txt" && [ "$(ls "$dir"/out/steps/*/log.txt | wc -l)" -eq 2 ]
verdict $? "a failing step is the only one FAILED and every step keeps its log.txt"

rm -rf "$BASE"
exit $((FAILS > 0))
