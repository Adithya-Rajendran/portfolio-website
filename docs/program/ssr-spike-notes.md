# U0d spike notes: the plain pages rendered from Solid 2 components at build time

**Status:** a throwaway prototype in `spikes/ssr/` (with `tools/docker/ssr-spike.mjs` and its fixture
`tools/docker/ssr-spike/`), built and run on the CI hosts only. Only this note is meant to be kept (like U0b's).
Decisions it bears on: D2, D3, D17 (`docs/program/decisions.md`). Nothing was measured on the laptop's HD 630
(owner's instruction of 2026-11-25); nothing here needs it.

**Verdict: go with conditions.** Solid 2.0.3 renders all three kinds of page at build time under Vite 8.3.8 with the
plugin's plain mode, into static files that are, with JavaScript off, the same pages as `tools/site.py` writes: the
same title, head tags, JSON-LD, canonical, headings, links and words, and pixel-identical at 1280x720 and 390x844.
The conditions are in section 7. The short form: render the plain pages **without hydration** (zero JavaScript added
to them), port the Markdown renderer and `site_extras.py` behind a differential test against `site.py` before
retiring it, and do not hydrate a page the station's reader takes over.

Versions (exact pins, `spikes/ssr/package.json`, `pnpm@12.23.0`, Node 24.22.3 on the CI host): `solid-js` and
`@solidjs/web` 2.0.3, `@solidjs/vite-plugin` 3.0.1, `vite` 8.3.8, `@ui-sdk/solid` and `@ui-sdk/core`
0.1.0-beta.16 (U0b's; beta.17 is out), `typescript` 7.0.2. The install passed with no release-age prompt; pnpm listed
`skills` packages awaiting approval, as U0b saw.

## What the prototype is

| File | What it does |
|---|---|
| `export.py` | Loads `tools/site.py` by path (read-only) and dumps what the components need to `.gen/content.json`: the shell, the shell's ids, the profile, and each post with its body **already rendered by site.py's Markdown renderer** (not ported; see 5 and 7). |
| `src/site.ts`, `src/head.tsx`, `src/pages.tsx` | Ports of the helpers (`human_date`, `unique_id`, the link policy, `json_ld`), the head tags of `post_page` and `page_head`, and `PostArticle`, `AboutArticle`, `ContactArticle` as Solid components (about 310 lines). The articles take plain data, so the same component can be rendered by the room's reader in the browser (`src/entry-csr.tsx` does that). |
| `src/entry-server.tsx` | `renderHead`, `renderArticle` (with or without `<NoHydration>`), `renderKitPage` (a static page with one hydrated UI SDK island), `generateHydrationScript`. |
| `prerender.mjs` | Splices the output into the shell exactly as `site.py`'s `page()` does (the `<title>` text, `<!--site:head-->`, `<!--site:page-->`), in two flavours: **static** (no hydration keys, no script) and **full** (hydration keys, the page's data as JSON, Solid's hydration script and the client entry). |
| `src/entry-client.tsx`, `src/entry-kit.tsx` | `hydrate()` of the whole article, and of the UI SDK island (`renderId: 'kit'`). |
| `src/profile-json.ts` | `profile.json` from the profile, a port of `profile_json()` and `versioned()`. |
| `compare.py` | Compares two page trees address by address (below). |
| `build.sh` | Install, export, both Vite builds, prerender, compare, time, and copy the pages to `tools/docker/ssr-spike/`. |
| `tools/docker/ssr-spike.mjs` | The browser checks, run as `ci <ref> script ssr-spike.mjs [nojs,hydrate,kit]`: a small server in the container answers the Solid pages' addresses from the fixture and passes everything else to the checkout's own site, so the pages run with the real `main.js`, CSS and packed rooms. |

## 1. Does Solid 2.0 render to HTML at build time under Vite 8, without SolidStart, into static files?

**Yes.** The APIs and options that work:

- `renderToString(fn, options)` from `@solidjs/web` (its `node` export condition resolves to the server build).
  Synchronous; enough because the data is local. `renderToStream` and the plugin's start mode were not needed and
  not tried (start mode replaces our `index.html` with its own document, which D2 and the shell rule out).
- `@solidjs/vite-plugin` in **plain mode**, two builds from one config: `vite build` for the browser and
  `vite build --ssr src/entry-server.tsx` for the server bundle (140 kB, imported by a 50-line Node script).
  `@ui-sdk/solid` ships JSX source under its `solid` condition; the plugin bundles it into the server build
  without any `ssr.noExternal` setting. `optimizeDeps.exclude: ['@ui-sdk/core']` stays (U0b).
- `solid({ ssr: true })` makes the **browser** build hydratable and the server build emit hydration keys. With
  the default `solid()` (D2's setting) a `vite build --ssr` bundle still renders to HTML, with no hydration keys:
  `prerender-static.mjs` built that way writes files identical to the static flavour (`build.sh`: "plain mode
  with ssr: false (D2's setting): the same static pages").
- The output is plain files under the same paths as today (`blog/<slug>/index.html`, `about/index.html`, ...),
  so Cloudflare's static assets serve them as now; nothing runs at request time.

What breaks or surprises:

1. **`useHead` does not give site.py's head.** With a render that has no `</head>` (ours: the shell owns the
   document), `onHead` delivers the tags but the `<title>` is set by an inline `<script>` (no title without
   JavaScript), the canonical `<link>` is moved before the metas, and every tag gets a `data-dh` attribute.
   Rendering the whole document with Solid puts a real `<title>` in but keeps the reordering and `data-dh`.
   The prototype renders the head tags as ordinary JSX under `<NoHydration>` and splices the string in, as
   site.py does: identical (section 3).
2. **Solid's insertion markers.** Every dynamic insertion is wrapped in `<!--$-->` ... `<!--/-->` (and
   `<!--!$-->`), also under `<NoHydration>` and also with `ssr: false`: 14 to 40 per page here. They split a line
   such as `headline · location` into three text nodes, and Chromium then shapes the text differently: with
   JavaScript off, About and the longest post differed from site.py's by up to 62 levels in 89 to 225 pixels at
   1280x720 (job 20261125-182055-b5897d9f, the boxes are the header's first line). Stripping the three markers
   from pages that are never hydrated is safe and makes them pixel-identical (section 4). A hydrated page needs
   them, so **a hydrated page is not pixel-identical to site.py's**.
3. **`hydrate()` needs Solid's hydration script.** Without `generateHydrationScript()` (an inline `<script>`
   defining `window._$HY`, which also queues clicks made before hydration) every page threw "Cannot read properties
   of undefined (reading 's')" and nothing hydrated (job 20261125-182055-b5897d9f).
4. **The client entry must be `<script type="module" async>`.** Module scripts run in document order, so a plain
   module script in the head holds back `main.js` until it has loaded.
5. **No whitespace between elements.** Solid writes `</p><h2>` where site.py writes `</p>\n    <h2>`. Nothing
   renders differently (`innerText` and pixels equal), but `textContent` joins blocks without a space (Contact:
   378 against 385 characters), and site.py's test that `main` starts with `<main id="page">\n` needs the
   prerenderer to add the newlines (it does).

## 2. Do UI SDK components render on the server?

**All sixteen tried render with `renderToString`, hydrate, and work after hydration**: Button, Toggle, Dialog,
Listbox, Menu, Toolbar, Segmented Control, Drawer, Scroll Area, Progress, Toast (region), Tabs, Collapsible,
Tooltip, Popover, Navigation Menu (the ui-spec list plus five). Evidence: `build.sh` ("UI SDK parts on the server:
button ok, ... navmenu ok"; the HTML is in `.gen/kit-ssr.json`), and `ci prog/U0d-ssr-spike script ssr-spike.mjs
kit` on the second CI host: hydrated in 42 to 57 ms, all 67 server nodes adopted, and 12 interactions passed after
hydration (counter, Button `onClick`, Toggle, Dialog open and Escape, Listbox select, Menu open, Segmented Control,
Toolbar arrows, Drawer open, Toast shown, Tabs, Collapsible).

What to know:

| Part | On the server | After hydration | Workaround |
|---|---|---|---|
| Dialog, Drawer, Menu, Popover | only the trigger; the content is not in the HTML while closed | opens | fine for controls; never put readable content only in a popup |
| Collapsible | trigger only; the panel is absent while closed | opens | same |
| Tooltip | content rendered, `hidden` | works | none needed |
| **Toast region** | `<section>` in the flow | gets `popover="manual"` and leaves the flow: **everything after it moved up 20 px** (Tabs at y 669 to 649, ...); the layout-shift observer recorded nothing | render the region client-only, or style `[data-slot=toast-region]` out of the flow from the first paint; report to UI SDK |
| Segmented Control, Scroll Area | no indicator or overflow variables | sets `--segmented-control-indicator-*` and `--scroll-area-*` by measuring | a styled indicator appears only after hydration: give the checked item its own no-JavaScript style (`[data-checked]`) |
| Progress | `aria-labelledby` names a label id that is not rendered when there is no `ProgressLabel` | attribute removed | pass `aria-label` (as here) and ignore, or report |
| Tabs | no `aria-controls` | added | none needed |
| ids | `ui-sdk-00-...` from the render's own counter; under `<Hydration id="kit">` `ui-sdk-kit2b100-...` | stable | do not style by id (UI SDK says the same) |

The kit page's only errors were the station's own (no WebGL in that browser: "THREE.WebGLRenderer: A WebGL context
could not be created", and "e is not a function" thrown at `main.js:44` inside three.js), not Solid's.

## 3. Three real pages compared with site.py's

Rendered from `data/`: all four posts, About and Contact, at the addresses site.py uses. `compare.py` parses both
and compares the `<title>`, every head tag in order with its attributes, the JSON-LD (parsed, and as text), the
canonical, the headings (tag, id, text), the links (href, target, rel, text) and `main#page` as a sequence of
elements and text (whitespace collapsed, whitespace-only text between tags dropped); and checks the rest of the
document (the shell) byte for byte.

**Differences in the static flavour: none** in any of those, on all six pages ("compare static: same" in every
`build.sh` run; `.gen/compare-static.json`). The JSON-LD text is byte-identical too. Every difference left is in
the raw bytes:

| | site.py | Solid, static flavour | Solid, full (hydrated) flavour |
|---|---|---|---|
| whitespace between block elements | newlines and indents | none, except the `\n` inside `<main>` | none |
| insertion markers in `main` | 0 | 0 (stripped) | 14 (posts, Contact) to 38 (About) |
| `_hk` attributes in `main` | 0 | 0 | 13 to 45 |
| scripts | the shell's three and JSON-LD | the same | plus Solid's inline hydration script, the module entry, and `<script type="application/json" id="ssr-props">` |
| page size, bytes / gzip (Contact) | 5,859 / 2,296 | 5,797 / 2,298 | 18,809 / 7,489 |
| page size, bytes / gzip (largest post) | 33,509 / 12,787 | 33,439 / 12,785 | 64,178 / 15,577 |

In the browser, with JavaScript off (`ci ... script ssr-spike.mjs nojs`, job 20261125-183913-72184efe): every
Solid page passed the repository's own plain-page checks (`plaincheck.mjs`: scroll, uncovered, one h1, heading
levels, alt text, link names, contrast, overflow) at 1280x720 and 390x844, in both flavours; `main#page`'s
`innerText` equals site.py's on all 24 page-size-flavour pairs; and the full-page picture is identical (max 0) for
the static flavour everywhere. The full flavour differs on the desktop pictures of the largest post (89 px, max 46)
and About (225 px, max 62) because of the markers (1.2).

`profile.json` from the TypeScript port is **byte-identical** to site.py's, version hash included.

Not covered: the post bodies are site.py's own HTML (the Markdown renderer was not ported), so this proves the page
structure, head and data handling, not a Markdown port. The other page kinds (the lists, projects, Experience) were
not written; they are the same kind of work as About.

## 4. Hydration

`ci prog/U0d-ssr-spike script ssr-spike.mjs hydrate,kit` (job 20261125-183509-dfe67144): the full flavour, the
client entry held by the browser until a picture of `main#page` was taken, then let go.

Without WebGL (the page is a page, as for a visitor whose browser cannot run the station), all six pages:

- hydrated in 4.1 to 7.9 ms (posts) and 4.6 to 5.2 ms (About, Contact);
- layout shift after the release **0** on every page, and 0 for the whole visit;
- picture of `main#page` before and after hydration **identical** (max 0; 760 px wide, up to 4,000 px tall);
- every server node adopted (71, 126, 158, ... of the same count; a property set on each node before hydration was
  still there after), no image fetched again, DOM mutations 0 on the posts and 2 (Contact) or 8 (About) (not looked into; nothing
  visible changed);
- no console error or warning that site.py's page does not also show (the station's three WebGL messages).

With WebGL (the station runs): no new console errors, no layout shift (0 after the release; 0.0044 for the whole
visit, the same as without Solid), hydrated in 7.8 to 16.6 ms. But on the posts, which open in reading mode, **the
station's reader had already moved `article.post` out of `main#page`** into its frame (`public/js/reader.js`,
`article()` takes the page's own article) before the held hydration ran, so there was nothing left for it to adopt.
Hydrating a page the reader takes over is a race with the station; whichever wins, two owners touch the same nodes.

The UI SDK island: section 2 (no layout shift recorded, but the Toast region moved what follows it by 20 px).

## 5. Cost

**JavaScript per page** (`gzip -9`, bytes):

| | Added to a plain page |
|---|---|
| static flavour (recommended) | **0** |
| full hydration: Solid's hydratable runtime (`web` chunk) + the page entry | 35,669 + 3,188 = **38,857** |
| ... plus the page's data, which hydration needs again as JSON | 4,763 to 11,072 for the posts (the body twice), 5,069 for About and Contact |
| the same article client-rendered with `render()` (the room's reader case, `ssr: false`) | 16,294 in one chunk |
| UI SDK: all sixteen parts as one island (with the `web` chunk and the lazy sheet) | 110,777 + 35,669 + 1,023 |

So hydration support itself costs about 22.6 kB gzip over the client-render runtime, and `ssr: true` would put it in
the station's own bundle too. U0b measured Listbox and Dialog at 75 kB over Solid; sixteen parts are 111 kB.

**Build time** (the CI host, three runs of `build.sh`, milliseconds):

| Step | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| export (Python, data and Markdown) | 108 | 84 | 151 |
| `vite build` (browser) | 748 | 976 | 960 |
| `vite build --ssr` (server) | 684 | 701 | 662 |
| prerender of 6 pages, both flavours (Node; of which loading the bundle) | 199 (150) | 205 (156) | 410 (318) |
| **site.py, everything (44 files), warm** | 170 | 229 | 248 |
| site.py, cold (encodes the images) | 2,650 | 3,388 | 3,568 |

Run 3 overlapped other jobs on the host. Rendering itself is fast: 0.5 to 4 ms a page in Solid (6.9 ms in run 3),
against 0.06 to 18 ms in site.py (that includes its Markdown). The fixed cost is the toolchain: about 1.4 s of Vite
builds against site.py's 0.2 s for the whole site. A real build would do the server build once with the app build
(`vite build --app` or one `ssr` build of a pages entry), so expect about 1 s added to `pnpm build`.

**Feeds, sitemap, llms.txt, profile.json, JSON indexes**: plain TypeScript functions over the same data, written as
files by the prerender script; no Solid. `src/profile-json.ts` (46 lines) shows it: byte-identical output, including
`versioned()`'s hash (`json.dumps(sort_keys=True)` reproduced). The feed needs the Markdown port (it carries
the posts' HTML); the sitemap and llms.txt are string templates (`site_extras.py` is 234 lines). Images keep their
encoder (`cwebp`) called from Node or left in a small Python step; nothing about them needs Solid.

## 6. Carrying over the ~1,800 lines of Python tests

`tools/test_site.py` (639 lines, 24 tests: the Markdown and inline renderer), `tools/test_site_pages.py` (763, 23:
every page), `tools/test_site_extras.py` (370, 21: feed, sitemap, llms.txt, résumé, `_redirects`).

1. **Golden gate first.** Before anything is ported, freeze site.py's output for the real data and for the test
   fixtures (`tools/testdata/`) and add a check (`compare.py` grown up, in Vitest) that the new pipeline's pages
   match it: title, head tags, JSON-LD (parsed and text), canonical, headings, links, `main` structure and text,
   the shell byte for byte; JSON files byte for byte. Plus the browser check of this spike: `plaincheck.mjs`, equal
   `innerText`, and pictures with max 0 against site.py's pages. site.py is retired only when this is green, and
   the gate runs on every page the fixtures produce.
2. **Port the tests one for one into Vitest** (`unit` tier, Node), keeping names and fixtures: they mostly assert
   on parsed trees (`Tree`, `Node` become a small parse5 or `node-html-parser` helper), so they translate line
   by line. The Markdown tests include a comparison of the linear inline parser with the recursive one on random
   text; port it as a property test (`fast-check`) and, while site.py exists, also run the TS renderer against
   site.py's on the same random inputs (a differential test through `python3 -I`).
3. **Tests that change on purpose** (each to be listed, none dropped):
   `test_shell_unchanged_outside_the_three_replacements` keeps working only if the prerenderer adds the newlines
   (done here); `test_escaping`'s `assertNotIn('<!--', main)` holds only for stripped, unhydrated pages;
   `test_well_formed_unique_ids_and_no_scripts` (exactly the shell's three scripts and JSON-LD; no `button` in
   `main`) holds only if plain pages are not hydrated and carry no UI SDK island. Raw-escaping assertions
   (site.py writes `'` as `&#x27;`, Solid does not) become assertions on parsed text.
4. **Writing and pruning** (`test_second_run_writes_nothing`, `test_nothing_outside_out`,
   `test_a_removed_project_is_removed_and_nothing_else`, `test_an_error_anywhere_writes_nothing`): the same
   behaviour in the TS writer, the same tests.
5. Content checks (`tools/content.py`, `test_content.py`) can stay Python, or move with the loaders; they are
   independent of rendering.

## 7. Verdict and what it means

**Go with conditions**, for rendering the plain pages from Solid components at build time:

1. **No hydration on the plain pages.** They have nothing to interact with; hydrating costs about 39 kB of script and
   5 to 11 kB of data per page, makes them differ from today's in pixels, and races the station's reader. Render
   them as the static flavour (insertion markers stripped). Where a plain page someday needs an interactive part,
   use an island (`<NoHydration>` with `<Hydration id>`, shown working with sixteen UI SDK parts).
2. **Keep D2's plain mode and `solid()` as it is** (`ssr: false`): it prerenders the same pages with
   `vite build --ssr`, and keeps the hydration runtime out of the station's bundle.
3. **Head tags as our own component**, not `useHead` (1.1).
4. **Port the Markdown renderer** (`Inline`, `render_markdown` and their helpers, about 440 lines of site.py) and `site_extras.py` to
   TypeScript behind the golden gate and the differential test of section 6 before `tools/site.py` is removed.
   This is the largest piece of work, and it is not done here.
5. **The reader renders the article component itself** (U5) from the same data, instead of moving `#page`'s DOM;
   then one component serves the page and the in-room panel, which is D17's aim.
6. Toast region out of the flow from the first paint, and no-JavaScript styles for parts that measure (section 2),
   when they are used on a server-rendered page.

**D2.** The choice stands (plain mode, our own `index.html`, `render()` for the station), but its reason changes:
the pages are built from the built shell by a TypeScript prerender step with `renderToString` instead of by
`tools/site.py`. Section 12's "not in this program: ... server rendering" needs the owner's word, since D17 reverses it.

**D3.** Still true in substance (pages that read without JavaScript, from the built shell); the writer changes.

**F1.** `pnpm build` becomes `vite build` plus a server build of a pages entry and a prerender script that writes
the pages into `dist/`, in place of `python3 tools/site.py --shell dist/index.html --out dist`. F1 can land first
with site.py as planned; the switch is its own card after the golden gate exists. The shell keeps its three markers.

**U cards.** A new card (or a widened U10/D1) ports the generator: Markdown, the other page kinds, feed, sitemap,
llms.txt, JSON, writing and pruning, the tests of section 6, behind the golden gate. U5 should render the article
component rather than adopting `#page`. U6a's `contact_page` and `profile_json` changes, U10's `RUNTIME_IDS`
and F1's `--shell` move with it. The article components live in `src/app/components/` and must not import
`@ui-sdk/solid` outside `src/app/ui/` (unchanged rule); the plain pages need no UI SDK part.

## 8. Runs

| Check | Where | Result |
|---|---|---|
| `ci prog/U0d-ssr-spike static` (c86ab82e) | second CI host | PASS 14 s |
| `script ssr-spike.mjs` (c86ab82e) | CI host | FAIL 96 s: the held entry blocked `domcontentloaded` (fixed: `async`) |
| `script ssr-spike.mjs` (b5897d9f) | CI host | FAIL 819 s: no hydration script (1.3); markers' pixel difference (1.2) |
| `script ssr-spike.mjs hydrate,kit` (dfe67144) | CI host | FAIL 104 s: hydration all ok; the kit's picture changed (section 2) |
| `script ssr-spike.mjs nojs,kit` (72184efe) | CI host | FAIL 968 s: nojs all ok except the full flavour's two desktop pictures (1.2, expected); kit step crashed (script bug) |
| `script ssr-spike.mjs kit` (09560454, f78878a1, 75cd2d5d) | second CI host | FAIL 77, 53, 57 s: kit as in section 2 (the Toast move; the station's own errors) |
| `ci prog/U0d-ssr-spike static` (d9c7a5e4, after merging prog/int) | second CI host | PASS 71 s |
| `script ssr-spike.mjs`, all sections (d9c7a5e4) | second CI host | FAIL 547 s, 164 ok: the two full-flavour desktop pictures (1.2), the kit findings, and six lines from a bug of the script (a page error compared with its stack attached against site.py's without it; the error is the station's "e is not a function" at `main.js:44`, on site.py's page too) |
| `script ssr-spike.mjs hydrate,kit` (baff765e, that bug fixed) | second CI host | FAIL 195 s, 76 ok: every hydration line ok in both modes; the two FAIL lines are the kit's findings (Toast region move, the station's own errors on the kit page) |

The remaining FAIL lines are findings, not breakage: the full flavour's pictures (1.2), the Toast region (2), and
the station's WebGL errors on the kit page, which the script does not filter there.
