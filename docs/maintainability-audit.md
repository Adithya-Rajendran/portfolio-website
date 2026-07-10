# Maintainability Audit — V3 branch

**Date:** 2026-07-10 · **Scope:** whole codebase (~11.9k LOC of app/components/lib/actions/email/tests/sanity) · **Method:** 7 parallel dimension auditors (duplication, single-source drift, type safety, complexity, caching contracts, test architecture, docs/dependency hygiene), each finding adversarially verified against the code with quoted evidence before acceptance.

**Result: 41 findings → 37 confirmed, 3 downgraded, 1 refuted.** 17 confirmed findings qualified as safe (behavior-preserving, individually revertible) and were applied on this branch; the rest are a prioritized backlog below.

## Overall assessment

The codebase is in good shape for a 2-year content run: one cached Sanity fetch wrapper with a tiny tag taxonomy, a hardened-by-default form pattern, generated schema types, and a green five-step CI gate. The dominant debt themes are (1) **convention-enforced contracts** — the cache-tag/webhook coupling, the fixture resolver's query matching, and the typegen freshness all relied on discipline rather than checks (the worst of these now have guards or documentation), and (2) **copy-paste drift** in presentation code (grids, pills, skeletons, email boilerplate) that is cheap individually but compounds across a redesign.

## Applied on this branch (safe fixes)

| Area          | Fix                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts     | **`CLAUDE.md` (new)** — contributor/agent guide: canary build gotchas + full gate command, cache-tag/webhook contract (incl. "new document type ⇒ update `portfolioTypes`"), fixture mode, real-content dev setup, external-service env contract (Resend/WAF rules/BotID/webhook secret), Sanity schema-change workflow, test-architecture rationale |
| Contracts     | **CI typegen drift guard** — `.github/workflows/node.js.yml` now runs `sanity schema extract` + `typegen` and fails on any diff, so committed `schema.json`/`sanity.types.ts` can no longer silently drift from the schema code                                                                                                                      |
| Single source | **`publishedPost()` filter** — the six copy-pasted `_type == "post" && date <= $today` predicates in `lib/sanity-client.ts` collapse into one definition of "published" (emitted query strings proven byte-identical, so no cache keys were orphaned)                                                                                                |
| Single source | **`POST_GRID_CLASSES`** — the post-card grid string is defined once in `components/blogs/utils.ts` and shared by `latest.tsx`, `featured.tsx` (3+ branch), the index ShowMorePosts + skeleton, and the tag-page skeleton; also fixes the skeleton's missing `sm:gap-6` (visible spacing snap when content streamed in)                               |
| Single source | **`BLOG_DESCRIPTION`** — blog copy now lives in `lib/config.ts`, consumed by the blogs layout metadata and the Blog JSON-LD (the RSS channel description is intentionally different text and stayed in `lib/feed.ts`)                                                                                                                                |
| Single source | **`TAG_PATTERN`** — `sanity/schemas/post.ts` now imports the app's tag regex instead of redefining it, so Studio validation and URL routing can never disagree                                                                                                                                                                                       |
| Single source | **`THEME_COLORS` cross-link** — `app/globals.css` now carries the reciprocal "change both together" comment next to the canvas custom properties                                                                                                                                                                                                     |
| Robustness    | **Fixture resolver** — coupling/order-sensitivity documented and unmatched post queries now log a dev warning instead of silently returning empty content                                                                                                                                                                                            |
| Robustness    | **Cache warming** — `warmBlogCache` now also warms `/blogs/archive` and every `/blogs/tags/<tag>` page (they were cold on first hit after every publish)                                                                                                                                                                                             |
| Hygiene       | **Root layout** — the ~60-line inline SVG filter defs moved verbatim to `components/glass-filters.tsx`                                                                                                                                                                                                                                               |
| Hygiene       | **Dead dependency pin** — removed the `follow-redirects` pnpm override (package no longer in the tree)                                                                                                                                                                                                                                               |
| Docs          | **README corrections** — contact form actually uses Resend (not "React Email and Nodemailer"), dropped the stale Framer Motion claim, noted blog tags/archive/search/RSS/newsletter; **`.env.example`** documents the two required Vercel WAF rule IDs; **`vitest.config.ts`** records why the env is node (screenshots, not jsdom)                  |

## Backlog — confirmed, not applied (needs its own checkpoint)

Ranked small-to-large. Each was verified with quoted evidence; none is urgent, all are real.

| File                                            | Finding                                                                                                                                                | Effort |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `lib/structured-data.ts`                        | buildPersonEntity's `roleLine.split(" @ ")` treats siteConfig.role (and intro.role from Sanity) as having an implicit "<jobTitle> @ <employer>" format | S      |
| `email/newsletter-confirm-email.tsx`            | email/contact-form-email.tsx and email/newsletter-confirm-email.tsx duplicate ~20 lines of Html/Head/Preview/Tailwind/Body/Container/Section layout bo | S      |
| `lib/sanity-client.ts`                          | getPostBySlug() is typed to return the full generated `Post` (which requires non-optional `_type`, `_createdAt`, `_updatedAt`, `_rev`), but its GROQ p | S      |
| `components/blogs/portable-text-components.tsx` | `BodyImageMeta` (lines 10-13) hand-types the `asset->metadata.lqip`/`asset->metadata.dimensions` join that postProjection adds to body images (lib/san | S      |
| `app/globals.css`                               | The generic `.dark { --c1-text: var(--c1); ... }` override (lines 140-144) only wins over each `[data-theme="x"]` block's light-mode 700-series text t | S      |
| `components/blogs/table-of-contents.tsx`        | The parent-heading `<a>` (lines 246-264) and child-heading `<a>` (lines 288-316) are hand-duplicated near-identical blocks — same href/data-heading-id | S      |
| `tests/lib/feed.test.ts`                        | feed.test.ts hand-builds Portable Text blocks (paragraph/linkedParagraph, lines 6-24) with the same shape lib/fixtures.ts already builds via its span/ | S      |
| `app/api/revalidate/route.ts`                   | Webhook's revalidation dispatch is a hand-maintained portfolioTypes array with no compile-time or test-time link to the actual Sanity schema registry  | S      |
| `lib/config.ts`                                 | siteConfig.role ("Cloud Field Engineer @ Canonical") is the declared identity source of truth, but the same fact is re-typed as an independent string  | M      |
| `app/blogs/[slug]/page.tsx`                     | The blog post prose column width (42.5rem) is hand-duplicated as a Tailwind arbitrary-value literal in 3 files/4 sites, and the sibling newsletter-CTA | M      |
| `components/footer.tsx`                         | footer.tsx declares its own `navLinks`/`portfolioLinks` arrays (hrefs + labels) that duplicate most of lib/data.ts's `links` array (the header nav / S | M      |
| `components/blogs/archive-list.tsx`             | Tag pills are hand-rolled with slightly different Tailwind classes in 3 places (tag-chips.tsx, blog-post-content.tsx, archive-list.tsx) instead of usi | M      |
| `actions/subscribe.ts`                          | actions/sendEmail.ts and actions/subscribe.ts mirror the entire hardening pipeline (lazy config load → checkBotId → zod parse → checkRateLimit → hasVa | M      |
| `lib/fixtures.ts`                               | resolveFixtureQuery() dispatches on ad hoc substrings of the GROQ query text (`query.includes("wordCount")`, `query.includes("[0...")`, `query.include | M      |
| `components/ui/use-toast.ts`                    | 193 lines of vendored shadcn toast state machine (module-level listener array, ADD/UPDATE/DISMISS/REMOVE reducer actions, a per-toast setTimeout remov | M      |
| `app/api/revalidate/route.ts`                   | The Sanity webhook handler (signature check + tag fan-out that drives ALL cache invalidation) has zero test coverage — no test file references it.     | M      |
| `tests/actions/sendEmail.test.ts`               | The vi.mock scaffolding for resend/dns/promises/next-headers/botid/@vercel-firewall plus the formDataOf/withIp helpers are duplicated near-verbatim be | M      |
| `lib/highlight-code.ts`                         | HIGHLIGHT_MARKUP_VERSION solves "cached output shape changed in a deploy but the Next.js data cache persists across deployments" only for shiki-highli | M      |

### Recommended order of attack

1. **Webhook route tests** (`app/api/revalidate/route.ts`) — the highest-risk untested surface: a regression silently breaks all cache invalidation. One test file with a mocked `parseBody` covers signature rejection, post fan-out, portfolio types, and the unknown-type 404.
2. **Shared test scaffolding** — extract `formDataOf`/`withIp`/the vi.mock blocks shared by the two action test files into `tests/helpers.ts` before a third form action appears.
3. **`verifyFormSubmission()` helper** — the BotID + WAF block is the security-critical part duplicated between actions; extract just that (leave per-form validation alone).
4. **Tag pill unification on `components/ui/badge.tsx`** + a shared `validTags()` gate (archive rows currently skip the `TAG_PATTERN` filter the other two call sites apply).
5. **Email layout wrapper** for the two react-email templates before the first broadcast template is added.
6. **Measure token** — `42.5rem`/`45.5rem` prose-width literals across three files deserve a CSS variable or shared constant when the next typography pass happens.
7. Larger/architectural: slug projection-type layer (kill the `Post["slug"]` lie), `use-toast.ts` trim, ToC link-item dedup, root-layout FOUC script extraction, navLinks unification, `roleLine.split(" @ ")` contract hardening.

## Downgraded / refuted during verification

- **DOWNGRADED** `.github/workflows/node.js.yml` — CI never runs `pnpm run typegen` (package.json:16) or checks its output is current, so a schema edit in sanity/schemas/*.ts can ship with a (Core claim confirmed: node.js.yml's lint job (lines 20-34) runs install/lint/typecheck/format/test but never `pnpm run typegen`, and .husky/pre-commit only runs lint-staged (eslint)
- **DOWNGRADED** `components/blogs/utils.ts` — `Post["slug"]` is declared as the object type `Slug | undefined` (sanity.types.ts:230/128), but every GROQ projection aliases it to a plain (Core claim and cost are confirmed for 5 of the 6 cited sites: PostListItem (sanity-client.ts:33-36 `& { slug: string; wordCount: number }`), PostWithBody (:38-41 `& { slug: string )
- **DOWNGRADED** `lib/newsletter.ts` — addContact() and sendConfirmEmail() — the two Resend I/O functions in the newsletter provider boundary — have no real test coverage; every e (The addContact half is fully true: it's only ever called from app/api/newsletter/confirm/route.ts:35, and tests/api/newsletter-confirm.test.ts mocks it away wholesale via `vi.mock()
- **REFUTED** `app/sitemap.ts` — The fact that sanityFetch's cache key is derived from the literal GROQ query string (so reformatting/adding a field to a query silently orph

## Method note

Findings were produced by seven specialized auditor agents running in parallel, each capped at 10 findings ranked by (future-change cost ÷ effort). Every finding was then re-examined by an adversarial verifier that had to quote the exact lines proving or disproving it; only CONFIRMED items were acted on. "Safe fix" required agreement from both the auditor and the verifier that the remediation is behavior-preserving, small, and individually revertible.
