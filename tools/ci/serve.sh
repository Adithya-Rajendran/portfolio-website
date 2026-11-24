#!/bin/bash
# Serve the prepared checkout for previewing (matching /srv/arcadia/bin/preview-serve).
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec python3 "$ROOT/tools/serve.py" "${1:-0.0.0.0}" "${2:-8080}"
