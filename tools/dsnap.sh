#!/bin/bash
# Regression snapshots on the Intel GPU.   tools/dsnap.sh <prefix> name=url [...]   -> /tmp/snap/<prefix>_<name>.png (+ screen canvases)
D="$(cd "$(dirname "$0")/docker" && pwd)"; mkdir -p /tmp/snap; P="$1"; shift; printf '%s\n' "$@" > "/tmp/snap/$P.jobs"
docker run --rm --ipc=host --device /dev/dri -v "$D":/work:ro -v /tmp/snap:/out -v lobby_pw_modules:/w mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
 "cd /w && cp /work/*.mjs . && node snap.mjs $P" 2>&1 | grep -v "GL Driver"
