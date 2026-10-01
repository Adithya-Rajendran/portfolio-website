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
      defined there and nowhere else. `--accent`, International Orange,
      means "now" (premium D1): the Open To, Active and Current status
      dots, the flight's flown path and its now mark, a contents' current
      section, the one 2px rule on an invalid field, and `--focus`; the
      patch's and the hero's suns are identity marks (`data-identity`).
      It is never text, a fill, a link rule, a hover or an error's words:
      those are ink, the primary button an ink-1 fill with a `--bg`
      label. A viewport carries two orange marks at most
      (`tests/e2e/accent.spec.ts`). Type (premium D2): a page sets six
      sizes at most, 13px (`--label-size`, every label, control and
      datum) the smallest, then `--step-0` (UI text) and the heads; see
      the fonts note below.
    - `styles/base.css`, `layout.css`, `components.css` (the shared design
      system: header, footer, buttons, section tags, photographs and
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
  script (under 700 bytes, unit-tested) that `ThemeBootScript` renders in
  both root documents' `<head>`: it reads localStorage `ar-theme`
  (`void` | `manual` | `auto`, the visitor's choice, which always wins;
  missing means Void, except on a post, `/blog/<slug>` (`POST_PATH`),
  which follows the OS like `auto`, so a light system reads it in Flight
  Manual: premium D3) and `ar-motion`
  (`full` | `reduced`), and sets `data-theme`, `data-motion` and `data-js`
  on `<html>` before the first paint. After a client navigation
  `RouteMarker` applies the new path's default the same way
  (`applyRouteTheme` in `lib/prefs.ts`), and the footer's choice shows
  the preference in force there (`themePref`: System on a post, Dark
  elsewhere, until one is stored). The server renders the literal
  `data-theme="void"` and never `data-motion`, so without JavaScript there
  is no spatial motion; never read a cookie for this, it would make every
  route request-bound. The header's `ThemeSwitch` (one button, Void ↔
  Flight Manual) names the theme it switches to from `html[data-theme]`
  in CSS, so under Auto it follows the screen; the footer (from 960px)
  and the menu sheet (below it) carry `ThemeChoice` (Void · Manual · Auto,
  a `Segmented`), so each control shows once per breakpoint; it
  reads `lib/prefs.ts` through `useSyncExternalStore` (server snapshot
  `undefined`). Spatial motion runs
  only under `html[data-motion="full"]` and
  `prefers-reduced-motion: no-preference`. Fonts come from `lib/fonts.ts`
  (their variables on `<html>`), each with one job: Jost for display
  (page and item titles and the hero's name at 350), headings, UI text
  and the controls' one caps voice (the nav, buttons, arrow links and
  segmented boxes: 500, 13px, 0.10em); Newsreader for reading; DM Mono
  for data and every label (`.label`, `--font-label`: caps, 13px,
  0.08em, ink-2); Michroma in two places only, the header's wordmark and
  a page head's themed tag (`--font-mark`). There are no glyph
  ornaments. Italic Newsreader is its own family,
  `var(--font-long-italic)`, so it is not preloaded. DM Mono's regular is
  preloaded with Jost and Newsreader's roman: its fallback sets lowercase
  about a fifth narrower, so a wrapped mono line in the first viewport (a
  project's stack on a phone) re-wrapped on arrival and shifted the page;
  its medium (a listing's keywords) is its own call and is not. The
  chrome (header, footer, section marks) sets nothing in italic, so that
  file loads only on pages whose text is italic (an `<em>` in a post);
  keep it that way.
- **Dates in render.** Never call `new Date()`, `Date.now()` or
  `Math.random()` in render outside `"use cache"`: the build fails, or the
  page becomes request-bound. "Today" is `getToday()` from `lib/clock.ts`
  (cached for a day); the copyright year and the flight's "now"
  derive from it. Random-looking art is seeded (`lib/sky/`).
- **The mission patch** is generated: `node scripts/generate-patch.mjs`
  writes the sprite symbol (`lib/patch.json`), the share card's patch
  (`assets/patch.svg`, the emblem on a void disc), `app/icon.svg`,
  `app/apple-icon.png` and `app/favicon.ico`. Never edit those by hand.
  The favicon is the patch reduced to what 16 px keeps: a heavy AR
  monogram (stroke 14/200) over the patch's orange sun, which keeps its
  orange at every size, on the void disc; no lettering, stars, orbit or
  parallels; and a `prefers-color-scheme` edge for dark tab strips. The
  ICO holds 16, 32 and 48 px PNGs. The apple icon is the emblem without
  the ring's lettering.
- **Share images.** Every page draws the Deep Field card
  (`lib/og-card.tsx`, which re-exports the routes' `OG_SIZE` and
  `OG_CONTENT_TYPE` from `lib/site-metadata.ts`); `/`'s card stands in for
  any page without its own. Every card names the author: a section's card
  leads with the name in capitals, tagged with the section's plain name;
  a post's or project's card signs its footer ("Adithya Rajendran · 30
  Mar 2026 · 7 min read", or the type and status) beside the item's own
  address. The footer is one size (DM Mono 20 px) on every card: the
  address takes a line of its own, at the right, when the two do not fit
  one. No LOG or MSN
  code, no orange dash and no stars (they are the home hero's alone). The home and `/contact` cards add the
  availability line as a keyed status line (● Open to …, the key in DM
  Mono caps; the section's tag beside the patch is the card's one
  Michroma) when the profile has one. A route's `alt` export is one string, so a post, a
  project and home name their card in their own metadata
  (`shareImage` in `lib/site-metadata.ts`, the built URL from
  `lib/route-tags.ts`): "<title> by Adithya Rajendran", and home's from
  the profile's name, headline and availability. A page's `openGraph`
  replaces its parent's whole, so home repeats the site's fields
  (`siteOpenGraph`).
  Satori takes TTF, not WOFF2,
  so the card reads static copies from `assets/fonts/og/` (each with its
  OFL licence) once at module scope, which keeps the image prerendered.
- **The CV** (G3). `/resume` is the CV as one list, server-rendered with
  no island of its own; under the head, one quiet link, Timeline, goes to
  the flight (`siteRoutes.trajectory`), the record's one view in time
  (premium D3 retired the 2D orbit map, its List | Timeline switch,
  "Orbit 0n" codes and "Show on timeline"). The head carries Download CV
  (PDF) as the primary and Contact: no Open PDF, Print or Share (the
  browser's Print prints the CV).
  `lib/cv.ts` words the rows' dates as the résumé gives them and derives
  no length of time from them. A role's long parenthetical ("Field
  Software Engineer I (promoted from …)") is split by `splitTitle`
  (lib/trajectory.ts): the title, then the words as a quiet note under
  the organisation (`CvItem note`). Project rows carry no status or
  stack: the dates, else "Ongoing" for an active project, then the type,
  the lines and the links (every project is listed, so no "All
  projects"). A link to the site itself is never an external link
  (`cvProjects` with `siteUrlOf`/`sitePostSlug` in lib/cv.ts): one to a
  published post opens it in place (`/blog/<slug>`, no ↗ or new tab; its
  address still prints), and the site's own address is left out.
  Writing & talks is the latest three entries as plain rows (date ·
  linked title), with All writing only when /blog has more, then the
  talks. Every credential is the same plain row (`cvCredentials`): the
  span ("Sep 2023 – Sep 2026"), or the issue date without an expiry,
  then the name, linked to its verification page when the record has
  one, and the issuer; the current ones, then Prior certifications, on
  screen and on paper, with no status ("Expired", "No expiry").
  The print is the only paper artefact: two sheets on the named
  page `cv` (`styles/print.css`), sheet 2 breaking before its control
  line; the masthead keeps each address and opening whole (`Unbroken`),
  and the site's address stays on it. `[data-print="only"]` forces
  `display: block !important` from a
  layer, which no unlayered rule overrides, so a print-only part that
  needs another display sits inside a print-only container instead.
- **The flight** (`/resume/trajectory`, noindex, reached from `/resume`).
  The head is one crumb line (`CrumbRow heading`: Experience, linking to
  `/resume`, / the small h1 Timeline, and "Skip to the list"), so the
  pinned stage starts just under the header and its rail and Play show in
  the first viewport at 1440×900. The page has its own canonical,
  `og:url`, "Timeline | Adithya Rajendran" and share card (tag
  Trajectory, title Timeline). `components/trajectory/journey.tsx` is the
  record: each card is the title, one DM Mono readout under it (the
  chapter's dates as written; in flight the date, ticking, and the phase,
  "May 2024 · Transfer"), "● Current" on the current chapter, the
  organisation, a note and a line, and Full entry; no big date, kind
  label or readout on the plan's card, which states Open to with a quiet
  Contact (the profile's button follows the stage, with the one way back,
  "The full record"). On a phone Full entry shares the readout's row;
  the plan's card has no readout, so its Contact stays under the
  openings. The scene (`flight-gl.ts`) names each world by its
  organisation alone (DM Mono 13px caps), only at a hold and in the finale:
  the world left behind fades as the ship leaves, the next is named as
  its hold begins, and nothing is named through a transfer. Flight
  Manual prints no city lights. A still flight (reduced motion, Pause
  motion) opens on the whole system with the latest chapter's card; the
  ask stays the rail's last stop. The figure line is "Not to scale ·
  Maps: NASA, Solar System Scope (CC BY 4.0)".
- **Prefetching** (plan §4.6 rule 8). The app-wide `partialPrefetching`
  flag is off: in Next.js 16.3.4 it made the first request for an unknown
  post or tag slug answer 200 instead of 404 on `next start`. The two
  list-heavy routes opt in per segment instead
  (`export const prefetch = "partial"` in `blog/[slug]` and
  `blog/tags/[tag]`, which keeps the 404), so the links to them on a page
  share one prefetched App Shell and the entry loads on the click. Links
  that repeat another link on the page pass `prefetch={false}`. A first
  view stays within 8 page prefetches
  (`tests/e2e/log.spec.ts`); each distinct URL also fetches its small route
  tree (`/_tree`), which the byte report lists apart.
- **The long read** (G1). `lib/prose.ts` `indexProse(body)` numbers a
  Portable Text body once: listings (the number only keeps their
  accessible names apart, "Listing 3, Bash, install.sh", and prints
  nowhere; one width per body, all
  wide once any line passes `LISTING_MEASURE`, the 64 columns of 13px
  mono the measure fits), plates and figures (Pl. I for photographs,
  Fig. 1 for diagrams, plots and screenshots; a post's cover is the lead
  plate) and footnotes (in reading order, written onto a copy of the
  body's markDefs). The post page, the project essay and the RSS feed
  (`lib/feed.ts`) all read it, so they agree; render `index.body`, not
  `post.body`. An entry's rail is its contents only: the date, the read
  time and any revision are the head's, and no record box repeats them or
  counts its words. The text has one numbering per thing: no margin
  number beside an h2 and no number in the contents (the headings have
  names), no line count or number on a listing (its bar is the file
  name, then the language and Copy at the right, in the listing's mono;
  the feed names it the same way, "Bash · install.sh"), and the LOG
  number in the crumb only. A listing is one treatment (the surface fill; hairlines
  above and below on paper); a callout is the quotation's quiet note (the
  ink rule) led by its tone and title in bold ("Caution: Back up first",
  `calloutHeading`), with no colour, frame or band; inline code has no
  box. Prose h2 are `--step-2` (32px at most), the leading 1.52
  (`--lh-long`), figures proportional. The entry closes once, in its
  own column: End of entry, "Questions about this entry? Send a
  message.", "Follow: RSS · LinkedIn" (`FollowLinks`, also /blog's head),
  Copy link and All writing; then the pager by name only (no heading, no
  LOG number, date or read time), the project it belongs to (the shared
  `MissionRow`) and related entries. There is no Author block: the
  footer carries the name. The renderers are
  `components/blogs/portable-text-components.tsx` and
  `components/prose/`; a new `contentBody` type lands with its web and
  feed renderer in the same change. `components/blogs/post-reader.tsx`
  marks the current section and resolves in-page links (`#fn-1`, the
  contents) inside the visible entry, because a hidden, still-mounted
  entry can hold the same ids. Reading pages (lib/navigation.ts
  `headerMode`) get `html[data-header="solid"]` from RouteMarker.
  Every writing route names the feed through `feedAlternates` (lib/feed.ts:
  a page's `alternates` replaces the layout's whole). `/feed.xml` is
  served as `application/xml`, so a browser displays it through
  `public/feed.xsl` (a plain page in the Void's colours and system fonts:
  the title, "Copy this page's address into a feed reader.", the posts);
  browsers are retiring XSLT, and without it the feed shows as XML, as it
  did before. `/rss.xml`, `/rss`, `/feed` and `/atom.xml` answer 301 to it
  (next.config.mjs; 301 because old feed readers move a subscription on
  it).
- **Missions** (G5, G6). `lib/missions.ts` is pure and unit-tested: it
  words each project once (`toMission`) for `/portfolio`, the mission files
  and the home page's projects (the stage and its rows), and finds each
  one's write-up from the list data (`originalEntries`; `writeUpHref` is
  where "Read the write-up" goes). A project's title is its heading
  everywhere (the stage, a tile, the file's h1 and its share card), in
  sentence case: no project name is set in capitals. Its short name
  (`project.name`, "Homelab") is the owner's, never derived from the
  slug, and is the crumb's and the pager's words (`Mission.label`, else
  the title); the order
  (`missionOrder`) is the featured slots, then the mission number, then
  the list query's, and `missionTiers` splits it into the flagship, the
  next ones with room of their own (two tiles on `/portfolio`, two rows on
  home) and the rest, least prominent; the files' previous / next go by
  mission number (the pager has no "All projects": the crumb leads back).
  `/portfolio` is the head, then the tiers with their section names for
  screen readers only (no visible "Featured project" or "More projects"
  row, no "Experience & CV" link and no related pages); the stage's copy
  is top-aligned with its plate, and a card (the stage, a tile) lists the
  first four stack items (`CARD_STACK`); every stack item is kept whole
  (`MissionStack`). The mission number (MSN-02) is the project page's quiet
  identifier, in its crumb only: `MissionLine`, the stage, the tiles, the
  plates and the home page print none. Numbers appear only on a project
  page: its head's stats (`headStats`) unless it has a results table,
  which carries them with their notes; the index has no counts, register
  or card stats. `missionLayout` picks the page's layout: the full file
  where there is evidence (a brief that adds to the card, `briefAdds`;
  results, lessons or next steps, callouts, a photograph, an essay in
  sections), otherwise the short note (title, summary, the highlights that
  add to it via `noteLines`, the facts and links). Either shows the essay
  (Case study) only when it says more than the summary, highlights and
  brief (`essayShown`: a heading, a non-text block or eight content words
  they lack, counted by stem in `newWords`). On the stage "Read the
  write-up" (a quiet link) goes to the original entry, else to that
  essay; in a file's head it is a quiet link to the original entry only
  (nothing points down to the page's own essay). The head's facts
  (`factRows`): the Stack row (left out when the page's words already name
  every item, `stackSaid`: the Kubernetes note), Code (the repositories,
  `MissionLink.code`), Role, the named parameters the stack and the card's
  text do not name (`splitParameters`: "Feed: RSS" beside "…RSS feed"), and
  the other links while there are two links or fewer in all (else they
  are the References section). A link to the site itself (a post, or its
  own address) is never an external link. The results table is named by
  its "Results" heading (`aria-labelledby`, no caption), and on phones each
  note moves under its row. A mission's Flight Log entries are
  derived (`missionEntries`): the posts that reference it, and the posts
  its links, its essay and its model's callouts point at; the original
  entry is the first linked one, else the oldest referencing one. Links to
  the site's own posts are entries, never external links; Related writing
  lists them flat, without tags. The 3D viewer's server part
  (`components/viewer/viewer-figure.tsx`) is the model's poster as a
  plate, and its callouts are plain hairline rows under "Parts of the
  build" (the part and what it does: no balloon, number or link until the
  drawing lands; the write-up is linked once, in the head); PR 15 mounts
  the drawing in its `data-viewer` slot, and with it the model's
  description (`model.alt`), which describes the drawing, not the
  photograph. A lone photograph outside the long read (the stage, a tile,
  a project's head) carries no plate number: `Plate`'s `label` is
  optional, and Pl. I… number the long read's plates only. Every
  photograph follows one plate rule (`.photo` in styles/components.css):
  a hard edge in a hairline, then the caption, with an even card mat
  inside the hairline in Flight Manual; nothing on the photograph (no
  number, feather, glow, crop marks or sepia) and no hover of its own.
  The file
  closes with one row, "Questions about this project?" at a section
  head's size and Send a message (`Ask`), then the pager; the close is
  the last section, so its own padding ends the page. The file reuses
  `PostReader`, so its in-page links resolve inside the visible file.
  The old `/portfolio` fragments (`#experience`, `#skills`,
  `#certifications`, `#engineering-writing`, `#contact`) are sent on to
  the pages those sections moved to by RouteMarker on the client
  (`movedFragment` in `lib/navigation.ts`); `#projects` is the tiles.
- **The home page** (plan §6.2 row 13, contract §9). The hero
  (`components/home/hero.tsx`) is NASA's orbital sunrise, pre-encoded by
  `node scripts/generate-hero-sunrise.mjs` from `assets/artwork/` into
  `public/images/hero-sunrise-v<n>/` and `lib/hero-sunrise.json` (bump the
  version on every re-encode). The photograph is screen-blended over the
  starfield in Void; under it, and alone in Flight Manual and print, an
  SVG draws the limb from circles fitted to the photograph, in the same
  cover crop, so the two stay aligned at every size. The starfield
  (`components/sky/starfield.tsx`, the site's only ambient motion) is a
  seeded canvas over `StaticStars` (the site's only star layer: no page
  head, index or reading page carries stars, and Flight Manual none at
  all), which it hides once it
  has drawn: it runs at about 30 fps only while the hero is on screen, the
  tab is visible, the theme is Void and motion is allowed, keeps stars off
  `[data-clear]` text, reports `data-state` (`running` | `stopped`) and
  stops in its effect cleanup, because a visited page stays mounted. A
  second observer sets `html[data-hero]` while the hero's name (its h1)
  shows below the header (in both themes; the cleanup clears it), and the
  header's wordmark steps aside meanwhile, so the name is on screen once:
  never twice, and never not at all while the rest of the hero, or the
  projects the quiet link lands on, fill the view. Without JavaScript it
  stays. Over it: the name, the profile's headline and the availability
  line (only when set), each split into parts kept whole (`OpenToItems`)
  that stack on phones, then one action (CV, the hairline `.btn`, no
  fill or blur) and one quiet link down to the projects (`#home-projects`,
  the sprite's `arrow-down`). The foot: the credit with the frame's ID
  ("Photo: NASA / Expedition 72 · ISS072-E-30246", `id` in
  `lib/hero-sunrise.json`) and Pause motion. Then the sections, each only
  with content (`lib/home.ts`, unnumbered): the strongest project on its
  stage (featured slot 1, led by its summary, no stats, mission number or
  write-up link: its page links the write-up), the next two as rows and
  any others as one line (`homeProjects`); the latest three entries,
  without tags; and the close, headed by the owner's one-line statement
  (`taglineOf`: the tagline, else the introduction's first sentence;
  "Contact" for screen readers without one) with a quiet link to About's
  current focus, the profile's `availability.cta` → `/contact#hiring` as
  the one primary while there is an Open To line, and Send a message as
  a quiet link. On phones a section's link stays on its heading's line.
  The page stays under about 4,500 px at 1440 and 7,000 px at 390
  (`home.spec.ts`). In Flight Manual the hero draws the planet's
  parallels under the limb and has no foot row; on home the footer leaves
  Pause motion to the hero. Pause motion is an unboxed control (the icon
  and "Pause motion" in ink-2, sentence case, a 44px target), in the
  hero and the footer alike.
- **About** (`/about`, themed Crew File; plan §6.2 row 14, contract §9).
  The patch is the identity mark (a `PageHead` `figure`; the site shows
  no portrait; the head has no actions, the header carrying Experience
  and CV, and no dek, the record stating the headline's facts), then the
  record (`CrewRecord`: one hairline title block, Name in ink, Studying,
  Previously, Focus, Links; no Open To, edit date or accent cell). A role
  is set as on /resume: the title, then the organization and the dates as
  whole parts (`OpenToItems`, so no line ends on a dot), then the
  title's parenthetical (`splitTitle`). Then `DocSection`s (`components/ui/doc-section.tsx`, the
  one section head: also the mission files, `/contact` and the CV on
  `/resume`): the biography and the Now list grouped by
  `currentCuriosities[].kind` (`nowGroups`; a kind's label only when there
  are two or more, and no Q1… numbers), each only when it has content,
  then the close (`components/ui/ask.tsx`: "Questions or ideas?", Send a
  message). The writing, the talks and the other sections are one click
  away in the nav, not repeated here. Its
  section ids are prefixed (`crew-…`, and the home page's `home-…`)
  because a visited page, still mounted, can own the same fragment. No page carries the old design: there is no
  legacy stylesheet, token, class or icon library left, and
  `tests/e2e/crew.spec.ts` checks every static page for one.
- **LOG numbers** are derived, never stored: `logNumbers` in
  `lib/designations.ts` numbers published posts by `publishedAt`, oldest
  first (LOG 001), ties by document id. Number the whole list, then filter
  (`logEntries` in `lib/log-index.ts`), so a tag page keeps each entry's
  number. A post back-dated before an existing one renumbers those after
  it. The number is an entry's quiet identifier on its own page, in the
  crumb only (and the print masthead, where the crumb does not print):
  never the end mark, the pager, a plate or a share card; the
  lists print the date instead, with "Updated …" only after a real
  `revisedAt`.
- **Writing's lists** (G8, `/blog`, the archive, a tag page). The index
  is the head (the writing description and the follow line; no search
  and no boxed buttons), the rows, then a quiet "Archive" link. A tag
  shows only when it links: once it gathers two entries
  (`linkedTags`/`TAG_LINK_MIN` in lib/tags.ts, `LogEntry.tagLinks`), on a
  row, an entry's head, the chips and the sitemap, and never with a "#";
  a one-entry tag's page still answers. A list groups by year only when
  its entries span two (`LogIndex`). A tag page's h1 is the tag in words
  (`tagLabel`: "GPU computing"), with no dek; the archive and tag heads
  carry no actions (the header's Writing leads back).
- **Heads and names** (contract §1, §6). Every section is named by its
  plain label, Projects · Writing · Experience · About · Contact
  (`lib/navigation.ts`), in the header, the menu sheet, the footer, page
  titles, breadcrumbs and buttons. A section's themed name (Missions,
  Flight Log, Trajectory, Crew File, Comms) is only the small tag above
  its page's h1 (`PageHead tag`) and on its share card (`OgCard tag`).
  Section heads (`SectionTag`, `DocSection title`) are the plain name as
  a Jost h2; nothing is numbered (no § numbers).

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
  `inert` and the Tab loop. The sheet holds the five sections and the
  theme choice only (the feed is in the footer).
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
- **Loss of Signal** (`components/los/`, the 404 and the error page):
  the page head (tag "Loss of signal · 404", or "Error · 500" with Try
  again), a carrier trace shown already drawn (nothing on the page
  animates), then three rows, Projects · Writing · Contact, and "Found a
  broken link? Let me know". The 404 is one prerendered page for every
  address, so what follows the missed address is read on the client
  (`useRequestedPath`, server snapshot `null`): the Requested line, the
  primary (`lostSection` in lib/navigation.ts: "All writing" under
  `/blog/`, "All projects" under `/portfolio/`, else Home), the rows
  without the section the primary offers (`lostRoutes`), in as many
  columns as rows, and Let me know,
  which carries the address to the form (`reportHref`:
  `/contact?broken=…#hello`). Without JavaScript it is Home, the three
  rows and `/contact#hello`.
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
  redirects, icons, `/.well-known/security.txt`, API routes and the
  Studio) with the tags of the content it shows. `warm(tag)` in `actions/warmCache.ts` requests every route
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
  answers with the form's plain failure line ("The message could not be
  sent.") if its required vars are missing rather than throwing at module
  load.
- **`security.txt`** (`public/.well-known/security.txt`, RFC 9116): Contact
  is the `/contact` form, never an address; `Expires` must stay within a
  year, so renew it yearly (the smoke spec fails once it lapses).
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
  `/contact` (`/portfolio#contact` is sent on to it) and dispatches `sendEmailAction`
  from `onSubmit`, so React never resets its controlled fields. It needs
  JavaScript for BotID, so its wrapper is `.js-only` and a `<noscript>`
  block offers LinkedIn instead. The routes, which are the form's topics
  (`hiring`, `research`, `consulting`, `hello`), live in `lib/contact.ts`: Hiring
  shows only while `availabilityLine` has a line (as on home and the CV),
  Consulting only while `availability.consultingOpen` is on, and the
  topic's name prefixes the email subject. Each route's title and prompt
  are the profile's (`contactRoutes`, Studio group Site copy); a route
  without a title takes its topic's name. A prompt is only the message
  field's optional placeholder once its topic is chosen; the page gives
  no "include" instructions. The page is the head (the introduction and
  `Availability`), then the form, whole in the first viewport at
  1440×900 under the Message section's plain hairline (the limit is the
  field's hint, for screen readers; the counter shows only when 100
  characters or fewer are left), then the profiles. The Topic radios,
  one per line, are the routes (premium D3 folded the Topics column into
  them): each is named by its title and described by the owner's line
  where there is one (Research: `contactInvitation`, a `Segmented`
  option's `description`), and the routes carry no links. From 960px the
  radios sit in columns 9–12 beside the fields (so Send stays in the
  first viewport); on phones they lead the form. The form reads
  the fragment (`#hiring`) to pick its topic on arrival and writes it
  back when a topic is picked.
  The only words about the owner's situation on a button are the
  profile's (`availability.cta`: the home close and the flight's close); code keeps a neutral verb ("Send a message"). Contact is one click from
  every page: the nav from 960px, and a link in the header bar below it. `sendEmail` sends a topic whose route is not
  shown (a crafted POST) as a hello, and treats Resend's returned
  `{ error }` as a failure: Resend 6 does not throw on API errors. A `"use server"` module may export only async
  functions (anything else reaches the client as a server reference), so
  the form's state type and initial value live in `lib/contact.ts` too.
  `/contact` reads its fragment (`#hiring`) and a broken link's report
  (`?broken=`, `reportedMessage`) on the client, never `searchParams`.
  The fields are the draft (`components/contact/contact-draft.ts`, read
  through `useSyncExternalStore`): kept in sessionStorage inside
  try/catch, restored on reload, forgotten once sent; a report starts the
  message only when no draft is waiting, and its query leaves the address
  bar. The email is checked when the reader leaves it filled, and every
  field (an empty one too) from the first submit (`shownErrors`). The
  server's words (lib/copy.ts `contactCopy.form`) are plain: a field
  problem comes back with its field (`invalid`, under that field); any
  other refusal, and a send the network loses (caught in the form, never
  the route's error page), is the failure under Send: "The message could
  not be sent. Your text is still here." (or the reason: too many, not
  verified), with Try again, Copy message and Message me on LinkedIn. A
  sent message is "Message received." (focused) and Write another
  message, and promises nothing: no reply address, no reply time, no
  auto-reply.
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
  introduction, availability and its button `availability.cta`, the Now
  list, focus areas, the biography, the page introductions `workSummary`,
  `writingDescription`, `projectsIntro` and `contactIntro`, the contact
  routes' words, and each project's short name `project.name`);
  `lib/copy.ts` holds only structural labels (names, section titles,
  button verbs, form mechanics). When a profile value is empty its
  element is left out, never replaced by wording in code; the RSS
  channel, which must have a description, uses the feed's title.
  `design/impl-log/phase-4-copy-audit.md` classifies every string.
  Availability is `availability.seeking[]` (one line per opening, joined
  with " · " by `availabilityLine` in `lib/profile-content.ts`); the older
  single `openTo` line is deprecated and read only while that list is
  empty. On the page the line is split back into its openings
  (`OpenToItems` in `components/ui/availability.tsx`, `.open-to`), each
  kept whole: where it wraps, the dot falls at the line's start and is
  clipped, so no line starts or ends on a separator; the hero, centred,
  stacks them on phones.
- Real content only. A date known only to the year is stored as any day in
  that year with precision `year` (`timelineEntry.startPrecision` and
  `endPrecision`, `profile.launch.precision`, `project.datePrecision`), and
  the site prints the year alone (`formatTimelineDate` in
  `lib/profile-content.ts`, `formatProjectYears` in
  `lib/project-content.ts`). Never print a month or day the owner has not
  given. Project dates the owner estimated set
  `datesApproximate` and print with "c." ("c. 2024–2025").
- The owner's four résumé projects are drafted, with the source of every
  value, in `migrations/seed-resume-projects/data.ts`, which follows the
  owner's published corrections (2026-09-29: the Gmail project's notebook
  evaluation and dates, the homelab without measurements the résumé does
  not state). The seed migration
  writes them as Studio drafts, and `lib/fixtures.ts` lists the same four
  (without images, and without links to posts that are not fixtures). Any
  other fixture project, and every fixture post, is named as a fixture and
  describes no real work. The fixture profile holds only the owner's
  published values, plus the Open To lines and Site copy from
  `design/impl-log/phase-4-profile-copy.json`: a field the real profile
  leaves empty stays empty. The fixture projects' short names come from
  the same file (none for the Gmail project, whose title leads).
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
  violations; share images, and a post's, a project's and home's image
  alt in their own words; feed, icons, headers, redirects, the Studio
  without chrome; the feed's four aliases answering 301, every writing
  page naming the feed, and the feed as a plain page in a browser; each
  404's primary following the missed address, its rows without that
  section and nothing animating; `security.txt` pointing to the form,
  unexpired), `nojs` (complete pages without JavaScript: header, nav
  through the popover menu, footer, Void with no motion and no theme
  controls, no hidden streamed segments, nothing rendered twice; the 404's
  Home, three rows and plain report), `a11y`
  (axe, WCAG 2.2 AA + best practice, at 390 and 1440 px, in Void and
  Flight Manual, every page in full, and both kinds of 404), `layout` (no
  sideways scroll at 320–1920 px, the header's parts fit without
  overlapping, and no visible text under 12 px, generated text included,
  on home, every post and project, `/resume` and `/contact` (with the
  message counter near its limit) at 1440 and 390; on home, every post
  and project and `/resume`, six font sizes at most, and every caps line
  a label, a control, the hero's name or Michroma's two places), `accent`
  (two orange marks at most in the first viewport of home, `/portfolio`,
  Homelab, a post, `/resume`, the flight, `/contact` and `/about`, at 1440
  and 390 in both themes, identity marks and focus aside; the primary an
  ink fill, the nav's bar and the header's CV ink), `theme` (no flash of the wrong theme, persistence across
  reloads, pages and tabs, Auto following the OS, a post following the
  OS until a theme is chosen while every other page stays Void, on a
  full load and after a client navigation, Pause motion, the stored
  theme on an unknown post or project URL), `chrome`
  (the menu sheet's focus, `inert` and closing; Contact in the bar on a
  phone; the current nav section; the header and footer naming every
  section plainly; the footer naming the owner once, with one CV link and
  the theme choice only from 960px),
  `contact` (the routes are the form's Topic radios, each named by its
  title and described by the owner's line, with no Topics column or
  links beside the form, and a fragment picks one; a route's prompt
  only as the message field's placeholder,
  the whole form in the first viewport at 1440×900, Hiring only beside an
  Open To line, the email checked on leaving it and every field from the
  first submit, each error under its field (the words in ink with their
  cross, the field's one 2px orange rule), the counter only near the
  limit; a refused send under Send with the text kept and Try again, Copy
  message and LinkedIn, its stale alert clearing after leaving and
  returning; a send the network drops staying on the page, Try again
  sending again and the draft surviving a reload; "Message received."
  focused, promising nothing, and a fresh form; the 404's
  report arriving with its address, Consulting hidden while off, no email
  address or phone number, the no-JavaScript LinkedIn alternative; sends
  only on the fixture build, which has no Resend credentials, a sent one
  being its refusal answered as sent), `log` (the first
  entry in the first viewport at 1280×800 and 390×844 in both themes,
  entries newest first in the same order on the archive and tag pages, no
  LOG numbers and no chart on the index, "Updated" only after a revision,
  a tag (on a row or a chip, never with "#") only once it gathers two
  entries, a year head only across two years, the head's follow line
  with no search or boxes, the chips' counts, the archive linked after
  the index, a tag page's h1 in words with no dek, 404 for an unknown or
  malformed tag, the archive's search and
  its no-JavaScript list, and the prefetch budget on `/blog`), `post`
  (every entry's first paragraph in the first viewport at 1280×800 and
  390×844 in both themes, a 60–75 character measure, code comments at
  4.5:1 or more, the rail listing the sections with no record box or word
  count or numbers, the LOG number once, above the title, and nowhere
  else; no h2 margin number or listing line count or number, h2 at 32px
  or less and a 1.52 leading; the close (End of entry, the follow line, no Author block or
  pager heading, the pager by name), Copy on a listing, the
  phone's contents box, the solid header, print, BlogPosting and
  BreadcrumbList; on the
  fixture build also the listings at one width with no line cut and the
  highlighted line, footnotes and
  margin notes, the caution callout as a quiet note and revisions, their
  RSS output, and
  in-page links landing in the visible entry after a client-side
  navigation), `resume` (Contact and the quiet Timeline link to the
  flight in the first viewport, with no view switch, map, orbit codes or
  buttons, and no Open PDF, Print or Share; no project link opening the
  site's own address in a new tab, and every credential one plain row
  with no status and no heading of its own; the same page without
  JavaScript), `print` (the CV
  on two sheets on A4 and on Letter, without the chrome, the controls or
  the Timeline link; Prior certifications and never "Expired"; each masthead
  address and opening on one line), `trajectory` (the flight's crumb head
  with the rail and Play in the first viewport, its own canonical and
  card, the record holding still while scrubbed, one readout ticking
  under the title, the worlds named without dates and never mid-transfer,
  a still flight opening on the latest chapter, a phone's cards in
  reading order, axe in both themes, and
  the scene drawing, surviving a lost context and a return), `missions` (every old `/portfolio` fragment sent on to its
  page, the index links every project with no counts, register, mission
  numbers or related pages, titles in sentence case and four stack items
  at most on a card, the flagship's title and View the project in the
  first viewport at 1440×900, each project page has its crumb (its number
  never split), its title
  as the heading, close and pager and no title block, revision, "Table 1",
  jump to its own write-up or stand-in text, a stack item never split, a
  thin project is a short note (the Kubernetes note without a Stack row),
  Read the write-up lands on the original entry; on the fixture build a
  filled mission shows every module, its repository in the facts and its
  callouts as plain rows, and a planned one none of them), `home` (the
  hero's name, availability, CV and the quiet link down to the projects
  in the first viewport at 1280×800 and 390×844 with and without
  JavaScript, each part of the headline and the Open To line on one line;
  the name at 350, tracked 0.11–0.12em, on one line at 1440 and 1,400px
  wide at most at 1920; the header's wordmark hidden only while the hero's name is in view: back
  at 400px down and after the quiet link to the projects; the starfield
  `running` only on screen, in a visible tab, in Void and with motion
  allowed; the stars in the hero only, and not on paper; the credit with
  its frame ID, and the drawn limb in Flight Manual; the sections in
  order, unnumbered and without themed names, with their links, and the
  latest writing without tags; the close headed by the tagline, its
  button only in the profile's words and only beside an Open To line, one
  primary at most; the flagship without stats or mission number, its
  title in sentence case over four stack items at most; the page's height
  at 1440 and 390; no gap wording and no old artwork), `crew` (About's
  plain title with the patch and no portrait, head actions or dek, its record
  without Open To, an edit date or an accent cell, the sections by their
  plain names, no question numbers, no writing index or related pages,
  Send a message, no gap wording; and no page keeping the old design's
  roots, classes or tokens),
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
