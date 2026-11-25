#!/bin/bash
# Drives tools/check.sh's step runner with stand-in steps (tools/docker/selftest-sleep.mjs, run by the real tools/dtest.sh in a container):
#   1. SIGTERM, SIGINT and SIGHUP while steps run in parallel    -> no step process and no container left; exit 143, 130, 129
#   2. SIGTERM while a serial step runs                          -> the same
#   3. a step that ignores SIGTERM                               -> killed after the grace period, nothing left
#   4. a second signal while the first is still removing containers (a stand-in docker whose ps and rm are slow and whose container outlives its client)
#                                                                -> the container is removed all the same
#   5. wait -n returns no finished step                          -> every running and every queued step is reported FAILED, none left running
#   6. a normal run with one failing step                        -> only that step FAILED; each step's log is kept in $OUT/steps/NN-<name>/log.txt
# Containers are counted by the run id of the child that started them (its CHECK_RUN), so a real suite on the same host does not disturb it.
# Needs Docker and python3. Prints "ok" / "FAIL" per scenario; exit 1 if any failed. Takes about a minute.
#   tools/check-selftest.sh
cd "$(dirname "$0")/.." || exit 1
export ORIGIN="http://127.0.0.1:1"        # dtest.sh serves nothing: the stand-in step needs no site
FAILS=0
verdict() { if [ "$1" -eq 0 ]; then echo "ok   $2"; else echo "FAIL $2"; FAILS=$((FAILS + 1)); fi; }

# --- the child: a shell that sources check.sh without running the suite, then runs one scenario
if [ "$1" = "--child" ]; then
  export OUT="$2/out" CHECK_SOURCE_ONLY=1 CHECK_JOBS=2
  mkdir -p "$OUT"
  if [ "$3" = "slowdocker" ]; then      # a stand-in docker: run is a client that outlives nothing, but its "container" (a marker file) does; ps and rm take 3 s
    mkdir -p "$2/bin"
    printf '#!/bin/bash\ncase "$1" in\n  run) touch "%s/fake-container"; exec sleep 7771 ;;\n  ps) sleep 3; [ -e "%s/fake-container" ] && echo fakecontainer; exit 0 ;;\n  rm) sleep 3; echo "rm $*" >> "%s/docker-calls"; rm -f "%s/fake-container"; exit 0 ;;\nesac\n' "$2" "$2" "$2" "$2" > "$2/bin/docker"
    chmod +x "$2/bin/docker"
    export PATH="$2/bin:$PATH"
  fi
  source tools/check.sh
  echo "$CHECK_RUN" > "$2/run-id"
  case "$3" in
    parallel)
      for k in 1 2 3 4; do queue "stand-in $k" selftest-sleep.mjs 777$k; done
      run_parallel ;;
    slowdocker)
      for k in 1 2; do queue "stand-in $k" selftest-sleep.mjs 777$k; done
      run_parallel ;;
    serial)
      dt_serial "stand-in serial" selftest-sleep.mjs 7775 ;;
    stubborn)
      step "ignores SIGTERM" bash -c 'trap "" TERM; sleep 7781; sleep 7781' selftest-ignore-term ;;
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
stand_ins() { pgrep -f 'selftest-sleep.mjs 777[0-9]|sleep 77[78][0-9]|selftest-ignore-term' | wc -l; }
# containers <dir of a child>: those labelled with that child's run id
containers() { local id; id="$(cat "$1/run-id" 2>/dev/null)"; [ -n "$id" ] || { echo 0; return; }; docker ps -aq --filter "label=arcadia.check=$id" | wc -l; }
# A background job of this (non-interactive) shell has SIGINT ignored, and the child could not trap it: start it with SIGINT restored.
launch() { exec python3 -I -c 'import os, signal, sys; signal.signal(signal.SIGINT, signal.SIG_DFL); os.execvp(sys.argv[1], sys.argv[1:])' bash "$0" --child "$@"; }

# signal_case <label> <scenario> <containers that must be up first> <expected exit code> <signal> [<second signal> <seconds later>]
signal_case() {
  local label="$1" scen="$2" want="$3" code="$4" sig="$5" sig2="${6:-}" late="${7:-1.5}" dir pid rc n=0 i
  dir="$BASE/$label"; mkdir -p "$dir"
  launch "$dir" "$scen" > "$dir/stdout.txt" 2>&1 &
  pid=$!
  for i in $(seq 1 150); do n=$(containers "$dir"); [ "$n" -ge "$want" ] && [ "$(stand_ins)" -gt 0 ] && break; sleep 0.2; done
  echo "$label: before SIG$sig: $(containers "$dir") containers, $(stand_ins) stand-in processes"
  kill -"$sig" "$pid"
  if [ -n "$sig2" ]; then sleep "$late"; kill -"$sig2" "$pid" 2>/dev/null; fi
  wait "$pid"; rc=$?
  sleep 1
  echo "$label: child exit $rc; after: $(containers "$dir") containers, $(stand_ins) stand-in processes"
  [ "$n" -ge "$want" ] && [ "$rc" -eq "$code" ] && [ ! -e "$dir/fake-container" ] && [ "$(containers "$dir")" -eq 0 ] && [ "$(stand_ins)" -eq 0 ]
  verdict $? "$label leaves no step process and no container (exit $rc, wanted $code)"
}

signal_case "SIGTERM during the parallel phase" parallel 2 143 TERM
signal_case "SIGINT during the parallel phase" parallel 2 130 INT
signal_case "SIGHUP during the parallel phase" parallel 2 129 HUP
signal_case "SIGTERM during the serial phase" serial 1 143 TERM
signal_case "SIGTERM to a step that ignores it" stubborn 0 143 TERM
signal_case "SIGTERM, then SIGINT during the container removal" slowdocker 0 130 TERM INT

# --- wait -n gives nothing
dir="$BASE/waitfail"; mkdir -p "$dir"
bash "$0" --child "$dir" waitfail > "$dir/stdout.txt" 2>&1
grep -E '^(---|check.sh|FAILED)' "$dir/stdout.txt"
n=$(grep -c '^FAILED: ' "$dir/stdout.txt")
[ "$n" -eq 4 ] && [ "$(containers "$dir")" -eq 0 ] && [ "$(stand_ins)" -eq 0 ]
verdict $? "when wait returns no finished step, the 2 running and 2 queued steps are all FAILED and none is left running"

# --- a normal run
dir="$BASE/normal"; mkdir -p "$dir"
bash "$0" --child "$dir" normal > "$dir/stdout.txt" 2>&1
grep -E '^(---|FAILED)' "$dir/stdout.txt"
ls "$dir"/out/steps/*/log.txt
[ "$(grep -c '^FAILED: ' "$dir/stdout.txt")" -eq 1 ] && grep -q '^FAILED: stand-in bad$' "$dir/stdout.txt" && [ "$(ls "$dir"/out/steps/*/log.txt | wc -l)" -eq 2 ]
verdict $? "a failing step is the only one FAILED and every step keeps its log.txt"

rm -rf "$BASE"
exit $((FAILS > 0))
