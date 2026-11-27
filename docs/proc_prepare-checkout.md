---
type: procedure
title: Serve a new checkout
depends: [docs/ref_room-files.md, docs/con_page-generator.md]
---
# Serve a new checkout

Use this procedure to make the rooms and the pages of a new checkout, and to serve the site.
Git does not keep the packed rooms or the pages.

## Procedure

1. Install the pack tools.
   ```sh
   tools/get-pack-tools.sh
   ```
2. Pack the rooms into [the room files](ref_room-files.md).
   ```sh
   python3 tools/pack.py
   ```
3. Make the pages with [the page generator](con_page-generator.md).
   ```sh
   python3 tools/site.py
   ```
4. Serve the site.
   ```sh
   python3 tools/serve.py <bind address> <port>
   ```

## Verification

- The browser shows the Atrium at `http://<bind address>:<port>/`.
