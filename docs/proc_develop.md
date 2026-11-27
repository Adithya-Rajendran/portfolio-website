---
type: procedure
title: Work on the site with the server of Vite
depends: [docs/proc_prepare-checkout.md, docs/con_vite-output.md]
---
# Work on the site with the server of Vite

Use this procedure to see a change to the scripts or the CSS files in a browser.

## Prerequisites

- You packed the rooms with step 2 of [the procedure to serve a new checkout](proc_prepare-checkout.md).
- Node 24 and pnpm 12.23 are on the computer.

## Procedure

1. Install the packages.
   ```sh
   pnpm install --frozen-lockfile
   ```
2. Start the server of Vite.
   ```sh
   pnpm dev
   ```
3. Open the address that Vite shows in a browser.

## Verification

- The browser shows the Atrium.
- A change to a file in `src/` shows after a new load of the page.

## Additional resources

- [The Vite output](con_vite-output.md)
