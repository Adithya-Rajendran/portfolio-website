#!/bin/bash
# Median frame time on the Intel GPU at 1080p for each query
for q in "$@"; do echo "$(./dperf.sh "?shot=hero&$q" 1920 1080 6 | python3 -c "import json,sys; d=json.loads(sys.stdin.readline()); print('median %5.1f ms  p95 %5.1f  calls %d  scene %s mirror %s msaa %s' % (d['median_ms'], d['p95_ms'], d['calls'], d['mode']['size'], d['mode']['mirror'], d['mode']['msaa']))")   <- $q"; done
