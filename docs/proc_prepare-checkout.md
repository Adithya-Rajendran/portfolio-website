---
type: procedure
title: Serve a new checkout
depends: [docs/ref_room-files.md, docs/con_vite-output.md]
---
# Serve a new checkout

Use this procedure to make the rooms and the site of a new checkout, and to serve the site.
Git does not keep the packed rooms or `dist/`.

## Procedure

1. Install the pack tools.
   ```sh
   tools/get-pack-tools.sh
   ```
2. Pack the rooms into [the room files](ref_room-files.md).
   ```sh
   python3 tools/pack.py
   ```
3. Install the packages.
   ```sh
   pnpm install --frozen-lockfile
   ```
4. Make [the Vite output](con_vite-output.md) and the pages in `dist/`.
   ```sh
   pnpm build
   ```
5. Serve `dist/`.
   ```sh
   python3 tools/serve.py <bind address> <port>
   ```

## Verification

- The browser shows the Atrium at `http://<bind address>:<port>/`.
