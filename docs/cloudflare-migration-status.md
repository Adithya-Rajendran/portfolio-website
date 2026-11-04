# Cloudflare migration status

Updated November 3, 2026. The owner authorized deployment and moving `adithya-rajendran.com` to Cloudflare Workers after validation.

## Prepared resources

| Resource             | Configuration                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account              | Adithya, `0bd607b9c2e2254ab290285fbf41b2c9`                                                                                                                                                     |
| DNS zone             | `adithya-rajendran.com`, `e4906efa9792d5fa7c4f953d01619753`                                                                                                                                     |
| Worker               | `portfolio-v2`, ID `a6e2680f4dab411eaf44ab81f44e0ee0`                                                                                                                                           |
| Worker address       | `https://portfolio-v2.adithya-0bd.workers.dev` (currently disabled; no version deployed)                                                                                                        |
| Build source         | `Adithya-Rajendran/portfolio-website`, branch `v2-rewrite`                                                                                                                                      |
| Build trigger        | `d2f94f90-39a2-4187-84c0-a7b3fff1412b`                                                                                                                                                          |
| Build command        | `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build`                                                                                                                               |
| Deploy command       | `pnpm exec wrangler deploy --keep-vars` with public runtime `--var` arguments sourced from build variables (Astro emits `.wrangler/deploy/config.json` pointing to `dist/server/wrangler.json`) |
| Build authorization  | Reused existing `portfolio-website build token`; no new general API token created                                                                                                               |
| Turnstile            | New managed widget, `Portfolio v2 contact`; allows `adithya-rajendran.com` and `portfolio-v2.adithya-0bd.workers.dev`                                                                           |
| Observability        | Worker logs enabled; query strings redacted                                                                                                                                                     |
| Sanity Studio access | Exact Worker preview origin added with credentials; production origin already allowed; existing Vercel origins retained for rollback                                                            |

No application version has been deployed and no DNS or domain routing has been changed. The build trigger will deploy when a matching branch revision is pushed, so push only a verified implementation.

## Configuration migration

Runtime configuration is expected to use `SANITY_PROJECT_ID`, `SANITY_DATASET`, optional `SANITY_READ_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES`, `RESEND_API_KEY`, `CONTACT_FORM_TO_EMAIL`, and `CONTACT_FROM_EMAIL`, plus a `CONTACT_RATE_LIMIT` binding. Studio build configuration must match the final implementation.

Cloudflare Builds is configured with Node 24, pnpm 10.34.5, `SANITY_STUDIO_PROJECT_ID`, and `SANITY_STUDIO_DATASET`. Its deploy command injects `SANITY_PROJECT_ID`, `SANITY_DATASET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_HOSTNAMES`, `CONTACT_FROM_EMAIL`, and `GOOGLE_SITE_VERIFICATION` from non-secret build variables. Private credentials are not supplied through command-line arguments. Published Sanity content was verified readable without a token: four published articles, ten projects, and one profile; the optional read token is not needed for these public pages.

Existing Vercel values were located through the connected Vercel account. Secret values are held in session memory and are not recorded here. The first attempt to copy the Resend key was rejected by automatic approval review. The owner subsequently explicitly approved copying the existing credentials to this Worker. Transfers will be completed after the first Worker version exists; the optional Sanity read token is unnecessary for the public dataset. The owner subsequently authorized use of the contact inbox for testing and explicitly instructed moving the domain to Cloudflare because Vercel is paused. Deploy and verify the Worker, then perform the authorized cutover.

## Previous routing for rollback

| Hostname                    | Record ID                          | Type  | Value                                 | Proxied | TTL       |
| --------------------------- | ---------------------------------- | ----- | ------------------------------------- | ------- | --------- |
| `adithya-rajendran.com`     | `c44dc7f557a620ead44db9b9f1e6ecb6` | A     | `216.198.79.1`                        | false   | automatic |
| `www.adithya-rajendran.com` | `6bd00bfcf1f93b9e63786cd78c906dce` | CNAME | `54f5892ef4f16642.vercel-dns-017.com` | false   | automatic |

The domain had no Worker routes or custom Worker domains at discovery. Preserve unrelated DNS records, particularly mail and verification records. Keep the Vercel project available until the new deployment is proven. A rollback after domain attachment must remove the new Worker domain associations and restore these web records, then restore any retired webhook/cron if necessary.

## Launch requirements

Complete the implementation and acceptance checks in `v2-rewrite-plan.md`, provision runtime and Studio build configuration, and verify the deployed Worker address with real published content. Validate contact handling and Studio access before attaching the domain. The owner explicitly approved credential transfer, use of the contact inbox for testing, and moving the domain to Cloudflare. Complete live technical checks, then attach the production domains; no further general launch permission is required.
