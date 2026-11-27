---
type: procedure
title: Deploy the site
depends: [docs/proc_prepare-checkout.md]
---
# Deploy the site

Use this procedure to publish `public/` to Cloudflare.
`npx wrangler deploy` uploads `public/` as it is, with the configuration in `wrangler.jsonc` and the cache rules in `public/_headers`.

## Prerequisites

- You installed the pack tools with step 1 of [the procedure to serve a new checkout](proc_prepare-checkout.md).
- You have access to the site on Cloudflare.

## Procedure

1. Pack the rooms.
   ```sh
   python3 tools/pack.py
   ```
2. Make the pages.
   ```sh
   python3 tools/site.py
   ```
3. Deploy the site.
   ```sh
   npx wrangler deploy
   ```

## Verification

- The output of `wrangler` shows no error.
- The upload does not include the files in `public/.assetsignore`.
