# Portfolio v2 migration plan

Prepared November 3, 2026. Implementation owner: GPT-6.1-Terra. Branch: `v2-rewrite`.

Deployment authorization update: the owner subsequently requested use of the Cloudflare plugin to create/configure Workers and authorized moving `adithya-rajendran.com` to the Worker. Deploy and route the domain after verification when account access and required configuration are available. This supersedes the local-only deployment restriction below; publishing the verified `v2-rewrite` branch for the configured GitHub build is part of deployment. No merge to `main` is required. No further launch approval is required, although automatic review separately requested explicit approval to transfer existing private credentials. The planning agent coordinates hosting while GPT-6.1-Terra owns application implementation.

Replace Next.js and Vercel with Astro, TypeScript, and Cloudflare Workers. Use Three.js for the experience timeline and existing project models. Retain Sanity as the content source and Resend for contact delivery. Redesign the presentation while preserving the owner's content, public URLs, accessibility, and editorial capabilities.

## Architecture decision

Astro owns page composition and routing across the whole website, including the blog. TypeScript owns browser interactions and Worker endpoints. CSS owns the design system. React may remain for Sanity Studio and selected existing components rendered to HTML without client hydration; it is not the public application's routing or rendering framework. Prefer small native browser scripts over hydrated React for navigation, themes, contents, and contact.

Use Astro's supported Cloudflare adapter and Workers Static Assets. Resolve compatible stable package versions at implementation time and commit the lockfile. Keep Node 24 for development/builds and pnpm. Do not use OpenNext, Vinext, Cloudflare Pages, or a Next compatibility shim: those would retain the framework being replaced. [Cloudflare's Astro deployment guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/) and [Astro's adapter documentation](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) describe the supported deployment path.

### Rust assessment

| Choice                         | Fit for this site                                                                                                                      | Decision                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Astro, TypeScript, Three.js    | Direct fit for content pages, Sanity, browser graphics, and Workers request handlers; reuses tested content logic                      | Adopt                                                       |
| Rust Worker through workers-rs | Supported through WebAssembly; adds Cargo, Wasm packaging, and interop to handlers dominated by CMS/email network calls                | Do not introduce for the initial migration                  |
| Rust browser Wasm module       | Useful for a future CPU-heavy simulation, geometry algorithm, or shared robotics computation; still needs browser/graphics integration | Reconsider after profiling identifies a specific bottleneck |
| Rust UI framework or renderer  | Would replace the proposed Astro content workflow and much of the existing browser integration                                         | Not justified by the current requirements                   |

Cloudflare supports Rust via WebAssembly and the worker crate. Its async handlers interoperate with JavaScript promises and the platform event loop; this is not an ordinary native Rust server. [Cloudflare Rust documentation](https://developers.cloudflare.com/workers/languages/rust/) and [workers-rs](https://github.com/cloudflare/workers-rs) establish feasibility, not a performance advantage for this portfolio.

AI-assisted coding does not change the site's runtime workload. A general claim that AI is trending toward Rust is not enough to choose it here. This recommendation is an architectural judgment from the repository: content rendering and network I/O dominate the server responsibilities, while Three.js already supplies the graphics layer. There has been no comparative benchmark. Add Rust only when a representative benchmark demonstrates a worthwhile end-to-end gain including Wasm download, initialization, and data transfer, or when a real Rust library must be shared with another project.

## Current implementation and reusable work

The starting application uses Next 16, React 19, TypeScript, Sanity, Three.js, Resend, and Tailwind 4. Vercel dependencies include BotID, WAF rate limiting, analytics, Speed Insights, preview integration, and a daily publishing cron. Next-specific dependencies include cache tags, server actions, routing, font handling, metadata/OG rendering, and embedded Studio integration.

Reuse the domain logic in `lib/`, Sanity schemas and generated types, fixtures, image assets and credits, pure Three.js scene code in `components/trajectory/`, project model code, and meaningful tests. Port or replace framework-dependent wrappers. Existing rich prose supports figures, galleries, code, callouts, embeds, internal links, footnotes, revisions, related posts/projects, RSS, and print: none should silently disappear in a simplified renderer.

Read `CLAUDE.md` before implementation. The user's authorization to redesign and remove Next/Vercel supersedes design-specific and Next-specific constraints there. Preserve its content truth, privacy, schema, and accessibility contracts. Update the guide to describe v2 rather than leaving conflicting instructions. Do not run content migrations or publish schema changes from this task.

## Rendering and content freshness

Start with Astro on-demand rendering for CMS-backed pages, feed, sitemap, and generated metadata. Prerender only truly invariant pages/assets. Fetch published Sanity data with request-time publication filtering and `useCdn: false` initially; deduplicate repeated reads within a request. Keep drafts and future-dated posts out of every public surface, including tags, home, related posts, RSS, sitemap, and direct slug access.

Do not add a shared HTML/content cache in the first implementation. Return explicit non-cacheable responses for CMS HTML and dynamic XML until the freshness model is tested. Static fingerprinted assets can cache normally. This deliberately trades some origin calls and latency for straightforward publishing, deletion, and scheduled publication. Report this tradeoff in the runbook; measure before adding cache infrastructure.

This removes the need for Next cache-tag invalidation and daily publishing refresh: each request evaluates the current publication rules. Retire the old cron and webhook, with explicit migration instructions to disable the Sanity webhook and Vercel cron at cutover. If temporary compatibility endpoints remain, they must authenticate and truthfully report that invalidation is unnecessary; never claim to purge a cache that does not exist. Unknown content must be a real 404; CMS outages must surface as an appropriate error response rather than cached empty content or a false 404.

Later caching is a separate measured enhancement. Specify publication latency, deletion behavior, cache keys, purge scope, and scheduled boundaries first. Cloudflare's Cache API is local to a data center, so deleting there is not global invalidation. [Cache API documentation](https://developers.cloudflare.com/workers/runtime-apis/cache/).

Keep Sanity as the editorial source; moving to Astro does not require moving published posts to Markdown. Local content collections can be added when there is an actual local-content requirement. [Astro's Sanity guide](https://docs.astro.build/en/guides/cms/sanity/) supports this separation. Keep Studio isolated at `/studio` with client-side React and its existing schemas, using a standalone Studio build or supported Astro integration. Deep Studio links must load without pulling Studio code into public pages.

## Route and feature contracts

| Existing surface                                         | v2 requirement                                                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                      | Profile-driven introduction, selected projects, latest writing, current focus/contact path                                       |
| `/blog`, `/blog/[slug]`, `/blog/tags/[tag]`              | Writing index, complete rich articles, existing slugs, tags, related content and navigation                                      |
| `/portfolio`, `/portfolio/[slug]`                        | Projects and complete case studies; retain project viewers/posters where present                                                 |
| `/resume`                                                | Experience with accessible HTML CV and optional Three.js timeline; preserve list deep links, dates, and print                    |
| `/resume/view`, `/resume/download`                       | Validated Sanity PDF delivery with existing viewing/download semantics                                                           |
| `/about`, `/contact`                                     | Existing profile facts and conditional contact topics; working form and non-JS fallback                                          |
| `/feed.xml`, `/sitemap.xml`, `/robots.txt`               | Correct XML/text, canonical domain, published-only content and real response types                                               |
| `/studio` and nested paths                               | Working content editor separated from public bundles                                                                             |
| Old redirects and fragment links                         | Inventory `next.config.mjs` and current navigation; preserve `/blog/archive`, `/resume/trajectory`, and legacy portfolio anchors |
| OG images, icons, `llms.txt`, security and policy assets | Replace framework handlers; preserve discoverability, attribution, privacy, and useful sharing images                            |

Keep `/resume` as the canonical experience URL in this migration. `/experience` may redirect to it if useful; avoid changing established addresses just to match a navigation label. Preserve all existing redirects beyond the examples in the table. Record the route inventory and explicit intentional changes in the implementation report.

## Design direction

Use an editorial engineering portfolio: strong typography, generous reading space, clear project evidence, and a restrained technical visual language. Retain useful imagery, the owner's identity, and factual content; the old space metaphor and layout are optional. Keep navigation labels plain: Projects, Writing, Experience, About, Contact.

Make writing calm and readable, with a narrow prose measure, well-designed code/figures, accessible contents, and print support. Make the experience page the place for immersive graphics. The homepage should explain the owner's work immediately, rather than requiring animation to reveal its content. Use a coherent light/dark palette with named tokens, visible keyboard focus, readable contrast, and self-hosted fonts with licenses retained. Avoid inventing achievements, roles, dates, metrics, testimonials, or filler case studies.

Implement mobile and desktop layouts together. Preserve persisted theme/motion preferences where practical. Motion is progressive enhancement: content remains present without JavaScript, with reduced motion, and when WebGL fails.

## Browser graphics

Reuse framework-independent trajectory and model code where useful; keep Three.js out of ordinary content routes. Load the experience after explicit interaction or when eligible and near the viewport, with an immediately available HTML list. Honor reduced motion and the pause control before initializing animation. Limit pixel ratio, handle resize and context failure, pause when hidden/offscreen, and dispose renderers, geometry, materials, textures, listeners, observers, and animation frames on teardown. Keep keyboard and touch navigation available without relying on canvas picking.

## Worker endpoints and integrations

Replace the contact server action with an explicit POST endpoint. Preserve Zod field limits, topic availability rules, internationalized email handling, plain failure messages, saved unsent drafts, and a truthful success state only after Resend accepts the send. Use a verified fixed sender and the visitor's address only as Reply-To. Keep recipients and credentials server-only; do not publish any email address or phone number.

Replace BotID with Turnstile and validate the token on the server, including expected hostname/action. Missing configuration and validation-service failure must not bypass protection. Cloudflare requires server-side validation, and tokens are short-lived and single-use. [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Use a Workers rate-limit binding for ordinary per-client burst protection, with configured limits and `429` responses. Document that it is per-location and eventually consistent, not a globally exact quota. Fail safely if a required binding is absent. Only add a Durable Object if a strict global sending budget is required. [Workers rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Validate request origin, request size, and content type. Bound outbound calls with timeouts. Adapt the Node DNS resolver to a fixed HTTPS DNS resolver if it is not supported by the selected runtime; retain null-MX, address fallback, IDN, and temporary DNS failure semantics. Test using injected providers rather than sending real email. Keep fixture/test bypasses impossible in production configuration.

Move CSP/security headers to Astro middleware and static-asset header configuration as appropriate. Include only origins actually needed for Sanity, embeds, and Turnstile. Replace `next/font` and `next/image` with self-hosted font files and Astro/native responsive images; Sanity's image CDN can remain. Replace filesystem-dependent OG code with a Worker-compatible implementation or prebuilt assets with valid per-page metadata. Remove Vercel analytics and Speed Insights; make Cloudflare Web Analytics optional and configured separately. Do not introduce new tracking by default.

## Implementation sequence for GPT-6.1-Terra

1. **Inventory and foundation.** Confirm branch `v2-rewrite`, read repository guidance, record routes/integrations and baseline test commands. Establish Astro, its Cloudflare adapter, TypeScript, pnpm scripts, fixture configuration, environment examples, and Wrangler configuration. Verify a minimal page in the Workers runtime before broad porting. Use existing stable tools; resolve versions rather than guessing.
2. **Content and core pages.** Decouple Sanity reads and domain helpers from Next. Build the new layout, navigation, theme controls, home, writing index/article/tag, projects/detail, About, and error pages. Preserve rich content rendering, internal links, image captions, revisions, and factual content. React components may be rendered server-side where this preserves tested behavior without client bundles.
3. **Experience and media.** Port the CV/list, PDF endpoints, print styling, Three.js trajectory, and project viewers. Verify no-JS and WebGL-failure paths before polishing motion. Keep model assets and credits.
4. **Contact and editorial workflow.** Implement the Worker contact endpoint, Turnstile, rate limiting, DNS checks, and test seams. Mount Studio independently and preserve schema/type generation. Implement RSS, sitemap, redirects, metadata, OG images, robots, security headers, and public files. Remove obsolete cache/cron code coherently.
5. **Remove platform coupling.** Remove Next, next-sanity, BotID, Vercel SDKs/config, cache warmers, obsolete scripts and framework-only tests. Keep valuable domain tests. Replace CI/build/preview configuration with Astro and Workers checks; do not retain a successful-looking Next-only gate. Update README, contributor instructions, and environment migration notes.
6. **Verify and report.** Run the applicable gate, fix regressions, produce screenshots if browser tooling is available, and write `docs/v2-implementation-report.md` with actual check results, intentional differences, any incomplete features, and deployment prerequisites. Do not call the migration complete while route/feature contracts remain unimplemented.

The implementation agent owns application edits. The planning agent reviews the resulting evidence and delegates fixes back to GPT-6.1-Terra. Do not deploy publicly, change DNS, remove the Vercel project, mutate Sanity content, push, or merge as part of local implementation.

## Acceptance checks

- Clean installation from the committed lockfile; Astro/TypeScript checks, lint, formatting, relevant unit tests, production build, and Wrangler deployment dry run pass. Existing repository gates must be migrated, not silently bypassed.
- Run representative browser tests against the built Worker runtime, not only Astro's development server. Verify mobile/desktop navigation, keyboard access, no-JS content, both themes, reduced motion, article rendering, experience interaction/fallback, contact behavior, Studio shell, print, and error states. Browser or external-credential limitations must be stated explicitly.
- Contract tests cover published/future/draft/deleted content, actual 404 vs upstream failure, RSS/XML/canonical URLs, redirects, PDF URL validation, contact validation/Turnstile/replay failure/rate limiting/Resend refusal, and secret/fixture isolation. Keep the existing content and schema tests that still apply.
- No Next/Vercel runtime dependency remains in the application dependency graph. Ordinary pages do not download Three.js or Sanity Studio. Record transferred bytes for a normal article and experience entry; avoid claiming a performance gain without measurements. Aim for LCP under 2.5 seconds and CLS under 0.1 under a documented mobile test profile, with field INP assessed after launch.
- Verify production data availability separately from fixture rendering. No real email is sent by automated tests, no CMS documents are modified, and secrets are absent from built client assets and logs.

## Deployment and rollback plan

Prepare a Cloudflare Worker preview environment with the Sanity public identifiers, optional server read token, Resend credentials/recipient, Turnstile keys and hostname allowlist, and rate-limit bindings. Separate preview/test settings from production and keep previews out of search indexes. Provide exact build and deploy commands for the selected adapter output, and document any account-side configuration still needed.

Before cutover, compare published pages/URLs and assets with the current site, test a permitted contact send, confirm Studio CORS/authentication and PDFs, validate headers/redirects, and check Worker CPU/bundle limits and latency. Add content-freshness checks using controlled fixtures or an owner-approved editorial test. Keep the existing Vercel deployment available during validation.

Once the owner approves launch, deploy the verified revision, move the domain/route to Workers, disable the obsolete Sanity webhook and Vercel cron, and monitor errors, contact delivery, 404s, and content freshness. Roll back by restoring the previous domain routing and associated webhook/cron configuration; the existing Sanity schema/content is unchanged. Retire Vercel only after the replacement has demonstrated stable operation.
