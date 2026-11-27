#!/bin/bash
# Move of the site sources from public/ into the layout of the Vite build, with the map of old and new paths
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
MAP=tools/migrate/f1-map.txt
: > "$MAP"

move() {
  mkdir -p "$(dirname "$2")"
  git mv "$1" "$2"
  printf '%s\t%s\n' "$1" "$2" >> "$MAP"
}

move public/index.html index.html
move public/main.js src/main.js
for f in $(git ls-files public/js); do
  case "$f" in
    public/js/blueprint.js|public/js/asset.js) move "$f" "src/pages/${f#public/js/}" ;;
    *) move "$f" "src/engine/${f#public/js/}" ;;
  esac
done
move public/blueprint.html src/pages/blueprint.html
move public/asset.html src/pages/asset.html
move public/style.css src/styles/style.css
move public/post.css src/styles/post.css
for f in $(git ls-files public/vendor/jsm/libs/basis); do
  move "$f" "public/vendor/basis/${f##*/}"
done
for f in $(git ls-files public/vendor); do
  case "$f" in
    public/vendor/basis/*) ;;
    *) git rm -q "$f"; printf '%s\t-\n' "$f" >> "$MAP" ;;
  esac
done
