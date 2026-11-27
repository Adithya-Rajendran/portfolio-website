#!/bin/bash
# Pinned Vale binary in the cache, checked against its hashes, with its path on standard output.
set -euo pipefail
VERSION=3.29.0
ARCHIVE_SHA256=00356ae1bacd1160aa415664f3ed0d34ce9ef5319c61d31123a97366ea1a2f64
BINARY_SHA256=20acd8d863c46e8d3cc8f8270faf8f9ab3419cd67837b872a25dc2dad6e7f123
URL="https://github.com/vale-cli/vale/releases/download/v${VERSION}/vale_${VERSION}_Linux_64-bit.tar.gz"
[ "$(uname -m)" = x86_64 ] || { echo "vale.sh: only x86_64 has a pinned binary" >&2; exit 2; }
if [ -n "${CI_HOME:-}" ]; then CACHE="${CI_HOME%/}/cache/vale"; else CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/arcadia/vale"; fi
DIR="$CACHE/$VERSION"
BIN="$DIR/vale"
mkdir -p "$DIR"
exec 9>"$DIR/.lock"
flock 9
if ! echo "$BINARY_SHA256  $BIN" | sha256sum -c --quiet - >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL --retry 3 -o "$tmp/vale.tar.gz" "$URL" >&2
  echo "$ARCHIVE_SHA256  $tmp/vale.tar.gz" | sha256sum -c --quiet - >&2
  tar -xzf "$tmp/vale.tar.gz" -C "$tmp" vale
  echo "$BINARY_SHA256  $tmp/vale" | sha256sum -c --quiet - >&2
  install -m 0755 "$tmp/vale" "$BIN.new"
  mv -f "$BIN.new" "$BIN"
fi
echo "$BIN"
