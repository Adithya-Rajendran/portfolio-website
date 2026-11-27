---
type: procedure
title: Deploy the site
depends: [docs/proc_prepare-checkout.md, docs/con_vite-output.md]
---
# Deploy the site

Use this procedure to publish `dist/` to Cloudflare.
`npx wrangler deploy` uploads `dist/`, with the configuration in `wrangler.jsonc` and the cache rules in `public/_headers`.

## Prerequisites

- You installed the pack tools with step 1 of [the procedure to serve a new checkout](proc_prepare-checkout.md).
- You have access to the site on Cloudflare.

## Procedure

1. Pack the rooms.
   ```sh
   python3 tools/pack.py
   ```
2. Install the packages.
   ```sh
   pnpm install --frozen-lockfile
   ```
3. Make [the Vite output](con_vite-output.md) and the pages.
   ```sh
   pnpm build
   ```
4. Deploy the site.
   ```sh
   npx wrangler deploy
   ```

## Verification

- The output of `wrangler` shows no error.
- The upload does not include the files in `public/.assetsignore`, which `pnpm build` copies to `dist/.assetsignore`.
