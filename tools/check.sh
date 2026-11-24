#!/bin/bash
# Everything for the content and its reading in the rooms, in one command; exit 1 if any step failed (every step is run, then listed).
#   tools/check.sh          env: OUT (host folder for screenshots, default /tmp/dtest), ASSETS (baked rooms; see tools/dtest.sh)
# The browser steps need Docker (tools/dtest.sh serves public/ inside a container). The posts' pages are regenerated first.
cd "$(dirname "$0")/.." || exit 1
FAILED=()
step() { local name="$1"; shift; echo; echo "=== $name"; if "$@"; then echo "--- ok: $name"; else echo "--- FAILED: $name"; FAILED+=("$name"); fi; }
dt() { tools/dtest.sh "$@"; }

step "content.py" python3 tools/content.py
for t in tools/test_*.py; do step "unittest $t" python3 -m unittest "$t"; done
step "site.py" python3 tools/site.py

if [[ " ${FAILED[*]} " == *" site.py "* ]]; then
  echo; echo "site.py failed: there are no pages to test in a browser"
else
  SLUGS=$(basename -a data/posts/*.md | sed 's/\.md$//'); FIRST=$(echo "$SLUGS" | head -1)
  for s in $SLUGS; do step "page.mjs /blog/$s/" dt page.mjs "/blog/$s/"; done
  PROJECTS=$(basename -a data/projects/*.md | sed 's/\.md$//')
  for u in /about/ /portfolio/ /experience/ /contact/; do step "page.mjs $u" dt page.mjs "$u"; done
  for s in $PROJECTS; do step "page.mjs /portfolio/$s/" dt page.mjs "/portfolio/$s/"; done
  step "plaincheck-selftest.mjs" dt plaincheck-selftest.mjs
  step "plainpage.mjs (no JavaScript, no WebGL, 404)" dt plainpage.mjs
  step "library.mjs (desktop, phone, reduced motion)" dt library.mjs all
  step "deeplink.mjs $FIRST (desktop)" dt deeplink.mjs "$FIRST"
  step "deeplink.mjs $FIRST (phone)" dt deeplink.mjs "$FIRST" 390 844
  step "writing-alias.mjs" dt writing-alias.mjs
  step "history.mjs (the address, Back and the reader)" dt history.mjs
  step "rooms.read.mjs (every room at its path; Fabrication's projects read)" dt rooms.read.mjs all
  step "rooms.others.mjs (Navigation, the Lounge, Comms)" dt rooms.others.mjs
  step "rooms.cross.mjs (links from one room's reading into another)" dt rooms.cross.mjs
  step "rooms.deeplink.mjs (a project's and a timeline entry's own address)" dt rooms.deeplink.mjs
  step "hud.mjs (the visitor's display: the lock, names, caption, hint; still unless READ is asked)" dt hud.mjs all
  step "rooms.text.mjs (no explanatory lines; wall screens do nothing)" dt rooms.text.mjs all
  step "opening.mjs (scan, receive, unfold)" dt opening.mjs all
  step "turn.mjs (Navigation's map turns; its hint)" dt turn.mjs all
  step "cue.mjs (the Library's cue; the drone's errand)" dt cue.mjs all
  step "contact.mjs (links, mail, send; legibility)" dt contact.mjs all
  step "hostile.mjs (the rooms against hostile and thin data)" dt hostile.mjs
  step "endpoints.mjs" dt endpoints.mjs
  for u in "/" "/?room=about" "/?room=projects" "/?room=experience" "/?room=comms" "/blog/"; do step "errs.mjs $u" dt errs.mjs "http://127.0.0.1:8080$u"; done
fi

echo; echo "=== summary"
if [ ${#FAILED[@]} -eq 0 ]; then echo "all steps passed"; exit 0; fi
printf 'FAILED: %s\n' "${FAILED[@]}"; exit 1
