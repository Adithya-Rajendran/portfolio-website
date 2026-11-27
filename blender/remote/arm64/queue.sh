#!/usr/bin/env bash
# queue.ps1 for an ARM64 Linux GPU machine: blender/remote/arm64/queue.sh build|review|probe|backdrop|geom|draft|bake <room>..., each step through live.sh and timed; BACKDROP=1 also redraws window backdrops.
set -euo pipefail
usage() { echo "usage: queue.sh build|review|probe|backdrop|geom|draft|bake <room> [room ...]" >&2; exit 2; }
[[ $# -ge 2 ]] || usage
phase=$1; shift
cd "$(dirname "$0")/../.."
live=$PWD/remote/arm64/live.sh
window() { [[ $1 == lobby || $1 == about || $1 == writing || $1 == comms ]]; }
step() {
  local t0=$SECONDS; echo "== $room $1 start $(date -u +%FT%TZ)"
  "$live" "$1" "$room"
  echo "== $room $1 done in $((SECONDS - t0))s"
}
for room in "$@"; do
  case $room in lobby|about|projects|experience|writing|comms) ;; *) usage;; esac
  t=$SECONDS
  case $phase in
    build|probe) step "$phase";;
    review) step build; step review;;
    backdrop) if window "$room"; then step backdrop; fi;;
    geom) step build; step geom;;
    draft|bake)
      step build; step probe
      if window "$room" && [[ ${BACKDROP:-0} == 1 ]]; then step backdrop; fi
      step "$phase";;
    *) usage;;
  esac
  echo "== $room $phase total $((SECONDS - t))s"
done
