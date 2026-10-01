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
      section, the 2px rule on the first invalid field (the one to fix
      now; a later one's is ink), and `--focus`; the
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
  (`applyRouteTheme` in `lib/prefs.ts`), and the menu sheet's choice
  shows the preference in force there (`themePref`: System on a post, Dark
  elsewhere, until one is stored). The server renders the literal
  `data-theme="void"` and never `data-motion`, so without JavaScript there
  is no spatial motion; never read a cookie for this, it would make every
  route request-bound. The header's `ThemeSwitch` (one button, Void ↔
  Flight Manual) names the theme it switches to from `html[data-theme]`
  in CSS, so under Auto it follows the screen; the menu sheet (below
  960px, where the switch is hidden) carries `ThemeChoice` (Void · Manual
  · Auto, a `Segmented`), so each control shows once per breakpoint and
  the footer repeats neither; it reads `lib/prefs.ts` through
  `useSyncExternalStore` (server snapshot `undefined`). Spatial motion runs
  only under `html[data-motion="full"]` and
  `prefers-reduced-motion: no-preference`. Fonts come from `lib/fonts.ts`
  (their variables on `<html>`), each with one job: Jost for display
  (page and item titles and the hero's name at 350), headings, UI text
  and the controls' one caps voice (the nav, buttons, arrow links,
  segmented boxes and Pause motion: 500, 13px, 0.10em); Newsreader for reading; DM Mono
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
- **The CV** (G3). `/resume` is the record in two views under one head
  (`components/cv/experience-views.tsx`): Timeline, the flight (below),
  and List, the CV, switched by a `Segmented` "Timeline · List" where the
  head's tools sit. The default is decided in CSS before the first paint
  from the boot script's attributes (`experience-views.module.css`): the
  flight under `html[data-motion="full"]` and no reduce-motion setting,
  else the list; the list too when the address names a
  part of it (`/resume#experience`, a Full entry opened in a new tab, and
  `/resume#cv`, the CV link's address: `cvLink`, home's CV and the
  header bar's). Such an address opens the list whatever view the visit
  picked, on arrival (`pin`) and from a link on the page itself, which
  changes only the hash (`follow`). Until the page has run on the client
  nothing is checked and the
  default's box reads as chosen; then a module-level store pins the view
  in force, and a click switches it for the visit (no storage; a client
  navigation back keeps it; a tap before hydration is kept, `pin` reads
  the checked radio). Without JavaScript (no `data-motion`), on paper and
  for a crawler (one that runs scripts too: `pin` gives a bot's user
  agent the list) the list shows: the CV is always in the HTML,
  and the flight is never shown without JavaScript, so its chapters never
  repeat the CV. The flight's scene is built only while it is the view
  (`Journey active`), and fetches nothing without a WebGL2 context
  (`flight-scene.ts` makes the context first). Its maps decode off the
  main thread into ImageBitmaps (`requestMap`, an `<img>` only where
  createImageBitmap's options cannot be trusted) and upload one a frame;
  its first programs compile and warm one part of the scene a task
  (`compileFirst`), with nothing drawn until they are in, so no task
  builds it all. A card that leaves is `inert` at once while it fades. "Skip to the list" (shown on focus, after the
  switch), "The full record" after the stage and a card's Full entry
  (`onEntry`, the chapter's row) show the list and move focus there.
  `/resume/trajectory`, the flight's old page, answers 308 to `/resume`
  (next.config.mjs). The head carries Download CV (PDF) as its one
  action, and none without a PDF (the header's Contact is in the same
  viewport, and the Future card keeps a quiet one): no Contact, Open
  PDF, Print or Share (the browser's Print prints
  the CV); premium D3 retired the 2D orbit map, "Orbit 0n" codes and
  "Show on timeline".
  `lib/cv.ts` words the rows' dates as the résumé gives them and derives
  no length of time from them. A role's long parenthetical ("Field
  Software Engineer I (promoted from …)") is split by `splitTitle`
  (lib/trajectory.ts): the title, then the words as a quiet note under
  the organisation (`CvItem note`). A row's mono column is the dates and
  the place only: no "● Current" ("– present" says it, and Open To is the
  list's one now-mark), no "Talk" code (the section says it) and no
  employment the title already says (`cvEntry`: "Internship" beside "…
  Intern", by the word less "-ship"). A row's facts (the skills, the
  links) sit flush in the body column with no "Skills" or "Links" key:
  the mono names and the links' own words say what they are. A section's
  first row draws no rule: the section head's hairline is the division
  (`resume.module.css`). Project rows carry no status, stack or type:
  the dates, else "Ongoing" for an active project, then the role (when
  set), the lines and the links (every project is listed, so no "All
  projects"). A link to the site itself is never an external link
  (`cvProjects` with `siteUrlOf`/`sitePostSlug` in lib/cv.ts): one to a
  published post opens it in place (`/blog/<slug>`, no ↗ or new tab; its
  address still prints), and the site's own address is left out.
  Writing & talks is the latest three entries as plain rows (date ·
  linked title), with All writing only when /blog has more, then the
  talks. Every credential is the same plain row (`cvCredentials`): the
  span ("Sep 2023 – Sep 2026"), or the issue date without an expiry,
  then the name, linked to its verification page when the record has
  one, and the issuer unless the name already says it (case-insensitive:
  "AWS Certified …" prints none, MTA keeps "· Microsoft"); the current
  ones, then Prior certifications, on screen and on paper, with no
  status ("Expired", "No expiry"). The head has no date: the résumé's
  upload date is the paper's Rev alone (on screen it read as the page's
  own date). The print is the only paper artefact: two sheets on the
  named page `cv` (`styles/print.css`), each opening with its control
  line, "Curriculum vitae · Rev 2026-09-30 · Sheet 1 of 2" (no document
  number; `Rev` is plain text, paper only), sheet 2 breaking before its
  control line; the masthead keeps each address and opening whole (`Unbroken`),
  and the site's address stays on it. `[data-print="only"]` forces
  `display: block !important` from a
  layer, which no unlayered rule overrides, so a print-only part that
  needs another display sits inside a print-only container instead.
- **The flight** (`/resume`'s Timeline view, the default where motion
  runs). It has no head of its own: the page's head and the switch sit
  above the stage, which starts in the first viewport and pins under the
  header, where its rail and Play show. `components/trajectory/journey.tsx`
  is the record: each card is the title, one DM Mono readout under it (the
  chapter's dates as written; in flight the date, ticking, and the phase,
  "May 2024 · Transfer"), "● Current" on the current chapter in flight
  (a still card's "– present" says it, so there CSS hides it), the
  organisation, a note and a line, and Full entry; no big date, kind
  label or readout on the plan's card, which states Open to with a quiet
  Contact, the flight's one ask (after the stage only "The full record",
  to the list). No card cuts its words to fit: a phone's card has no
  line (Full entry shows the row) and a short wide window's runs to its
  end. A still card's dates are parts kept whole (`.open-to`, the
  readout's place; in flight the readout ticks there, one line), so on a
  phone "Expected 2028" takes its own line. On a phone Full entry shares
  the readout's row;
  the plan's card has no readout, so its Contact stays under the
  openings. The scene (`flight-gl.ts`) names each world by its
  organisation alone (DM Mono 13px caps), only in the wide finale's map
  and the still (`mapNamesAll`), coming in as the map settles: at a hold
  the card's organisation and the lit rail stop name the world, so the
  scene is unlabelled while held, and a phone's or a narrow window's map
  names none. Flight Manual prints no city lights. A still flight (reduced motion, Pause
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
  accessible names apart, "Listing 3, install.sh", and prints nowhere;
  one width per body, all
  wide once any line passes `LISTING_MEASURE`, the 64 columns of 13px
  mono the measure fits) and footnotes (in reading order, written onto a
  copy of the body's markDefs), and sorts the images into photographs
  and drawings (`figures`: a kind, no number; a post's cover is the lead
  plate). No plate or figure is numbered, on the page or in the feed: no
  text cites one, and each caption stands on its own (bring back "Fig. n"
  only where a post cites it). The post page, the project essay and the RSS feed
  (`lib/feed.ts`) all read it, so they agree; render `index.body`, not
  `post.body`. An entry's rail is its contents only: the date, the read
  time and any revision are the head's, and no record box repeats them or
  counts its words. The text has one numbering per thing: no margin
  number beside an h2 and no number in the contents (the headings have
  names), no line count or number on a listing (its bar has one label,
  the file name, else the language, then Copy at the right, in the
  listing's mono; the accessible name and the feed's caption follow the
  same rule), and no LOG number: the crumb is "Writing" alone and the
  print masthead's kicker "Writing". The head is the date, the read time
  and Updated, the title and the standfirst: no tags (the index's rows
  carry them). The contents (the rail, the phone's box) show from two
  sections; with one, the rail's column is space. A listing is one treatment (the surface fill; hairlines
  above and below on paper); a callout is the quotation's quiet note (the
  ink rule) led by its tone and title in bold ("Caution: Back up first",
  `calloutHeading`), with no colour, frame or band; inline code has no
  box. Prose h2 are `--step-2` (32px at most), the leading 1.52
  (`--lh-long`), figures proportional. A revision is dated as the head
  dates ("30 Jun 2026 · Correction", on the page and in the feed; no
  `Rev` or triangle). The entry closes once, in its own column: End of
  entry, then "Follow: RSS · LinkedIn" (`FollowLinks`, also /blog's
  head) alone (no question, Copy link or All writing: the header's
  Contact and Writing, and the crumb, are in reach); then the pager
  ("Previous", "Next" and the title: no heading, LOG number, date or read
  time), the project it belongs to (the shared `MissionRow`) and related
  entries, without tags (they share this entry's). There is no Author block: the
  footer carries the name. The renderers are
  `components/blogs/portable-text-components.tsx` and
  `components/prose/`; a new `contentBody` type lands with its web and
  feed renderer in the same change. `components/blogs/post-reader.tsx`
  marks the current section and resolves in-page links (`#fn-1`, the
  contents) inside the visible entry, because a hidden, still-mounted
  entry can hold the same ids. The header keeps its one `--rule-1`
  hairline here as on every page (the firmer rule on reading pages is
  retired). Every writing route names the feed through `feedAlternates` (lib/feed.ts:
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
  slug, and is the pager's words (`Mission.label`, else the title); the
  order (`missionOrder`) is the featured slots, then the mission number,
  then the list query's, and `missionTiers` splits it into the flagship,
  the next ones with room of their own (two tiles on `/portfolio`, two
  rows on home) and the rest, least prominent (quiet rows under the
  tiles, with no "Also" label); the files' previous / next go in the same
  order (`adjacentMissions` on `missionOrder`), labelled "Previous" and
  "Next" (`pagerCopy`, shared with an entry's pager; no "All projects":
  the crumb leads back).
  `/portfolio` is the head, then the tiers with their section names for
  screen readers only (no visible "Featured project" or "More projects"
  row, no "Experience & CV" link and no related pages); the stage's copy
  is top-aligned with its plate (4:5; home's 5:4, `MissionStage ratio`,
  as tall as its shorter copy), its title is its one link to the page
  (with the rows' trailing arrow; no "View the project" button), and a
  card (the stage, a tile) lists the first four stack items
  (`CARD_STACK`); every stack item is kept whole (`MissionStack`).
  `MissionLine` is ● Status · dates: no type (the title and summary say
  what kind of project it is; the share card keeps it). No page prints
  the mission number (MSN-02): it orders the projects, names them in the
  Studio's lists and identifies them in the structured data; a project's
  crumb is "Projects" alone, as a post's is "Writing". Numbers appear only on a project
  page: its head's stats (`headStats`) unless it has a results table,
  which carries them with their notes; the index has no counts, register
  or card stats. A Sanity cover (`Mission.cover`, with its alt text and
  its caption, today "Illustration" on the owner's generated stand-ins:
  premium D4-B) is a 3:2 thumbnail on a `/portfolio` tile (beside the
  title, under the line, which keeps the arrow; the summary and stack
  under both) or in a row on home or `/portfolio` (beside its text): a
  third of the card from 600px, two fifths on phones, beside the title
  under the line (tiles, like rows, are one column below 960px), the
  stage's plate when the flagship
  has one, and the plate beside a project's head in either layout; the
  stage takes the model's poster without one (with no caption: the
  model's title is not one the owner wrote), and a post's project row
  stays text only. On a card and a head the
  cover's caption is the plate's credit line (`Plate credit`,
  `.caption__src`: DM Mono 13px, ink-3, as the hero's credit); the stage
  keeps it as the owner's caption. A card's cover never outweighs the
  stage's photograph (`home.spec.ts`, `missions.spec.ts`). `missionLayout` picks the page's layout: the full file
  where there is evidence (a brief that adds to the card, `briefAdds`;
  results, lessons or next steps, callouts, the model's poster, an essay
  in sections; a cover is no evidence of its own), otherwise the short
  note (title, summary, the head's quiet links, the highlights that add
  to it via `noteLines`, one of them a plain paragraph with no dash or
  rules, the facts and links). Either shows the essay
  (Case study) only when it says more than the summary, highlights and
  brief (`essayShown`: a heading, a non-text block or eight content words
  they lack, counted by stem in `newWords`). On the stage "Read the
  write-up" (a quiet link) goes to the original entry, else to that
  essay; in a project's head it is a quiet link to the original entry
  only (nothing points down to the page's own essay), followed by the
  repositories (`MissionLink.code`), underlined with ↗: the head's quiet
  links, in either layout. The head's facts (`factRows`): the status
  note, the Stack row (left out when the page's words already name every
  item, `stackSaid`: the Kubernetes note), Role, the named parameters the
  stack and the card's text do not name (`splitParameters`: "Feed: RSS"
  beside "…RSS feed"), and the other links while there are two links or
  fewer in all (else they are the References section). The brief is
  "Overview" (its rows name problem, approach and outcome); lessons and
  next steps both are "Retrospective", each under its subhead, and one
  alone is titled by its name with no subhead. A link to the site itself (a post, or its
  own address) is never an external link. The results table is named by
  its "Results" heading (`aria-labelledby`, no caption) and opens on its
  first row: its column heads are for screen readers (`sr-only` text in
  zero-height cells, so `th scope` stays); on phones each note moves
  under its row. A mission's Flight Log entries are
  derived (`missionEntries`): the posts that reference it, and the posts
  its links, its essay and its model's callouts point at; the original
  entry is the first linked one, else the oldest referencing one, and
  `related` is the rest (the head links the original). Links to the
  site's own posts are entries, never external links; Related writing
  lists them flat, without tags, and is absent when only the original
  was tied to the project. The 3D viewer's server part
  (`components/viewer/viewer-figure.tsx`) is the model's poster as a
  plate with no caption (the model's title is not the owner's caption,
  as on the stage), and its callouts are plain hairline rows under "Parts of the
  build" (the part and what it does: no balloon, number or link until the
  drawing lands; the write-up is linked once, in the head); PR 15 mounts
  the drawing in its `data-viewer` slot, and with it the model's
  description (`model.alt`), which describes the drawing, not the
  photograph. No photograph carries a plate number. Every
  photograph follows one plate rule (`.photo` in styles/components.css):
  a hard edge in a hairline, then the caption, with an even card mat
  inside the hairline in Flight Manual; nothing on the photograph (no
  number, feather, glow, crop marks or sepia) and no hover of its own.
  The page ends in space before the pager (the close, "Questions about
  this project?" and Send a message, is retired with `Ask`: the header's
  Contact is in every viewport); the pager's section is the last, so its
  own padding ends the page. The file reuses
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
  cover crop, so the two stay aligned at every size. The photograph's
  preload is a client component's `preload()` (`hero-preload.tsx`): a
  server component's, or a `<link rel="preload">` it renders, rides the
  RSC payload as a hint that a prefetch of home applies to whatever page
  is open. The starfield
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
  projects under it, fill the view. Without JavaScript it stays. Over
  it: the name, the profile's headline and the availability line (only
  when set), each split into parts kept whole (`OpenToItems`) that stack
  on phones, then one action, centred in space (CV, the hairline `.btn`,
  no fill or blur; the header's Projects is the way to the work, so no
  link points down the page). The foot: the credit with the frame's ID
  ("Photo: NASA / Expedition 72 · ISS072-E-30246", `id` in
  `lib/hero-sunrise.json`; on phones its parts one a line, without the
  separators) and Pause motion (under the OS reduce-motion setting
  nothing: no note reads the setting back). Then the sections, each only
  with content (`lib/home.ts`, unnumbered), each tag row linking its
  section's page only while that page holds more than home shows: the
  strongest project on its stage (featured slot 1, led by its summary,
  no stats, mission number or write-up link: its page links the
  write-up; its title is its one link), the next two as rows
  (`homeProjects`; the others are `/portfolio`'s alone, and All projects
  shows only while there are any); the latest three entries, without
  tags (All writing only while `/blog` lists more); and the close, in
  open space (no rule over it), headed by the owner's one-line statement
  (`taglineOf`: the tagline, else the introduction's first sentence;
  "Contact" for screen readers without one) with a quiet link to About's
  current focus (the nav's Experience leads to the flight), then one way
  to `/contact`: the profile's `availability.cta` → `/contact#hiring` as
  the one primary while there is an Open To line, else Send a message as
  a quiet link. On phones a section's link stays on its heading's line.
  The page stays under about 4,500 px at 1440 and 7,000 px at 390
  (`home.spec.ts`). In Flight Manual the hero draws the limb over open
  paper (no parallels under it) and has no foot row; on home the footer
  leaves Pause motion to the hero. Pause motion is an unboxed control (the
  icon and "Pause motion" in ink-2, in the controls' voice, a 44px
  target), in the hero and the footer alike, and shows nothing under the
  OS reduce-motion setting, as without JavaScript.
- **About** (`/about`, themed Crew File; plan §6.2 row 14, contract §9).
  The head has no figure (the header's patch is the mark; the site shows
  no portrait), no actions (the header carries Experience and Contact)
  and no dek (the record states the headline's facts); then the record
  (`CrewRecord`: one hairline title block, Studying, Previously, Focus,
  Links (no Name: the header's wordmark and the footer carry it): LinkedIn and GitHub only, beside the facts
  they verify, the credentials' links being the CV's; no Open To, edit
  date or accent cell). A role
  is set as on /resume: the title, then the organization and the dates as
  data (DM Mono 13px, `.titleblock__data`) in whole parts (`OpenToItems`,
  so no line ends on a dot), then the title's parenthetical
  (`splitTitle`) at `--step-0` in ink-2. Then `DocSection`s (`components/ui/doc-section.tsx`, the
  one section head: also the mission files, `/contact` and the CV on
  `/resume`): the biography and the Now list grouped by
  `currentCuriosities[].kind` (`nowGroups`; a kind's label only when there
  are two or more, and no Q1… numbers; a rule between questions only,
  none over the first or under the last), each only when it has content;
  the last ends the page in space, with no close (the header's Contact is
  on screen).
  The writing, the talks and the other sections are one click away in
  the nav, not repeated here. Its
  section ids are prefixed (`crew-…`, and the home page's `home-…`)
  because a visited page, still mounted, can own the same fragment. No page carries the old design: there is no
  legacy stylesheet, token, class or icon library left, and
  `tests/e2e/crew.spec.ts` checks every static page for one.
- **Entry numbers** are derived, never stored, and printed nowhere:
  `logNumbers` in `lib/designations.ts` numbers published posts by
  `publishedAt`, oldest first, ties by document id. Number the whole
  list, then filter (`logEntries` in `lib/log-index.ts`), so a tag page
  keeps each entry's order. The LOG number (and the project's MSN) is
  retired from every page: no visitor cites it, and it had to be decoded.
  `formatMissionDesignation` stays for the Studio's lists and the
  structured data's identifier.
- **Writing's lists** (G8, `/blog`, a tag page). The index is the head
  (the writing description and the follow line; no search, boxed buttons
  or tag chips) running straight into the rows, one list with even
  spacing (no year heads: each row's date carries its year), which ends
  on its closing rule. A row has one date: a revision's "Updated" is the
  entry head's. `/blog/archive`, which repeated the list at a second
  address, answers 308 to `/blog` (next.config.mjs). A tag shows only
  when it links: once it gathers two entries
  (`linkedTags`/`TAG_LINK_MIN` in lib/tags.ts, `LogEntry.tagLinks`), on a
  row and in the sitemap, and never with a "#"; a one-entry tag's page
  still answers, but asks not to be indexed (`robots` follows
  `TAG_LINK_MIN`, as the sitemap does), and a tag with no entries is a
  404 with the 404's head (`notFoundMetadata`, lib/site-metadata.ts, as a
  missing post or project has). A tag page shares Writing's card. A tag page's h1 is the tag in words (`tagLabel`: "GPU
  computing"), with no dek or actions (the header's Writing leads back),
  and its rows leave that tag out.
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
  sheet and the 404's primary). Below 960px the header nav is a native
  `popover` sheet, so it opens without JavaScript (Baseline since 2024:
  there is no fallback link); `MenuButton` adds focus, `inert` and the
  Tab loop (the brand, the button, then the sheet, as a browser tabs a
  popover after its invoker, one stop for the theme choice; every Tab is
  steered, so focus never leaves the header). The sheet holds the five sections and the theme choice only
  (the feed is on `/blog` and each entry's close); the bar beside it
  carries Contact and CV (`cvLink`, `/resume#cv`, the list itself, as
  home's CV), which from 960px the nav's Contact and Experience replace
  and which step aside while the sheet is open (its list carries both).
  The footer is one strip under its hairline: "© 2026 Adithya Rajendran
  · GitHub · LinkedIn", the colophon ("Built with Next.js, Sanity and
  three.js · Source", Source on a line of its own on phones, as GitHub ·
  LinkedIn are) and Pause motion (not on home), all in the label
  voice but the colophon's sentence, which keeps its own case (capitals
  are for labels of four words or fewer); it repeats nothing the header carries (no
  patch, sections, CV, RSS, theme or Back to top). The body is a column
  whose `main` grows, so on a short page (the 404) the space falls above
  the footer's hairline.
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
  again; the 404's lead "It may have moved or no longer exists.", since
  the h1 says the rest), a carrier trace shown already drawn (the page's
  one drawing: nothing on it animates), then "Found a broken link? Let me
  know" and space. The 404 is one prerendered page for every address, so
  what follows the missed address is read on the client
  (`useRequestedPath`, server snapshot `null`): the primary
  (`lostSection` in lib/navigation.ts: "All writing" under `/blog/`, "All
  projects" under `/portfolio/`, else Home), the head's one action, and
  Let me know, which carries the address to the form (`reportHref`:
  `/contact?broken=…#hello`). Without JavaScript it is Home and
  `/contact#hello`. No Requested line (the address bar shows it), no
  link rows (the nav is on screen) and no engraved horizon.
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
  request (`perRequest`; none today: the post and project cards have
  static params, so they prerender and are warmed) is never warmed. A new route goes into the table in
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
  without a title takes its topic's name. A prompt is the message
  field's placeholder once its topic is chosen; before that, and on the
  email field, there is none (the labels say what goes in); the page gives
  no "include" instructions. The page is the head (the introduction and
  `Availability`, set apart by space alone), then, after space, the form
  (its Message section named for screen readers only: no visible head or
  hairline), whole in the first viewport at 1440×900 (the limit is the
  field's hint, for screen readers; the counter shows only when 100
  characters or fewer are left), which ends the page: the profiles are
  the footer's and About's (no Profiles list). The Topic radios,
  one per line, are the routes (premium D3 folded the Topics column into
  them): each is named by its title and described by the owner's line
  where there is one (Research: `contactInvitation`, a `Segmented`
  option's `description`), and the routes carry no links. They lead the
  form, as in the source, so it reads in the order Tab takes: from 960px
  in columns 1–5, left of the fields and Send (columns 7–12, under the
  head's intro, so Send stays in the first viewport), on phones above
  them. Send's `mousedown` is not followed, so pressing it keeps the
  focus in place: leaving a malformed email by the press would show its
  error and move Send from under the pointer before the click landed. The form reads
  the fragment (`#hiring`) to pick its topic on arrival and writes it
  back when a topic is picked.
  The only words about the owner's situation on a button are the
  profile's (`availability.cta`: the home close); code keeps a neutral verb ("Send a message"). Contact is one click from
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
  not be sent." (or the reason: too many, not verified), with Copy
  message and Message me on LinkedIn (the text stays in its fields, and
  Send sends again: no Try again). Without JavaScript the `<noscript>`
  block is "This form requires JavaScript." and the LinkedIn button, on
  the section's one rule. A
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
  404's primary following the missed address, the report its only other
  link and nothing animating; `security.txt` pointing to the form,
  unexpired), `nojs` (complete pages without JavaScript: header, nav
  through the popover menu, footer, Void with no motion and no theme
  controls, no hidden streamed segments, nothing rendered twice; the 404's
  Home and plain report), `a11y`
  (axe, WCAG 2.2 AA + best practice, at 390 and 1440 px, in Void and
  Flight Manual, every page in full, and both kinds of 404), `layout` (no
  sideways scroll at 320–1920 px, the header's parts fit without
  overlapping, and no visible text under 12 px, generated text included,
  on home, every post and project, `/resume` and `/contact` (with the
  message counter near its limit) at 1440 and 390; on home, every post
  and project, `/resume`, `/about` and `/contact`, six font sizes at
  most, every caps line a label, a control, the hero's name or
  Michroma's two places, and 13px text only a label, a control or data),
  `accent`
  (two orange marks at most in the first viewport of home, `/portfolio`,
  Homelab, a post, `/resume` (the flight), `/contact` and `/about`, at 1440
  and 390 in both themes, identity marks and focus aside, and on
  `/contact` refused with two invalid fields, only the first one's rule
  orange; the primary an ink fill, the nav's bar and the bar's CV
  ink), `theme` (no flash of the wrong theme, persistence across
  reloads, pages and tabs, Auto following the OS, a post following the
  OS until a theme is chosen while every other page stays Void, on a
  full load and after a client navigation, Pause motion, the stored
  theme on an unknown post or project URL, the three-way choice in the
  menu sheet, and nothing in Pause motion's place under the OS setting),
  `chrome` (the menu sheet's focus, `inert` and closing; Contact and CV
  in the bar on a phone, hidden while the sheet is open, and neither
  from 960px; the current nav section;
  the nav naming every section plainly, with no fallback Menu link; one
  header hairline on every page; the footer one strip naming the owner
  once, with GitHub, LinkedIn and Source its only links and Pause motion
  its only control, fitting its width at 390 and 1440; Pause motion in
  the controls' voice and the strip a label, the colophon's sentence in
  its own case),
  `contact` (the routes are the form's Topic radios, each named by its
  title and described by the owner's line, with no Topics column or
  links beside the form, and a fragment picks one; a route's prompt
  only as the message field's placeholder, and none before a topic or on
  the email; the Message head for screen readers only and the form the
  page's last section;
  the whole form in the first viewport at 1440×900 and reading in the
  order Tab takes at 390, 960, 1440 and 1920, Hiring only beside an
  Open To line, the email checked on leaving it and every field from the
  first submit, a press on Send from a malformed email checking them at
  once, each error under its field (the words in ink with their cross,
  a 2px rule on the field, orange on the first and ink after it), the
  counter only near the
  limit; a refused send under Send with the text in its fields, Copy
  message and LinkedIn and no Try again, its stale alert clearing after
  leaving and returning; a send the network drops staying on the page,
  Send sending again and the draft surviving a reload; "Message received."
  focused, promising nothing, and a fresh form; the 404's
  report arriving with its address, Consulting hidden while off, no email
  address or phone number, the no-JavaScript LinkedIn alternative; sends
  only on the fixture build, which has no Resend credentials, a sent one
  being its refusal answered as sent), `log` (the first
  entry in the first viewport at 1280×800 and 390×844 in both themes,
  entries newest first in the same order on the tag pages, no LOG
  numbers and no chart on the index, one date on a row (no "Updated"),
  a tag (on a row, never with "#") only once it gathers two entries, one
  list with no year heads, the head's follow line with no search, boxes,
  chips or archive link, `/blog/archive` answering 308 to `/blog`, a
  row's tag opening its page, whose h1 is the tag in words with no dek
  and whose rows leave it out, 404 for an unknown or malformed tag, and
  the prefetch budget on `/blog`), `post`
  (every entry's first paragraph in the first viewport at 1280×800 and
  390×844 in both themes, a 60–75 character measure, code comments at
  4.5:1 or more, the rail listing the sections (from two) with no record
  box or word count or numbers, no LOG, plate or figure number, the
  crumb "Writing" alone and no tags in the head; no h2 margin number or
  listing line count or number, h2 at 32px or less and a 1.52 leading;
  the close (End of entry and the follow line alone, no question, Copy
  link, All writing, Author block or pager heading, the pager's
  "Previous" and "Next" by name), Copy on a listing, the
  phone's contents box, the header's one hairline, print, BlogPosting and
  BreadcrumbList; on the
  fixture build also the listings at one width with no line cut, one
  label on the bar and the highlighted line, footnotes and
  margin notes, the caution callout as a quiet note and revisions dated
  as the head dates, their RSS output, and
  in-page links landing in the visible entry after a client-side
  navigation), `resume` (Timeline · List in the first viewport, the
  head leaving Contact to the header, Timeline chosen and the stage in view where motion runs, no
  orbit codes, Open PDF, Print or Share and no link to the flight's old
  page; the views switching in place, the scene dropped with its view,
  the choice kept across a client navigation; Skip to the list, The full
  record and a card's Full entry landing on the list and its row, with
  focus; the list and the flight's still under reduced motion; an
  address naming a section opening the list; CV (home's, then the
  phone bar's on the page itself) opening the list whatever view the
  visit picked; no project link opening the
  site's own address in a new tab, and every credential one plain row
  with no status and no heading of its own; the list saying each thing
  once: no head date, status, kind code, type line, Skills or Links key,
  employment the title says or issuer the name says, and no second rule
  under a section head; a still card with no "● Current"; axe on the
  list in both themes; without JavaScript the CV with no switch or
  flight), `print`
  (the CV on two sheets on A4 and on Letter, without the chrome, the
  controls or the flight, whichever view was on screen; Prior
  certifications and never "Expired"; the control line with no document
  number or triangle; each masthead address and opening on one line),
  `trajectory` (on `/resume`: pinned, the rail and Play in view, the
  record holding still while scrubbed, one readout ticking under the
  title, no world named while the route is flown and the worlds named
  without dates in the wide finale, none on a phone, a still flight
  opening on the latest chapter, no card's words cut at a short laptop
  window or on a phone, a still card's dates clear of its Full entry at
  360 and 390, a phone's cards in
  reading order, and the scene drawing, surviving a lost context and a
  return), `missions` (every old `/portfolio` fragment sent on to its
  page, the index links every project with no counts, register, mission
  numbers or related pages, titles in sentence case and four stack items
  at most on a card, the flagship's title, its one link, in the first
  viewport at 1440×900 with no filled button and no "Also" label, each
  project page has its crumb ("Projects" alone, no number), its title as
  the heading and the pager ("Previous", "Next", in the index's order)
  and no close, title block, revision, "Table 1", jump to its own
  write-up or stand-in text, a stack item never split, a thin project is
  a short note (the Kubernetes note without a Stack row, one highlight a
  paragraph),
  a cover leads its card, credited, opens the project and stays a
  thumbnail narrower than the stage's plate and, with the other, smaller,
  at 390, 768, 960, 1440 and 1920 (where the build has covers: the
  fixtures have none),
  Read the write-up lands on the original entry; on the fixture build a
  filled mission shows every module (Overview, Results opening on their
  first row with the column heads for screen readers, Retrospective with
  its two subheads), its repository beside Read the write-up in the
  head with no Code row, no Related writing that would only repeat the
  original, its callouts as plain rows, and a planned one none of them), `home` (the
  hero's name, availability and its one action, CV (to `/resume#cv`), in the first
  viewport at 1280×800 and 390×844 with and without
  JavaScript, each part of the headline and the Open To line on one line;
  the name at 350, tracked 0.11–0.12em, on one line at 1440 and 1,400px
  wide at most at 1920; the header's wordmark hidden only while the hero's name is in view: back
  at 400px down and with the projects in view; the starfield
  `running` only on screen, in a visible tab, in Void and with motion
  allowed, and nothing in Pause motion's place under the OS setting; the
  stars in the hero only, and not on paper; the credit with its frame ID,
  and the drawn limb in Flight Manual; the sections in order, unnumbered
  and without themed names, each linking its page only while that page
  holds more, no Also line, and the latest writing without tags; the close headed by the tagline, with no
  link to `/resume` (the nav's Experience is the flight's), its button
  only in the profile's words and
  only beside an Open To line, one primary at most and one way to
  `/contact`; the flagship without stats, mission number or type, its
  title in sentence case and its one link (with the arrow, no button)
  over four stack items at most; a row's cover a
  credited thumbnail, narrower than the stage's plate and, with the
  other, smaller (where the build has covers); the page's height
  at 1440 and 390; no gap wording and no old artwork), `crew` (About's
  plain title with no patch, portrait, head actions or dek, its record
  opening on Studying, without Name, Open To, an edit date or an accent
  cell and LinkedIn and GitHub
  its only links, the sections by their plain names, no question
  numbers, no writing index, related pages or close, no gap wording; and no page keeping the old design's
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
