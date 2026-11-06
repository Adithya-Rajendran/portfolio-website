# Adithya Rajendran's portfolio

An Astro and TypeScript portfolio hosted on Cloudflare Workers, with Sanity for published content, an isolated Sanity Studio, Three.js visualizations, and Resend for contact delivery. See [the migration plan](docs/v2-rewrite-plan.md) and [implementation report](docs/v2-implementation-report.md) for the design decisions and verification status.

## Local development

Use Node 24 and pnpm 10.34.5. Install with `pnpm install --frozen-lockfile`. Set `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` to the public Sanity identifiers before `pnpm build`; the build creates the Studio under `/studio` and then builds the Worker. The runtime requires `SANITY_PROJECT_ID` and `SANITY_DATASET`; add an optional `SANITY_READ_TOKEN` only if the published dataset requires it. Use an ignored `.dev.vars` file for local Worker configuration, never commit secrets. Run `pnpm build` followed by `pnpm start` to exercise the built Worker. `pnpm dev` starts Astro development mode.

Run `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test`, and `pnpm test:e2e` before changes are considered ready. Browser tests need Playwright Chromium (`pnpm exec playwright install chromium`). Fixtures are compiled only in the explicit test-mode build; production builds cannot enable them by setting an environment variable.

## Runtime configuration

The contact form requires `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES` (comma-separated exact hostnames), `RESEND_API_KEY`, `CONTACT_FORM_TO_EMAIL`, `CONTACT_FROM_EMAIL` (a verified sender), and the `CONTACT_RATE_LIMIT` Worker binding. Keep the secret, recipient, and API key in Cloudflare secrets. Production hostname allowlists must not include localhost. The form fails closed when verification, rate limiting, or delivery configuration is missing. The rate limit is per Cloudflare location and eventually consistent; it is not a global sending quota. No automated test sends real email.

CMS-backed pages and XML fetch published content on each request without a shared content cache, so edits, deletions, and scheduled dates take effect on the next request at the cost of additional origin calls. A missing CMS configuration or an upstream failure surfaces as an error rather than an empty site. Measure before introducing caching, and define publication and deletion guarantees first.

Agents can start at `/llms.txt`, a request-time index of the published writing, projects and main pages. Every public page advertises the guide and sitemap in its HTML head. The existing HTML pages and full RSS feed are readable without JavaScript or WebGL. The guide uses the same published-content queries as the site and returns upstream errors rather than stale or incomplete success responses.

Contact is for humans: robots.txt excludes `/contact`, its `/comms` alias, `/api/` and `/studio`, and the sitemap and agent guide omit those destinations. These are crawler directions, not access controls. The contact handler independently requires a valid Turnstile token with the exact action and hostname, origin validation and rate limiting; there is no agent bypass. Cloudflare access settings are documented in [the security configuration](docs/cloudflare-security.md).

## Deployment and rollback

The Cloudflare adapter produces the Worker and static assets in `dist`. Run `pnpm build` and `pnpm exec wrangler deploy --dry-run` before deployment; `pnpm exec wrangler deploy` deploys the built Worker. Cloudflare Builds supplies the public Studio build variables and runtime public identifiers. Configure secrets separately, configure the rate-limit binding, and allow the exact preview and production Studio origins in Sanity CORS. The preview must remain noindex.

Before routing the domain, compare live pages and assets, validate Studio authentication and PDF delivery, test a permitted contact send and Turnstile replay rejection, check headers and redirects, and monitor Worker limits and latency. At cutover disable the old Sanity revalidation webhook and Vercel publishing cron. Retain the old deployment and configuration until the replacement is stable. Roll back by restoring the prior domain routing and the webhook/cron configuration; this migration does not alter Sanity content.

Source code is MIT licensed; authored content has a separate license in [LICENSE-CONTENT.md](LICENSE-CONTENT.md). Font and imagery licenses remain with their assets.

## Editorial workflow

Use the [writing guide](docs/writing-style.md) for voice, evidence, and review, and the [article templates](docs/article-template.md) for drafting and publishing fields. Sanity owns article takeaways, dedicated sharing images, and an optional suggested next article. The article page renders these alongside the author and follow links; missing optional fields have useful fallbacks.
