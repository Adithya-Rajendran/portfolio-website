#!/bin/bash
# Load the page on the GPU browser and print console errors / failed requests.   tools/derr.sh [query]
set -o pipefail
D="$(cd "$(dirname "$0")/docker" && pwd)"
docker run --rm --ipc=host --device /dev/dri -v "$D":/work:ro -v lobby_pw_modules:/w mcr.microsoft.com/playwright:v1.64.1-noble bash -c \
 "cd /w && cp /work/*.mjs . && node errs.mjs 'http://10.0.0.117:8080/$1'" 2>&1 | grep -v "GL Driver"
