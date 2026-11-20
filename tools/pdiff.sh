#!/bin/bash
# Pixel difference of two tools/detsnap.sh sets: max / mean (0-255, worst channel) and share of pixels off by > 2 and > 8.
#   tools/pdiff.sh <nameA> <nameB>   (heat maps into /tmp/detsnap/<nameB>/heat)
D="$(cd "$(dirname "$0")/docker" && pwd)"; mkdir -p "/tmp/detsnap/$2/heat"
docker run --rm --ipc=host -v "$D":/work:ro -v /tmp/detsnap:/snap -v lobby_pw_modules:/w mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
 "cd /w && cp /work/*.mjs . && node pdiff.mjs /snap/$1 /snap/$2 /snap/$2/heat" 2>&1 | grep -v "GL Driver"
