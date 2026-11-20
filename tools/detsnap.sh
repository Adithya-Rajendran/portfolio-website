#!/bin/bash
# Deterministic 1920x1080 snapshots of a fixed list of states (fake clock, seeded randomness; see docker/detsnap.mjs).
#   [ORIGIN=http://host:port] [ONLY=<regex>] tools/detsnap.sh <name> [frames]   -> /tmp/detsnap/<name>/<state>.png
# Compare two sets with tools/pdiff.sh <nameA> <nameB>. Two runs of the same code differ by exactly 0.
D="$(cd "$(dirname "$0")/docker" && pwd)"; O="/tmp/detsnap/$1"; mkdir -p "$O"; J=()
for r in lobby about; do
  for a in 0 45 90 180 300; do J+=("$r-hero-r$a=?room=$r&shot=hero&scale=1&tier=0&chand=30&rollat=$a"); done
  J+=("$r-close-r90=?room=$r&shot=close&scale=1&tier=0&chand=30&rollat=90" "$r-hero-r45-t1=?room=$r&shot=hero&scale=1&tier=1&chand=30&rollat=45")
  J+=("$r-hero-roll=?room=$r&shot=hero&scale=1&tier=0" "$r-hero-roll6=?room=$r&shot=hero&scale=1&tier=0&roll=6")
  J+=("$r-focus0=?room=$r&shot=hero&scale=1&tier=0&chand=30&rollat=45&focus=0" "$r-focus1=?room=$r&shot=hero&scale=1&tier=0&chand=30&rollat=45&focus=1")
done
J+=("projects-hero=?room=projects&shot=hero&scale=1&tier=0" "experience-hero=?room=experience&shot=hero&scale=1&tier=0")
[ -n "$ONLY" ] && J=($(printf '%s\n' "${J[@]}" | grep -E "$ONLY"))
docker run --rm --ipc=host --device /dev/dri -v "$D":/work:ro -v "$O":/out -v lobby_pw_modules:/w mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
 "cd /w && cp /work/*.mjs . && node detsnap.mjs ${ORIGIN:-http://10.0.0.117:8080} /out ${2:-150} $(printf "'%s' " "${J[@]}")" 2>&1 | grep -v "GL Driver"
