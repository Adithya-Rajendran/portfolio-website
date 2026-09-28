# CLAUDE.md

Contributor/agent guide for this repo. Captures contracts that otherwise
only live in comments or commit messages.

## Stack sharp edges

- **Next.js 16 (latest stable)** with `cacheComponents: true` and `reactCompiler: true`
  (`next.config.mjs`), plus `"use cache"` directives in `lib/sanity-client.ts`
  and `lib/highlight-code.ts`. Cache/Suspense placement errors from these
  features surface **only at build time** — lint and typecheck cannot catch
  them. Always run the full gate before considering a change done:

    ```
    pnpm lint && pnpm typecheck && pnpm format:check && pnpm test
    NEXT_PUBLIC_STORE_SANITY_PROJECT_ID=fallback pnpm build
    pnpm test:e2e
    ```

    `fallback` is the sentinel `lib/sanity-config.ts`'s `isSanityConfigured`
    treats as "not configured": the Sanity Studio route still prerenders (it's
    a valid project-id-shaped string) while every data fetcher short-circuits
    to empty content with zero network I/O — this is how CI builds without
    real Sanity credentials (`.github/workflows/node.js.yml`).

- **Tailwind v4 is CSS-first.** There is no `tailwind.config.js`. Design
  tokens, theme colors, radii, and custom animations live directly in
  `app/globals.css` under `@theme inline`. It is imported by
  `components/chrome/site-shell.tsx`, so it loads on public pages only.

## Layout: the `(site)` route group

- `app/layout.tsx` is the minimal root layout shared by the public site and
  the Studio: `<html>`, fonts, BotID and route-independent metadata only.
  Do not add site CSS, chrome, JSON-LD or analytics there.
- Every public page lives under `app/(site)/` (route groups do not change
  URLs). `app/(site)/layout.tsx` renders `components/chrome/site-shell.tsx`:
  the global stylesheets, the server-rendered header and footer, JSON-LD
  and analytics. They are part of each page's static shell, so the chrome
  works without JavaScript and page content is rendered once. New public
  routes go under `app/(site)/`; `app/studio/` stays outside the group, so
  none of this loads in the Studio.
- Never wrap page content in `<Suspense fallback={children}>`, and keep
  anything that must work without JavaScript out of Suspense: in a long
  page React streams a completed boundary holding more than ~500 bytes as
  a hidden segment that only JavaScript reveals, showing the fallback
  meanwhile. Async Server Components that read cached data (the footer,
  the pages) need no boundary. A client component that reads the URL
  (`usePathname`) can suspend under Cache Components, so it sits in a
  small leaf `<Suspense>` with a static fallback (`ActiveNavLinks` in the
  header, `BlogNav`); larger URL-dependent UI takes its variant as a prop
  from the page instead (`PortfolioNav`).
- `app/(site)/not-found.tsx` renders `notFound()` calls inside pages;
  `app/not-found.tsx` renders unmatched URLs and wraps the same content in
  `SiteShell`, because it sits outside the group.
- Metadata image routes inside a route group get a stable `-<hash>` URL
  suffix from Next.js (`/about/opengraph-image-1ycygp`; `next build` prints
  them). Anything that requests them directly, like the warm list
  (`lib/og-image-paths.ts`, used by `actions/warmCache.ts`), uses the built
  URL; a Vitest test recomputes each one and the e2e smoke spec requests
  each one from a real build.

## Caching contract

- Every Sanity read must go through `sanityFetch` in `lib/sanity-client.ts`,
  tagged with exactly one of `CACHE_TAGS.profile`, `CACHE_TAGS.post`, or
  `CACHE_TAGS.project` from `lib/cache-tags.ts`.
- There are exactly **two** invalidators:
    1. The Sanity webhook, `app/api/revalidate/route.ts`. It revalidates
       the matching type tag when a `profile`, `post`, or `project` document
       changes. Adding a new frontend query requires choosing one of those
       three ownership tags and adding its webhook dispatch deliberately.
    2. The daily Vercel Cron, `app/api/cron/publish-due/route.ts`
       (schedule in `vercel.json`, 00:05 UTC). `publishedAt` is a date and
       visibility is gated by `publishedAt <= $today`, so a future post
       crosses the gate on its UTC date without a document change. The cron
       performs an uncached query for posts dated today and revalidates the
       `post` tag. Auth is
       `Authorization: Bearer ${CRON_SECRET}` (Vercel attaches it
       automatically); missing/wrong auth → stealth 404. If `CRON_SECRET`
       is unset, same-day publishing silently degrades to the pages' daily
       cache revalidation.
- Derived artifacts that include the post list (`app/feed.xml/route.ts`,
  `app/sitemap.ts`) use `cacheLife("days")`, never `"max"`: a post whose
  `publishedAt` arrives must reach them within a day even if the cron is
  missing, because their tags only fire on the webhook or the cron.
- Cache keys are derived from the literal GROQ query string passed into
  `sanityFetch`/`"use cache"`. Reformatting a query string (whitespace,
  line breaks) changes the cache key and silently orphans the old cache
  entry. Harmless (the old entry just goes cold), but worth knowing when a
  cache "isn't updating" after a query edit.
- `lib/highlight-code.ts` has a `HIGHLIGHT_MARKUP_VERSION` constant that
  participates in its cache key. Bump it whenever the emitted markup's CSS
  contract changes (themes, classes, structure) — the data cache persists
  across deploys, so a code-only change does not itself invalidate
  previously cached highlighted HTML.

## Local development

- `SANITY_USE_FIXTURES=1 pnpm dev` serves credential-less fixture content
  from `lib/fixtures.ts`. The fixture resolver is only consulted on the
  fallback path in `sanityFetch`, i.e. only when Sanity is **not**
  configured — a deployment with real credentials can never serve fixtures
  regardless of this flag.
- To use real content locally, set `NEXT_PUBLIC_STORE_SANITY_PROJECT_ID`
  and `NEXT_PUBLIC_STORE_SANITY_DATASET` in `.env.local` — the production
  dataset is public-read, so no read token is required for published
  content.
- In proxied/sandboxed environments, Node's `fetch` (undici) ignores
  `HTTP_PROXY`/`HTTPS_PROXY` env vars by default. If Sanity requests need
  to go through a proxy, set `NODE_USE_ENV_PROXY=1` and
  `NODE_EXTRA_CA_CERTS=<proxy CA bundle path>`.
- Never `rm -rf .next` while a dev server is running — with
  `cacheComponents` enabled this can leave the running server referencing
  build artifacts that no longer exist and crash it.
- Turbopack's persistent dev cache (`.next/dev/cache`) can serve a stale
  compile of `app/globals.css` across dev-server restarts — if a CSS edit
  "doesn't apply", make any real content change to the file (or clean
  `.next` with the server stopped) to force a recompile.

## External service contract

- **Resend** — transactional email for the contact form. Env:
  `RESEND_API_KEY` and `CONTACT_FORM_TO_EMAIL`. `actions/sendEmail.ts`
  no-ops with a friendly error if its required vars are missing rather than
  throwing at module load.
- **Vercel WAF rate limiting** — `actions/sendEmail.ts` calls
  `checkRateLimit()` (`@vercel/firewall`) against the `contact-form` rule in
  the Vercel dashboard (Firewall → Rate Limit). If the rule is absent,
  the SDK returns `error: "not-found"`, a warning is logged, and the form
  still works but is unprotected at that layer — it does not fail closed.
- **Vercel BotID** — invisible bot check. The client protect list is
  registered in `app/layout.tsx` (`<BotIdClient protect={[...]} />`); each
  server action verifies the challenge with `checkBotId()` from
  `botid/server`.
- **Sanity webhook** — `app/api/revalidate/route.ts` requires
  `SANITY_REVALIDATE_SECRET`; if unset, the route 404s on every request
  and cache invalidation is silently disabled.
- **Vercel Cron** — `vercel.json` schedules `/api/cron/publish-due` daily
  (Hobby plan allows daily crons; times are approximate, within the hour).
  Requires `CRON_SECRET` in the project's Vercel env. Crons only run on
  the **production** deployment — previews never trigger them, so test by
  invoking the route manually with the bearer header.
- **Vercel platform toggles** (dashboard, not code): **Skew Protection**
  (Project → Settings → Advanced) keeps in-flight clients pinned to their
  deployed version across deploys — worth enabling since server actions
  (the contact form) can break ungracefully on version skew. The
  **Vercel Toolbar** on previews is the review surface for this repo's
  preview-gate workflow (comments land in the dashboard; the
  `@vercel/toolbar` package is deliberately not installed — the injected
  preview toolbar is enough).

## Sanity schema changes

The repository is the schema source of truth. Define fields with Sanity's
`defineType`, `defineField`, and `defineArrayMember`; never deploy an
MCP-managed schema alongside this Studio. Breaking changes require a named,
reviewable migration under `migrations/`. After editing the schema or named
`defineQuery` constants:

```
pnpm typegen
```

Load `NEXT_PUBLIC_STORE_SANITY_PROJECT_ID` and
`NEXT_PUBLIC_STORE_SANITY_DATASET` from the local environment before running
Sanity commands; never commit their concrete values.

Commit the regenerated `schema.json` and `sanity.types.ts`. Schema extraction
and TypeGen are local; dataset export, migration execution, and schema
deployment require an authenticated Sanity CLI session.

- Option lists that both the schema and the site read (availability status,
  link kinds, employment types, date precision…) live in
  `lib/profile-fields.ts`, which has no imports because the Studio bundles
  it. Sanity checks a value against `options.list` only when the field
  declares a validation rule, so an optional list field uses
  `validation: listValuesOnly`.
- `PROFILE_QUERY_RESULT` must stay assignable to the hand-written
  `ProfileData`; `tests/lib/profile-fields.test.ts` checks this in
  `pnpm typecheck`.
- Real content only. A date known only to the year is stored as any day in
  that year with precision `year` (`timelineEntry.startPrecision`,
  `profile.launch.precision`), and the site prints the year alone
  (`formatTimelineDate` in `lib/profile-content.ts`). Never print a month or
  day the owner has not given.
- No public email address or phone number anywhere: pages, JSON-LD, RSS, OG
  images, the console or the printed CV. Contact is the form only, so there is
  deliberately no `publicEmail` field, and `externalLink` accepts http(s)
  URLs only.

## Tests

- **Vitest** (`pnpm test`, `tests/**/*.test.ts`) covers pure logic.
  `vitest.config.ts` uses `environment: "node"` by design: there is no
  jsdom or component-rendering setup. Anything that needs a browser is a
  Playwright spec.
- **Playwright** (`tests/e2e/*.spec.ts`, Chromium, `playwright.config.ts`)
  covers the built site: `smoke` (every page returns its status with one
  `h1` and one `main`, no console errors, uncaught exceptions or CSP
  violations; share images, feed, icons, headers, redirects, the Studio
  without chrome), `nojs` (complete pages without JavaScript: header, nav,
  footer, no hidden streamed segments, nothing rendered twice), `a11y`
  (axe, WCAG 2.2 AA + best practice, at 390 and 1440 px), `layout` (no
  sideways scroll at 320–1440 px), `budgets` (the brotli byte report, printed,
  not enforced yet) and `screens` (review screenshots and the `/resume`
  print PDF, attached to the HTML report).
    - `pnpm test:e2e` runs the `fixture` project: Playwright builds the site
      with `NEXT_PUBLIC_STORE_SANITY_PROJECT_ID=fallback` and
      `SANITY_USE_FIXTURES=1` (this overwrites `.next`), then serves it with
      `next start` on port 3100 (`E2E_PORT`). Off-origin requests are
      stubbed, so the run is offline. Locally a server already on the port is
      reused: start a fixture build by hand to iterate on specs quickly.
    - `pnpm test:e2e:preview` runs the same specs against a deployment:
      `BASE_URL=<url>`, plus `VERCEL_AUTOMATION_BYPASS_SECRET` for protected
      previews (sent to that origin only). CI runs it on every successful
      Vercel preview (`.github/workflows/e2e-preview.yml`); it is skipped
      with a notice while that repository secret is missing.
    - First run: `pnpm exec playwright install chromium` (add
      `--with-deps` on a machine without Chromium's system libraries).
    - Pages come from `tests/e2e/support/routes.ts`: the static pages, plus
      posts, tags and projects read from `/sitemap.xml` at run time, so the
      same specs fit fixture and real content. A new public route is added
      there or reaches the sitemap.
    - Select by role (`getByRole`), not CSS: Cache Components keeps visited
      routes mounted but hidden, and role queries skip hidden content.
    - axe exceptions live only in `AXE_ALLOWANCES`
      (`tests/e2e/support/axe.ts`), each with a reason and the PR that
      removes it. Known defects are `test.fail(...)` with a comment, never
      skipped, so fixing one turns the test red until the marker goes.
- Reports land in `playwright-report/` and `test-results/` (ignored); CI
  uploads the report as an artifact.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
