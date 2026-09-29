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

- **Tailwind v4 is CSS-first.** There is no `tailwind.config.js`.
  `app/globals.css` is the one global entry, imported by
  `components/chrome/site-shell.tsx` (and `app/global-not-found.tsx`), so
  it loads on public pages only. It fixes the layer order
  (`theme, base, components, utilities`), imports Tailwind and the files in
  `styles/`, and maps the tokens to utilities under `@theme inline`; the
  default palette and fonts are removed (`--color-*: initial`), so
  utilities use tokens only.
    - `styles/tokens.css` (layer `theme`) holds every design token: both
      themes (Void on `:root`/`[data-theme="void"]`, Flight Manual on
      `[data-theme="manual"]`), type scale, space, motion. Colours are
      defined there and nowhere else; orange text is `var(--accent-text)`,
      `--accent` is for fills and marks.
    - `styles/base.css`, `layout.css`, `components.css` (the shared design
      system: header, footer, buttons, pairs, section tags, photographs and
      plates…), `prose.css` (the long read under `.prose`: listings and the
      Shiki token colours, plates, callouts, footnotes and margin notes,
      the notes list, and their print rules), `los.css` (Loss of Signal)
      and `print.css`.
    - Route- or feature-specific styles go in a CSS Module beside the
      component, or are scoped under the page's `[data-page="…"]`: global
      CSS is not removed on navigation and Cache Components keeps visited
      routes mounted. Modules are unlayered and beat every layer, so never
      put a Tailwind utility on an element that has a module class. A
      module imported by `app/global-not-found.tsx` is merged into the root
      layout's stylesheet, which the Studio loads, so the 404's styles are
      global (`styles/los.css`).
- **Theme and motion** (plan §2.5.1). `lib/theme-boot.ts` is the inline boot
  script (under 600 bytes, unit-tested) that `ThemeBootScript` renders in
  both root documents' `<head>`: it reads localStorage `ar-theme`
  (`void` | `manual` | `auto`; missing means Void) and `ar-motion`
  (`full` | `reduced`), and sets `data-theme`, `data-motion` and `data-js`
  on `<html>` before the first paint. The server renders the literal
  `data-theme="void"` and never `data-motion`, so without JavaScript there
  is no spatial motion; never read a cookie for this, it would make every
  route request-bound. The header's `ThemeSwitch` (one button, Void ↔
  Flight Manual) names the theme it switches to from `html[data-theme]`
  in CSS, so under Auto it follows the screen; the footer and the menu
  sheet carry `ThemeChoice` (Void · Manual · Auto, a `Segmented`), which
  reads `lib/prefs.ts` through `useSyncExternalStore` (server snapshot
  `undefined`). Spatial motion runs
  only under `html[data-motion="full"]` and
  `prefers-reduced-motion: no-preference`. Fonts come from `lib/fonts.ts`
  (their variables on `<html>`); italic Newsreader is its own family,
  `var(--font-long-italic)`, so it is not preloaded. The chrome (header,
  footer, section marks) sets nothing in italic, so that file loads only
  on pages whose text is italic (an `<em>` in a post); keep it that way.
- **Dates in render.** Never call `new Date()`, `Date.now()` or
  `Math.random()` in render outside `"use cache"`: the build fails, or the
  page becomes request-bound. "Today" is `getToday()` from `lib/clock.ts`
  (cached for a day); the copyright year and the orbit map's "now"
  derive from it. Random-looking art is seeded (`lib/sky/`).
- **The mission patch** is generated: `node scripts/generate-patch.mjs`
  writes the sprite symbol (`lib/patch.json`), `app/icon.svg`,
  `app/apple-icon.png` and `app/favicon.ico`. Never edit those by hand.
- **Share images.** Every page draws the Deep Field card
  (`lib/og-card.tsx`, which also exports the routes' `OG_SIZE` and
  `OG_CONTENT_TYPE`); `/`'s card stands in for any page without its own.
  Satori takes TTF, not WOFF2,
  so the card reads static copies from `assets/fonts/og/` (each with its
  OFL licence) once at module scope, which keeps the image prerendered.
- **The Trajectory map and the CV** (G2, G3). `lib/orbit/geometry.ts` is
  pure and unit-tested: it places the timeline in time (a zero-length or
  missing start is unknown and fades in; burns, coasts, flybys and the
  planned orbit from `availability.from`) and projects it twice, time
  running right (a 1000-unit width stretched to the plot, heights in
  pixels) and up (pixels). `components/orbit/orbit-map.tsx` draws both
  SVGs on the server with every word in HTML over them, and CSS shows one
  (60rem). Its SVG masks need document-unique ids, so each page passes its
  own `idPrefix`. `OrbitInteraction` is event delegation on the page root
  (`data-orbit-id`, `data-orbit-row`, `data-orbit-show`…): it renders
  nothing and keeps state in attributes. `lib/cv.ts` words the rows'
  dates. The print is the only paper artefact: two sheets on the named
  page `cv` (`styles/print.css`), sheet 2 breaking before its control
  line. `[data-print="only"]` forces `display: block !important` from a
  layer, which no unlayered rule overrides, so a print-only part that
  needs another display sits inside a print-only container instead.
- **Prefetching** (plan §4.6 rule 8). The app-wide `partialPrefetching`
  flag is off: in Next.js 16.3.4 it made the first request for an unknown
  post or tag slug answer 200 instead of 404 on `next start`. The two
  list-heavy routes opt in per segment instead
  (`export const prefetch = "partial"` in `blog/[slug]` and
  `blog/tags/[tag]`, which keeps the 404), so the links to them on a page
  share one prefetched App Shell and the entry loads on the click. Links
  that repeat another link on the page (the chart's marks) pass
  `prefetch={false}`. A first view stays within 8 page prefetches
  (`tests/e2e/log.spec.ts`); each distinct URL also fetches its small route
  tree (`/_tree`), which the byte report lists apart.
- **The long read** (G1). `lib/prose.ts` `indexProse(body)` numbers a
  Portable Text body once: listings (LISTING n, wide past 72 columns),
  plates and figures (Pl. I for photographs, Fig. 1 for diagrams, plots
  and screenshots; a post's cover is the lead plate) and footnotes (in
  reading order, written onto a copy of the body's markDefs). The post
  page, the project essay, the "In this entry" record
  (`lib/entry-counts.ts`) and the RSS feed (`lib/feed.ts`) all read it, so
  they agree; render `index.body`, not `post.body`. The renderers are
  `components/blogs/portable-text-components.tsx` and
  `components/prose/`; a new `contentBody` type lands with its web and
  feed renderer in the same change. `components/blogs/post-reader.tsx`
  marks the current section and resolves in-page links (`#fn-1`, the
  contents) inside the visible entry, because a hidden, still-mounted
  entry can hold the same ids. Reading pages (lib/navigation.ts
  `headerMode`) get `html[data-header="solid"]` from RouteMarker.
- **Missions** (G5, G6). `lib/missions.ts` is pure and unit-tested: it
  words each project once (`toMission`) for `/portfolio`, the mission files
  and the home Missions act (the stage and `MissionTiles`), and finds each
  one's write-up from the list data (`originalEntries`). A mission's name, set in capitals on the stage
  and the file, comes from its slug (`homelab` → Homelab); the order is the
  featured slots, then the list query's; the register and the files'
  previous / next go by mission number. A mission's Flight Log entries are
  derived (`missionEntries`): the posts that reference it, and the posts
  its links, its essay and its model's callouts point at; the original
  entry is the first linked one, else the oldest referencing one. Links to
  the site's own posts are entries, never external links. The 3D viewer's
  server part (`components/viewer/viewer-figure.tsx`) is the model's
  poster as a plate, and its callouts are numbered rows linked to their
  sections; PR 15 mounts the drawing in its `data-viewer` slot. The file
  reuses `PostReader`, so its in-page links resolve inside the visible
  file. The old `/portfolio` fragments (`#experience`, `#skills`,
  `#certifications`, `#engineering-writing`, `#contact`) are link rows
  (`RouteList`) carrying those ids; `#projects` is the tiles.
- **The home page** (plan §6.2 row 13, contract §9). The hero
  (`components/home/hero.tsx`) is NASA's orbital sunrise, pre-encoded by
  `node scripts/generate-hero-sunrise.mjs` from `assets/artwork/` into
  `public/images/hero-sunrise-v<n>/` and `lib/hero-sunrise.json` (bump the
  version on every re-encode). The photograph is screen-blended over the
  starfield in Void; under it, and alone in Flight Manual and print, an
  SVG draws the limb from circles fitted to the photograph, in the same
  cover crop, so the two stay aligned at every size. The starfield
  (`components/sky/starfield.tsx`, the site's only ambient motion) is a
  seeded canvas over `StaticStars variant="field"`, which it hides once it
  has drawn: it runs at about 30 fps only while the hero is on screen, the
  tab is visible, the theme is Void and motion is allowed, keeps stars off
  `[data-clear]` text, reports `data-state` (`running` | `stopped`) and
  stops in its effect cleanup, because a visited page stays mounted. The
  acts come and go with their content (`lib/home.ts`), numbered as they
  appear; the Now and Crew acts read `lib/crew.ts` (the current role, the
  tagline or the introduction's first sentence, availability, the Now
  list by kind and the biography's first paragraph), which the Crew File
  shares; the record (`CrewRecord`) is the Crew File's alone. In Flight
  Manual the hero draws the planet's parallels under the limb and has no
  foot row; on home the footer leaves Pause motion to the hero.
- **The Crew File** (`/about`, plan §6.2 row 14, contract §9). The patch
  is the identity mark (a `PageHead` `figure`; the site shows no
  portrait), then the record (`CrewRecord`), and numbered
  `DocSection`s (`components/ui/doc-section.tsx`, the one section head:
  also the mission files, `/contact`, `/blog`'s Downlink and the CV on
  `/resume`): the biography, the Now list grouped by
  `currentCuriosities[].kind` (`nowGroups`; the home Now act groups the
  same way), the latest entries and any talks, and the related pages
  (`lib/directory.ts`, shared with `/portfolio`'s Directory), each only
  when it has content, then the close (`components/ui/ask.tsx`). Its
  section ids are prefixed (`crew-…`) because a visited home page, still
  mounted, has a `#now`. No page carries the old design: there is no
  legacy stylesheet, token, class or icon library left, and
  `tests/e2e/crew.spec.ts` checks every static page for one.
- **LOG numbers** are derived, never stored: `logNumbers` in
  `lib/designations.ts` numbers published posts by `publishedAt`, oldest
  first (LOG 001), ties by document id. Number the whole list, then filter
  (`logEntries` in `lib/log-index.ts`), so a tag page keeps each entry's
  number. A post back-dated before an existing one renumbers those after it.

## Layout: the `(site)` route group

- `app/layout.tsx` is the minimal root layout shared by the public site and
  the Studio: `<html>`, fonts, BotID and route-independent metadata only.
  Do not add site CSS, chrome, JSON-LD or analytics there.
- Every public page lives under `app/(site)/` (route groups do not change
  URLs). `app/(site)/layout.tsx` renders `components/chrome/site-shell.tsx`:
  the global stylesheet, the skip link, the icon sprite, the server-rendered
  header and footer, the one `<main id="main-content">`, JSON-LD and
  analytics. They are part of each page's static shell, so the chrome
  works without JavaScript and page content is rendered once. New public
  routes go under `app/(site)/`; `app/studio/` stays outside the group, so
  none of this loads in the Studio.
- Pages never render `<main>`: `SiteShell` owns the only one, because
  Cache Components keeps up to three visited routes mounted but hidden, and
  a page-owned `<main>` would repeat. A page's root element is a `<div>`
  with `data-page="…"` (`home`, `log`, `post`, `missions`, `resume`,
  `contact`, `not-found`…), which scopes its styles. Links and in-page
  lookups must resolve inside the visible page, not with
  `document.getElementById`.
- Navigation labels and URLs come from `lib/navigation.ts` (header, menu
  sheet, footer and the 404). Below 960px the header nav is a native
  `popover` sheet, so it opens without JavaScript; `MenuButton` adds focus,
  `inert` and the Tab loop.
- Never wrap page content in `<Suspense fallback={children}>`, and keep
  anything that must work without JavaScript out of Suspense: in a long
  page React streams a completed boundary holding more than ~500 bytes as
  a hidden segment that only JavaScript reveals, showing the fallback
  meanwhile. Async Server Components that read cached data (the footer,
  the pages) need no boundary. A client component that reads the URL
  (`usePathname`) can suspend under Cache Components, so it sits in a
  small leaf `<Suspense>` with a static fallback (`ActiveNavLink` in the
  header, one boundary per link because the list as a whole passes the
  threshold); larger URL-dependent UI takes its variant as
  a prop from the page instead.
- `app/(site)/not-found.tsx` renders `notFound()` calls inside pages;
  `app/global-not-found.tsx` (`experimental.globalNotFound`) renders
  unmatched URLs as its own document, repeating the root layout's `<html>`,
  fonts and boot script around `SiteShell` and the same Loss of Signal
  page. There is deliberately no root `app/not-found.tsx`: Next.js attaches
  its stylesheet to every route under the root layout, the Studio
  included. An unmatched URL gets a complete server-rendered 404. An unknown slug under a dynamic route
  (`notFound()` during the render) answers 404 with Next.js's recovery
  document, which only JavaScript fills (a Next.js 16.3 limitation, marked
  `test.fail` in `tests/e2e/nojs.spec.ts`). React renders the head's boot
  script into that document, where it never runs, so `SiteShell`'s
  `ThemeBootFallback` runs it once when `html[data-js]` is missing.
- Metadata image routes inside a route group get a stable `-<hash>` URL
  suffix from Next.js (`/about/opengraph-image-1ycygp`; `next build` prints
  them). Anything that requests them directly, like the warm lists
  (`lib/route-tags.ts`), uses the built URL; a Vitest test recomputes each
  one and the e2e smoke spec requests each one from a real build.

## Caching contract

- Every Sanity read must go through `sanityFetch` in `lib/sanity-client.ts`,
  tagged with exactly one of `CACHE_TAGS.profile`, `CACHE_TAGS.post`, or
  `CACHE_TAGS.project` from `lib/cache-tags.ts`.
- There are exactly **two** invalidators:
    1. The Sanity webhook, `app/api/revalidate/route.ts`. It revalidates
       the matching type tag when a `profile`, `post`, or `project` document
       changes, then warms that tag's routes (below). Adding a new frontend
       query requires choosing one of those three ownership tags and adding
       its webhook dispatch deliberately. The webhook's filter in the Sanity
       dashboard must include all three types.
    2. The daily Vercel Cron, `app/api/cron/publish-due/route.ts`
       (schedule in `vercel.json`, 00:05 UTC). `publishedAt` is a date and
       visibility is gated by `publishedAt <= $today`, so a future post
       crosses the gate on its UTC date without a document change. The cron
       performs an uncached query for posts dated today, revalidates the
       `post` tag and warms its routes. Auth is
       `Authorization: Bearer ${CRON_SECRET}` (Vercel attaches it
       automatically); missing/wrong auth → stealth 404. If `CRON_SECRET`
       is unset, same-day publishing silently degrades to the pages' daily
       cache revalidation.
- `lib/route-tags.ts` is the route → tag table: every URL the app serves
  (pages, share images at their built URL, the feed, the sitemap, the CV
  redirects, icons, API routes and the Studio) with the tags of the content
  it shows. `warm(tag)` in `actions/warmCache.ts` requests every route
  listed under a tag, expanding `[slug]` and `[tag]` from the published
  post and project lists; `warmBlogCache`, `warmProfileCache` and
  `warmProjectCache` are its wrappers. Those lists come from
  `getWarmLists()`, the one read besides the cron's that bypasses
  `sanityFetch`: it queries the live API uncached, because right after
  `revalidateTag(…, "max")` the cached lists are still stale and would miss
  a post or project published a moment ago. A route that renders on every
  request (`perRequest`, today the post share image) is never warmed. A new route goes into the table in
  the PR that adds it: `tests/lib/route-tags.test.ts` fails for a route file
  missing from the table or a path that differs from the build, and the
  e2e smoke spec requests every warmed URL. Redirect routes (`redirects`)
  are warmed without following the redirect.
- Derived artifacts that include the post list (`app/feed.xml/route.ts`,
  `app/sitemap.ts`) use `cacheLife("days")`, never `"max"`: a post whose
  `publishedAt` arrives must reach them within a day even if the cron is
  missing, because their tags only fire on the webhook or the cron.
- Cache keys are derived from the literal GROQ query string passed into
  `sanityFetch`/`"use cache"`. Reformatting a query string (whitespace,
  line breaks) changes the cache key and silently orphans the old cache
  entry. Harmless (the old entry just goes cold), but worth knowing when a
  cache "isn't updating" after a query edit.
- `lib/highlight-code.ts` has a `HIGHLIGHT_MARKUP_VERSION` constant (3: one
  css-variables Shiki theme whose `--code-*` colours styles/prose.css maps
  to the design tokens) that participates in its cache key. Bump it whenever the emitted markup's CSS
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
- **The contact form** (`components/contact/contact-form.tsx`) is on
  `/contact` (`/portfolio#contact` is a link row to it) and dispatches `sendEmailAction`
  from `onSubmit`, so React never resets its controlled fields. It needs
  JavaScript for BotID, so its wrapper is `.js-only` and a `<noscript>`
  block offers LinkedIn instead. The routes and topics (`hiring`,
  `research`, `consulting`, `hello`) live in `lib/contact.ts`: Consulting
  shows only while `availability.consultingOpen` is on, and the topic's
  name prefixes the email subject. Each route's title and prompt are the
  profile's (`contactRoutes`, Studio group Site copy); a route without a
  title takes its topic's name, and one without a prompt shows none. `sendEmail` sends a topic whose route is not
  shown (a crafted POST) as a hello, and treats Resend's returned
  `{ error }` as a failure: Resend 6 does not throw on API errors. A `"use server"` module may export only async
  functions (anything else reaches the client as a server reference), so
  the form's state type and initial value live in `lib/contact.ts` too.
  `/contact` reads its fragment (`#hiring`) on the client, never
  `searchParams`.
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

- Option lists and pure rules that both the schema and the site read live
  in modules with no imports, because the Studio bundles them:
  `lib/profile-fields.ts` (availability, link kinds, employment types, date
  precision…), `lib/project-fields.ts` (project statuses and types, image
  kinds, model kinds, mission numbers, the anchor and revision rules),
  `lib/post-fields.ts` (callout tones, image widths, changelog kinds, the
  footnote and note limits), `lib/viewer/registry.ts` (the 3D models built
  in code and the parts a callout can point at; never import three.js
  there) and `lib/headings.ts`
  (heading ids, shared by the pages and the Studio's anchor check). Sanity
  checks a value against `options.list` only when the field declares a
  validation rule, so an optional list field uses
  `validation: listValuesOnly`.
- Rules that query the dataset (mission-number uniqueness, the one-mission-
  per-featured-slot warning, callout anchors in a linked post) are exported from `sanity/schemas/project.ts` and read
  through `context.getClient`, so tests pass a fake client. They query with
  an explicit perspective: `raw` where drafts count, `published` where
  readers see the result.
- `PROFILE_QUERY_RESULT` must stay assignable to the hand-written
  `ProfileData`, and the post and project query results to `PostListItem`,
  `PostWithBody`, `PostMeta`, `ProjectListItem` and `ProjectWithBody`;
  `tests/lib/profile-fields.test.ts` and `tests/lib/project-fields.test.ts`
  check this in `pnpm typecheck`.
- Profile copy. Every visitor-facing string that describes the owner or
  changes over time comes from the profile (headline, tagline and
  introduction, availability, the Now list, focus areas, the biography,
  the page introductions `workSummary`, `writingDescription`,
  `projectsIntro` and `contactIntro`, and the contact routes' words);
  `lib/copy.ts` holds only structural labels (names, section titles,
  button verbs, form mechanics). When a profile value is empty its
  element is left out, never replaced by wording in code; the RSS
  channel, which must have a description, uses the feed's title.
  `design/impl-log/phase-4-copy-audit.md` classifies every string.
  Availability is `availability.seeking[]` (one line per opening, joined
  with " · " by `availabilityLine` in `lib/profile-content.ts`); the older
  single `openTo` line is deprecated and read only while that list is
  empty.
- Real content only. A date known only to the year is stored as any day in
  that year with precision `year` (`timelineEntry.startPrecision` and
  `endPrecision`, `profile.launch.precision`, `project.datePrecision`), and
  the site prints the year alone (`formatTimelineDate` in
  `lib/profile-content.ts`, `formatProjectYears` in
  `lib/project-content.ts`). Never print a month or day the owner has not
  given. Project dates the owner estimated set
  `datesApproximate` and print with "c." ("c. 2024–2025").
- The owner's four résumé projects are drafted, with the source of every
  value, in `migrations/seed-resume-projects/data.ts`. The seed migration
  writes them as Studio drafts, and `lib/fixtures.ts` lists the same four
  (without images, and without links to posts that are not fixtures). Any
  other fixture project, and every fixture post, is named as a fixture and
  describes no real work. The fixture profile holds only the owner's
  published values, plus the Open To lines and Site copy from
  `design/impl-log/phase-4-profile-copy.json`: a field the real profile
  leaves empty stays empty.
- Content migrations (`migrations/<name>/index.ts`) are run only by the owner,
  from an authenticated CLI (`migrations/README.md` has the commands, from
  the backup to publishing); never from CI or an agent session. Keep their
  logic in pure modules beside `index.ts` and test it in `tests/migrations/`,
  including through `collectMigrationMutations` from `sanity/migrate`. Make
  them safe to run twice, and check that any document they create passes
  the Studio's own validation (`validateDocument` against the repository
  schema, as `tests/migrations/seed-resume-projects.test.ts` does).
- No public email address or phone number anywhere: pages, JSON-LD, RSS, OG
  images, the console or the printed CV. Contact is the form only, so there is
  deliberately no `publicEmail` field, `externalLink` accepts http(s) URLs
  only, and so do essay links (`contentLink`): the web and RSS renderers
  print a `mailto:` or `tel:` annotation as plain text. JSON-LD `sameAs`
  keeps http(s) links only, and `/contact`'s `ContactPage` has no `email`,
  `telephone` or `contactPoint`.

## Tests

- **Vitest** (`pnpm test`, `tests/**/*.test.ts`) covers pure logic.
  `vitest.config.ts` uses `environment: "node"` by design: there is no
  jsdom or component-rendering setup. Anything that needs a browser is a
  Playwright spec.
- **Playwright** (`tests/e2e/*.spec.ts`, Chromium, `playwright.config.ts`)
  covers the built site: `smoke` (every page returns its status with one
  `h1` and one `main`, no console errors, uncaught exceptions or CSP
  violations; share images, feed, icons, headers, redirects, the Studio
  without chrome), `nojs` (complete pages without JavaScript: header, nav
  through the popover menu, footer, Void with no motion and no theme
  controls, no hidden streamed segments, nothing rendered twice), `a11y`
  (axe, WCAG 2.2 AA + best practice, at 390 and 1440 px, in Void and
  Flight Manual, every page in full, and both kinds of 404), `layout` (no
  sideways scroll at 320–1920 px, and the header's parts fit without
  overlapping), `theme` (no flash of the wrong theme, persistence across
  reloads, pages and tabs, Auto following the OS, Pause motion, the stored
  theme on an unknown post or project URL), `chrome`
  (the menu sheet's focus, `inert` and closing; the current nav section),
  `contact` (routes pick the form's topic by click and by fragment, the
  message field's prompt matching its route's, field
  checks, a refused send keeps the draft and its stale alert clears after
  leaving and returning, Consulting hidden while off, no email address or
  phone number, the no-JavaScript LinkedIn alternative; sends only on the
  fixture build, which has no Resend credentials), `log` (the first
  entry in the first viewport at 1280×800 and 390×844 in both themes, LOG
  numbers that count up from the oldest entry and hold on the archive and
  tag pages, tag chips and their counts, 404 for an unknown or malformed
  tag, the archive's search and its no-JavaScript list, the chart's marks,
  and the prefetch budget on `/blog`), `post` (every entry's first
  paragraph in the first viewport at 1280×800 and 390×844 in both themes,
  a 60–75 character measure, code comments at 4.5:1 or more, the "In this
  entry" counts against the text, Copy on a listing, the phone's record
  box, the solid header, print, BlogPosting and BreadcrumbList; on the
  fixture build also the wide listing and highlighted line, footnotes and
  margin notes, the caution callout and revisions, their RSS output, and
  in-page links landing in the visible entry after a client-side
  navigation), `orbit` (a CV row lights its orbit and back, a click pins
  a record and a second click or Escape releases it, Earlier and Later,
  "Show on map", the view switch, every orbit labelled on a phone, and
  without JavaScript the labels as links to their rows), `print` (the CV
  on two sheets on A4 and on Letter, without the map, chrome or
  controls), `missions` (every old `/portfolio` fragment still answers
  and leads on, the register lists every mission, each mission file has
  its head, record, pager and no stand-in text, Read the write-up lands
  on the write-up; on the fixture build a filled mission shows every
  module with its callouts linked to their sections, and a planned one
  none of them), `home` (the hero's name, status line and quick links,
  CV first, in the first viewport at 1280×800 and 390×844 with and
  without JavaScript; the starfield `running` only on screen, in a
  visible tab, in Void and with motion allowed; the credit, and the drawn
  limb in Flight Manual; the acts numbered in order with their section
  links; an orbit label leading to its row; no gap wording and no old
  artwork), `crew` (the Crew File's head with the patch and no portrait,
  its record, the sections numbered in order with their links, Get in
  touch, no gap wording; and no page keeping the old design's roots,
  classes or tokens),
  `budgets` (the brotli byte report, printed,
  not enforced yet; page prefetches and route trees apart), `screens` (review screenshots in both themes and the
  `/resume` print PDF, attached to the HTML report) and `studio` (the embedded Studio
  with JavaScript, fixture project only: it boots to its login screen and,
  signed in against the stand-in API in `tests/e2e/support/sanity-api.ts`,
  shows the structure under `/studio` and a new project's form with no
  uncaught exception).
    - `pnpm test:e2e` runs the `fixture` project: Playwright builds the site
      with `NEXT_PUBLIC_STORE_SANITY_PROJECT_ID=fallback` and
      `SANITY_USE_FIXTURES=1` (this overwrites `.next`), then serves it with
      `next start` on port 3100 (`E2E_PORT`). Off-origin requests are
      stubbed, so the run is offline. Locally a server already on the port is
      reused: start a fixture build by hand to iterate on specs quickly.
    - `pnpm test:e2e:preview` runs the same specs against a deployment:
      `BASE_URL=<url>`, plus `VERCEL_AUTOMATION_BYPASS_SECRET` for protected
      previews (sent to that origin only, and never traced, because traces
      record request headers and CI uploads the report). CI runs it on every successful
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
