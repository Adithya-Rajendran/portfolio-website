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
    ```

    `fallback` is the sentinel `lib/sanity-config.ts`'s `isSanityConfigured`
    treats as "not configured": the Sanity Studio route still prerenders (it's
    a valid project-id-shaped string) while every data fetcher short-circuits
    to empty content with zero network I/O — this is how CI builds without
    real Sanity credentials (`.github/workflows/node.js.yml`).

- **Tailwind v4 is CSS-first.** There is no `tailwind.config.js`. Design
  tokens, theme colors, radii, and custom animations live directly in
  `app/globals.css` under `@theme inline`.

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

## Tests

`vitest.config.ts` uses `environment: "node"` by design — there is no
jsdom/component-rendering setup in this repo (`tests/` contains only
`*.test.ts`, no rendered-component tests). Component-level verification is
done by running the app (optionally with `SANITY_USE_FIXTURES=1`) and
taking screenshots against the live dev server, not by rendering components
in a simulated DOM.
