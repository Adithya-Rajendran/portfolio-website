# CLAUDE.md

Contributor/agent guide for this repo. Captures contracts that otherwise
only live in comments or commit messages.

## Stack sharp edges

- **Next.js 16 canary** with `cacheComponents: true` and `reactCompiler: true`
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
  tagged with one of the tags from `lib/cache-tags.ts`
  (`CACHE_TAGS.postList`, `CACHE_TAGS.post(slug)`, `CACHE_TAGS.portfolio`).
- The Sanity webhook, `app/api/revalidate/route.ts`, is the **only**
  invalidator. It revalidates `postList` + `post(slug)` when a `post`
  document changes, and `portfolio` when the changed document's `_type` is
  in its `portfolioTypes` array (currently `experience`, `project`,
  `certification`, `skillCategory`, `about`, `intro`). **Adding a new Sanity
  document type that portfolio pages read requires adding it to
  `portfolioTypes` in that route, or it will never revalidate.**
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

## External service contract

- **Resend** — transactional email for the contact form and newsletter.
  Env: `RESEND_API_KEY`, `CONTACT_FORM_TO_EMAIL`, `RESEND_AUDIENCE_ID`,
  `NEWSLETTER_CONFIRM_SECRET`. `actions/sendEmail.ts` and
  `actions/subscribe.ts` both no-op with a friendly error if their required
  vars are missing rather than throwing at module load.
- **Vercel WAF rate limiting** — `actions/sendEmail.ts` and
  `actions/subscribe.ts` call `checkRateLimit()` (`@vercel/firewall`)
  against rules that must exist in the Vercel dashboard (Firewall → Rate
  Limit): `contact-form` and `newsletter-subscribe`. If a rule is absent,
  the SDK returns `error: "not-found"`, a warning is logged, and the form
  still works but is unprotected at that layer — it does not fail closed.
- **Vercel BotID** — invisible bot check. The client protect list is
  registered in `app/layout.tsx` (`<BotIdClient protect={[...]} />`); each
  server action verifies the challenge with `checkBotId()` from
  `botid/server`.
- **Sanity webhook** — `app/api/revalidate/route.ts` requires
  `SANITY_REVALIDATE_SECRET`; if unset, the route 404s on every request
  and cache invalidation is silently disabled.

## Sanity schema changes

Schema fields must be additive/optional — previously published posts and
portfolio content must keep rendering against the new schema. After editing
files in `sanity/schemas/*`:

```
pnpm exec sanity schema extract
pnpm typegen
```

Commit the regenerated `schema.json` and `sanity.types.ts`. Both commands
work without Sanity credentials (they operate on the local schema
definition), so they can run in credential-less sandboxes.

## Tests

`vitest.config.ts` uses `environment: "node"` by design — there is no
jsdom/component-rendering setup in this repo (`tests/` contains only
`*.test.ts`, no rendered-component tests). Component-level verification is
done by running the app (optionally with `SANITY_USE_FIXTURES=1`) and
taking screenshots against the live dev server, not by rendering components
in a simulated DOM.
