#!/bin/bash
# Preparation of a checkout for a preview
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

in_ci_preview=0
if [ -n "${CI_HOME:-}" ]; then
  CI_HOME="${CI_HOME%/}"
  case "$ROOT" in
    "$CI_HOME"/preview/*) in_ci_preview=1 ;;
  esac
fi

if [ -n "${CI_HOME:-}" ]; then
  key="$(find assets-src tools/pack.py -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -c1-20)"
  ASSETS="$CI_HOME/cache/assets/$key"
  mkdir -p "$CI_HOME/cache/assets"
  (
    flock 9
    if [ ! -d "$ASSETS" ]; then
      rm -rf public/assets
      if [ "$in_ci_preview" -eq 1 ]; then
        python3 tools/pack.py > ../pack.log 2>&1
      else
        python3 tools/pack.py
      fi
      tmp_assets="$CI_HOME/cache/assets/.tmp-$key-$$"
      rm -rf "$tmp_assets"
      mv public/assets "$tmp_assets"
      mv "$tmp_assets" "$ASSETS"
    fi
  ) 9>"$CI_HOME/cache/pack.lock"
  rm -rf public/assets
  ln -s "$ASSETS" public/assets
else
  if [ ! -d public/assets ] || [ -z "$(ls -A public/assets 2>/dev/null)" ]; then
    python3 tools/pack.py
  fi
fi

if [ "$in_ci_preview" -eq 1 ]; then
  python3 tools/site.py > ../site.log 2>&1
else
  python3 tools/site.py
fi
