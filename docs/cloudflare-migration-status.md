# Cloudflare migration status

Updated November 4, 2026 (UTC). The owner explicitly authorized credential transfer, contact-inbox testing, and moving the domain to Cloudflare. The site is now live on Cloudflare Workers.

## Prepared resources

| Resource             | Configuration                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account              | Adithya, `0bd607b9c2e2254ab290285fbf41b2c9`                                                                                                                                                     |
| DNS zone             | `adithya-rajendran.com`, `e4906efa9792d5fa7c4f953d01619753`                                                                                                                                     |
| Worker               | `portfolio-v2`, ID `a6e2680f4dab411eaf44ab81f44e0ee0`                                                                                                                                           |
| Worker address       | `https://portfolio-v2.adithya-0bd.workers.dev` (enabled; preview content sends noindex headers)                                                                                                 |
| Build source         | `Adithya-Rajendran/portfolio-website`, branch `v2-rewrite`                                                                                                                                      |
| Build trigger        | `d2f94f90-39a2-4187-84c0-a7b3fff1412b`                                                                                                                                                          |
| Build command        | `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build`                                                                                                                               |
| Deploy command       | `pnpm exec wrangler deploy --keep-vars` with public runtime `--var` arguments sourced from build variables (Astro emits `.wrangler/deploy/config.json` pointing to `dist/server/wrangler.json`) |
| Build authorization  | Reused existing `portfolio-website build token`; no new general API token created                                                                                                               |
| Turnstile            | New managed widget, `Portfolio v2 contact`; allows `adithya-rajendran.com` and `portfolio-v2.adithya-0bd.workers.dev`                                                                           |
| Observability        | Worker logs enabled; query strings redacted                                                                                                                                                     |
| Sanity Studio access | Exact Worker preview origin added with credentials; production origin already allowed; existing Vercel origins retained for rollback                                                            |

Application commit `a66dd83ccc35a3487cff048ea1e16e848de09b9e` was pushed to `v2-rewrite` and deployed successfully by Cloudflare build `e1dbce6e-b4a8-4661-b700-28ec0a38c4ba`. The initial application version was `d4761558-9112-4137-a970-9aa04aa45cec`; secret updates create subsequent versions. Future pushes to `v2-rewrite` deploy automatically after lint, typecheck, coverage and build checks. Main was not merged.

Both production hostnames are attached to `portfolio-v2`: apex domain association `3b18108aef24b935d14ee847c842ab34c1e8b2ec` and www association `5c258e9b6758968f8d60f8a608c63046a22552f1`. Cloudflare created proxied AAAA origin placeholders (`100::`) for them after the two old web records were removed. Mail, TXT, CAA, wildcard and other unrelated records were left untouched. Wrangler now declares both custom domains, `workers_dev`, `keep_vars`, and observability with query-string redaction so later deployments preserve this setup.

## Configuration migration

Runtime configuration is expected to use `SANITY_PROJECT_ID`, `SANITY_DATASET`, optional `SANITY_READ_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES`, `RESEND_API_KEY`, `CONTACT_FORM_TO_EMAIL`, and `CONTACT_FROM_EMAIL`, plus a `CONTACT_RATE_LIMIT` binding. Studio build configuration must match the final implementation.

Cloudflare Builds is configured with Node 24, pnpm 10.34.5, `SANITY_STUDIO_PROJECT_ID`, and `SANITY_STUDIO_DATASET`. Its deploy command injects `SANITY_PROJECT_ID`, `SANITY_DATASET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_HOSTNAMES`, `CONTACT_FROM_EMAIL`, and `GOOGLE_SITE_VERIFICATION` from non-secret build variables. Private credentials are not supplied through command-line arguments. Published Sanity content was verified readable without a token: four published articles, ten projects, and one profile; the optional read token is not needed for these public pages.

The approved `RESEND_API_KEY`, `CONTACT_FORM_TO_EMAIL`, and newly generated `TURNSTILE_SECRET` were successfully stored as Worker secret bindings. The optional Sanity read token was not copied because the public dataset works without it. No secret values are committed or printed. The initial automatic approval rejection was resolved by the owner's explicit credential-transfer approval.

## Live verification

- Cloudflare's hosted build passed lint, Astro checking, all 510 unit tests with coverage thresholds, production build, and deployment.
- Chromium verified HTTP 200 for the Worker preview's home, blog, real article, projects, real project, experience, About, contact, feed, sitemap and Studio shell, plus a genuine 404 for an unknown article. Dynamic preview responses send `X-Robots-Tag: noindex, nofollow`. No application page exceptions occurred.
- On the production domain, home, real article/project, experience, contact, feed and sitemap returned 200 over valid HTTPS from Cloudflare. The production pages are indexable; an unknown article returns 404. The www hostname returns 308 to the apex while preserving the full path and query.
- Production Studio remains behind the existing Cloudflare Access login. That policy was preserved; authenticated editing was not tested and no CMS content was changed.
- One authorized test email was sent directly through Resend using the configured sender/recipient and API key. Resend returned 200 and an accepted email ID. Its delivery-status endpoint returned 401, so inbox delivery was not independently confirmed. This validates provider acceptance, not the entire contact-form flow.
- The live contact form and Turnstile script/challenge load. The automated browser could not obtain a challenge token: a Cloudflare challenge subdomain failed DNS resolution and the private-token request returned 401. There was no identified application exception or parent-page CSP failure. Human Turnstile completion and an end-to-end form submission remain unverified; no verification bypass was introduced. Server validation, token/replay failure, rate limits and Resend refusal are covered by local contract tests.

## Previous routing for rollback

| Hostname                    | Record ID                          | Type  | Value                                 | Proxied | TTL       |
| --------------------------- | ---------------------------------- | ----- | ------------------------------------- | ------- | --------- |
| `adithya-rajendran.com`     | `c44dc7f557a620ead44db9b9f1e6ecb6` | A     | `216.198.79.1`                        | false   | automatic |
| `www.adithya-rajendran.com` | `6bd00bfcf1f93b9e63786cd78c906dce` | CNAME | `54f5892ef4f16642.vercel-dns-017.com` | false   | automatic |

The domain had no Worker routes or custom Worker domains at discovery. Preserve unrelated DNS records, particularly mail and verification records. Keep the Vercel project available until the new deployment is proven. A rollback after domain attachment must remove the new Worker domain associations and restore these web records, then restore any retired webhook/cron if necessary.

## Remaining operational checks

Review the live design and complete a human contact-form submission and authenticated Studio session. The implementation report records intentionally changed graphics and print behavior and the limits of performance measurements. The old `Revalidate Next.js` Sanity webhook still targets `/api/revalidate`; it is obsolete because v2 reads published data directly. The connected Sanity CLI exposes deletion but not disabling or exporting all webhook settings, so it was retained for separate retirement rather than discarded without a full rollback copy. Vercel was already paused according to the owner; its project was retained and its historical deployed cron was not changed. The branch removes `vercel.json` and all Next cron/revalidation handlers.

Keep this rollback record until the new deployment is proven. If rollback is needed, remove the two Worker domain associations, recreate the old A/CNAME records above using their recorded values, and resume Vercel as needed. Old record IDs no longer exist after deletion. Do not change mail or verification records.
