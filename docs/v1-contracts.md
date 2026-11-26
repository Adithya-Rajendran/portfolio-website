# V1 content migration: contracts

The posts move from Sanity into `data/`, and each becomes a real page at `/blog/<slug>/` that is also the Library room with that volume read as a hologram. Several people and agents build the parts; this file fixes what passes between them. If a part needs something different, change this file in the same commit.

## 1. URLs

| URL | What it is |
|---|---|
| `/` | Atrium |
| `/about/`, `/portfolio/`, `/portfolio/<slug>/`, `/experience/`, `/contact/` | The other rooms and what is read in them (§8) |
| `/blog/` | The Library, with the list of posts in the page |
| `/blog/<slug>/` | The Library with that post read; the article is in the page's HTML |
| `/blog/media/<name>`, `/blog/files/<name>` | Images (re-encoded) and files used by posts |
| `/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/llms.txt` | Static endpoints |
| `/resume/<file>.pdf` | The résumé the profile points to |

- Canonical URLs end in `/`. Canonical origin: `content.SITE` (`https://adithya-rajendran.com`).
- Old URLs redirect (`public/_redirects`, written by `tools/site_extras.py` because the résumé's file name comes from the data): `/blog/tags/*` → `/blog/`; `/resume`, `/resume/view`, `/resume/download` → the PDF. `/about/`, `/portfolio/` and `/contact/` are pages (§8). `/studio`, `/api/contact`, `/openapi.json` and `/.well-known/api-catalog` are gone.
- A room is named by its path only. The old `?room=<id>` query is gone on every host: an address that has it opens the Atrium and stays as it is.

## 2. A post: `data/posts/<slug>.md`

Read only through `tools/content.py` (`load_posts()`, `load_projects()`, `load_profile()`, `SITE`, `DATA`). The slug is the file name.

Header, between two `---` lines (a strict subset of YAML, so GitHub shows it as a table):

```
---
title: "Quoted with JSON escapes when it holds a colon, a quote or a #"
description: "One or two sentences."
published: 2026-03-30
revised: 2026-10-25                  # optional
tags: [homelab, infrastructure]
image: 5eeba53d…-1200x630.png        # optional: the social card, a file name in data/assets/images/
image_alt: "…"
takeaways:                           # optional; items may use inline Markdown
  - "…"
changelog:                           # optional, newest first
  - date: 2026-10-25
    kind: correction                 # update | correction
    note: "…"
next: another-slug                   # optional
next_reason: "…"
projects: [homelab]                  # optional: slugs in data/projects/
---
```

- String values are written as JSON strings (`"…"`) unless they are a date or a single slug-like word.
- Unknown fields are an error.
- Every field's type is checked, and: `revised` is not before `published`; the changelog is newest first and no entry predates `published`; each `projects` slug has a `data/projects/<slug>.md` (§6).
- `image` is copied to the public site unchanged, so it must be a PNG or JPEG of exactly 1200×630 with no EXIF data, named without a folder.

Body: this Markdown and nothing else (it is all valid CommonMark, so it previews on GitHub). `tools/testdata/posts/every-construct.md` uses every construct and is the renderer's fixture.

| Construct | Written as |
|---|---|
| Headings | `## ` and `### ` (the title is the page's only `h1`) |
| Paragraph | lines up to a blank line |
| Inline | `` `code` ``, `**strong**`, `*emphasis*`, `[text](url)`; `\` escapes `* _ \` [ ]` |
| Lists | `- ` and `1. `; one nested level, indented 4 spaces |
| Quotation | `> ` |
| Code | fenced with three backticks and a language (`bash`, `yaml`, `python`, `text`); content verbatim |
| Image | alone in a paragraph: `![alt](../assets/images/<file> "caption")`; the caption is optional, may use inline Markdown, and escapes `"` as `\"` |
| Link to a post | `/blog/<slug>/` |
| Link to a project | `/portfolio/<slug>/` |
| Link to a file | `../assets/files/<file>` |

Raw HTML is not Markdown here: `<` is text and is escaped.

## 3. What `tools/site.py` writes

All of it is generated and git-ignored. Running it twice gives identical files; it removes files it wrote for posts that no longer exist.

### `public/blog/index.json`

```json
{ "v": "<8 hex: hash of everything below>",
  "posts": [ { "slug": "my-homelab", "url": "/blog/my-homelab/", "title": "…", "description": "…",
               "published": "2026-03-30", "revised": "2026-10-25", "date": "30 March 2026",
               "minutes": 6, "words": 1187, "tags": ["homelab", "infrastructure"],
               "sections": [ { "id": "the-chain", "title": "The chain", "level": 2 } ] } ] }
```

Newest first. `revised` is `null` when absent. `sections` are the body's `h2` and `h3` in order.

### Pages

`public/blog/index.html` and `public/blog/<slug>/index.html` are `public/index.html` with exactly three changes:

1. the `<title>` element's text;
2. `<!--site:head-->` replaced by the page's head tags: description, canonical link, Open Graph and Twitter card tags, `<link rel="alternate" type="application/rss+xml">`, one JSON-LD `<script type="application/ld+json">` (`BlogPosting`, or `Blog` for the list);
3. `<!--site:page-->` replaced by `<main id="page">…</main>`.

Everything else in the shell stays byte for byte. The shell has `<base href="/">`, so every URL the generator writes starts with `/`.

A post's `<main>`:

```html
<main id="page">
<article class="post" data-slug="my-homelab">
  <header>
    <p class="post-meta"><time datetime="2026-03-30">30 March 2026</time> · <span class="post-minutes">6 min read</span>
       · <span class="post-revised">Revised <time datetime="2026-10-25">25 October 2026</time></span></p>
    <h1>A Homelab Built to Be Rebuilt</h1>
    <p class="post-lede">The description.</p>
    <ul class="post-tags"><li>homelab</li><li>infrastructure</li></ul>
  </header>
  <section class="post-takeaways"><h2>Takeaways</h2><ul><li>…</li></ul></section>
  <div class="post-body">
    <h2 id="the-chain">The chain</h2>
    <p>…</p> <ul>…</ul> <ol>…</ol> <blockquote><p>…</p></blockquote>
    <pre data-lang="bash"><code>…</code></pre>
    <figure><img src="/blog/media/<name>.webp" width="1200" height="1600" alt="…" loading="lazy" decoding="async"><figcaption>…</figcaption></figure>
  </div>
  <footer>
    <section class="post-changelog"><h2>Changes</h2><ul><li><time datetime="2026-10-25">25 October 2026</time> <b>Correction</b> …</li></ul></section>
    <p class="post-next"><a href="/blog/<slug>/"><span>Next</span> Title of the next post</a> The reason.</p>
  </footer>
</article>
</main>
```

- Optional parts (`post-revised`, `post-tags`, `post-takeaways`, `figcaption`, `post-changelog`, `post-next`) are left out when empty.
- Heading ids: the heading's text, lower-cased, anything but `a-z0-9`, space and `-` removed, spaces to `-`; a repeat gets `-2`, `-3`.
- Dates print as `30 March 2026`.
- Links: only `http:`, `https:`, `mailto:` and paths starting with `/` are allowed; anything else renders as its text with no link. External links get `target="_blank" rel="noopener"`. A link to a project is its page, `/portfolio/<slug>/`.
- Images: longest side at most 1600 px, WebP, metadata stripped, turned upright if the camera stored them sideways (`~/.local/opt/webp/bin/cwebp`); `width`/`height` are the written file's. A re-encoded image is named `<source name>.<8 hex of source and encoding>.webp`, so its URL can be cached for good; the social card is copied unchanged for `og:image`. Files: copied to `/blog/files/` under their original name (`data/assets/files.json`).
- Every piece of text from the data is HTML-escaped. The generator writes no inline `<script>` other than the JSON-LD, in which every `<` is written as `\u003c`.

The list page's `<main>`:

```html
<main id="page">
<section class="post-list">
  <h1>Writing</h1>
  <p class="post-lede">The profile's writingDescription.</p>
  <ol>
    <li><a href="/blog/<slug>/">Title</a> <p>Description</p>
        <p class="post-meta"><time datetime="…">30 March 2026</time> · 6 min read</p></li>
  </ol>
</section>
</main>
```

## 4. The page in the browser

The class on `<html>` says which of three things the page is (`public/post.css`; set by a one-line script in the shell's head):

| Class | When | What shows |
|---|---|---|
| none | no JavaScript, or WebGL failed | `#page`, an ordinary scrolling document, and `#pagenav` |
| `reading` | an article's own URL, from the first paint | the same, with the Library loading behind it; then it steps in by itself, or offers to (`#stepin`) if the reader has scrolled or asked to save data |
| `station` | everywhere else, and after stepping in | the 3D site; `#page` is put away |

- In the station, reading a post takes `article.post` out of `#page` (or fetches `/blog/<slug>/` and takes its `article.post`) and shows that element inside the hologram, `#reader`.
- `public/js`, `public/main.js`, `public/index.html` and the stylesheets are not written by the generator.

Test hooks on `window.__lobby` (in addition to `ready`, `picks`, `setFocus`, `camera`, `mode`):

| Hook | Returns |
|---|---|
| `reader.state()` | `'closed'`, `'scanning'` or `'open'` |
| `reader.url()`, `reader.slug()` | the address of what is being read and its last path segment, or `null` |
| `reader.read(slug or path)`, `reader.close()` | what the READ button and BACK do |
| `volumes()` | the catalogue: `[{ slug, title }]` in shelf order |
| `held()` | slug of the book the drone presents, or `null` |
| `display.state()` | `{ lock, named, hint, gliding, cue }`: `lock` is `null` or `{ name, verb, rect: [left, top, width, height] }` (CSS px, of the corner marks around the pick under the pointer, 6 px out from the pick's outline); `named` the text of `#named` in the bar (the pick in focus; `''` for READ); `hint` the hint's words, `''` once it has gone: the room's own (`rooms.<id>.hint`, below) while it applies, otherwise the general one (`display.hint`) until something has been inspected; `gliding` true while the camera is on its way to or from a pick; `cue` is `null` or `{ name, words, rect }`: the cue standing on a pick (below), `rect` the corner marks in CSS px as `lock.rect`. `window.__lobby.display` has `state` only |
| `picks[i].name`, `.verb` | what the display calls the pick (upper case) and what a click on it does; both `''` on the reading pick (`reads`), which is never locked. Optional `picks[i].bounds()`: the pick's outline as world points |
| `scene.getObjectByName(...)`, `scene` | the reader's meshes by name. `ReadGlyph` (the READ glyph; the reading pick's `mesh.parent`; uniforms `uShow`, `uWord`, `uHover`, `uProgress`, no `uTime`), `ReadFrame`, `ReadBeam` (uniforms `uK`, `uFlow`), `ReadAnchor` (an `Object3D` on what is read). The ways of opening (below): `ScanSheet` (uniform `uSnap`) and `ScanFan` (a flat thing is scanned with one sheet and one fan; things with a shape with a `ScanBody` and a `ScanFan` each, so there can be several `ScanFan`), `ScanBody` (one box per thing with a shape), `ReadFlow` (receiving), `ReadPrint` (unfolding). A mesh that is not shown has `visible` false (itself or a parent) |
| `turn` | `null` in a room whose map does not turn (every room but Navigation), else `{ angle(), front(), settled(), moving(), byHand(), heading(), to(i, now), nudge(radians), step(d), grip() }`: `angle()` radians the route is turned from as laid out; `front()` the station nearest the front; `settled()` at rest; `moving()` coasting or settling after a release; `byHand()` the visitor turned it last (not a focus sending it to a station); `heading()` the station it is on or going to (`null` while held or coasting); `to(i, now)` turn to station `i` (at once with `now`, and always with reduced motion); `nudge(r)` as if dragged `r` radians and let go; `step(d)` `d` stations along the line at once; `grip()` pixels of drag to a radian now. Its picks have `station: i`. While the map turns the canvas has the class `turns` |
| `step(d)`, `enter(id)` | the tour one step on (stations first, in the line's order, then the rest), and a room change without a reload |

Nothing on the visitor's display (`#hud`, `#inspectbar`, `#lock`, the READ glyph and the scan) moves by itself: a part may move once when it appears, changes or is asked for, and then it is still. What the reader draws (a scan, the receiving, the unfolding) happens only when the visitor asks to READ something readable: `ScanFan`, `ScanSheet`, `ScanBody`, `ReadFlow` and `ReadPrint` are not visible at any other time, and once the article is open the beam's `uK` and `uFlow` stay constant. The cue is the one thing that appears without being asked: once, when the room is seen wide, and then it is still (it follows its pick only as the view sways). With `prefers-reduced-motion: reduce` these are cuts. `tools/docker/hud.mjs` checks this.

### What can be read, and the ways it opens

A pick that offers something to read has `source()` (`js/reader.js` documents the fields). The ones the tests rely on:

| Field | Meaning |
|---|---|
| `url` | the page whose article it is: `/blog/<slug>/`, `/portfolio/<slug>/`, `/experience/#<id>` |
| `how` | the way it opens: `'scan'` (the default), `'unfold'` or `'receive'` |
| `bodies` | for `'scan'`: the things the scan crosses instead of a flat sheet, each `{ position, quaternion, size: [w, h, d], reads }` (a box in the room; `reads`: the one the frame's light rises from) |
| `station` | for `'unfold'`: the stop's own display, `{ page, holder }` (`page`: its sheet, a sprite with `userData.pane`; `holder`: its model) |

The reader's states are `closed -> scanning -> open` for every way. READ is offered (`picks.find(p => p.reads).live()`, `ReadGlyph` shown) under a thing that asks for it:

- **scan**, a flat thing (the Library's volume, a Fabrication exhibit): READ, then `scanning` with `ScanSheet` and one `ScanFan`, the glyph saying SCANNING.
- **scan**, things with a shape (the Lounge's books, from `scene.json` `focus[].boxes`): one `ScanBody` per box and a `ScanFan` to each, no `ScanSheet`; the glyph shuts when the scan starts and never says SCANNING. The pick's `bounds()` are the boxes' corners, so the display's lock goes round the things; its pick mesh is the box that holds them.
- **receive**, what has nothing of its own in the room (Fabrication's "ALL n PROJECTS" button; any address that names nothing in the room): no READ is offered at any time, no `ScanFan`, `ScanSheet` or `ReadBeam`; `ReadFlow` shows while it arrives (not with reduced motion: a cut). After CLOSE nothing is offered (`live()` false, `ReadGlyph` not shown) and the button opens it again.
- **unfold**, a station of Navigation's route map: READ is offered under the station; asked, the glyph shuts saying READ, nothing is scanned, `ReadPrint` shows briefly, the station's own sheet is dark while the frame carries its print (and, to the end, while it is read), then the frame is at rest and the words come. CLOSE part-way folds the frame where it is; afterwards every sheet has `material.opacity` 1.

A wall screen (a mesh with `userData.screen`) is a pick only where `rooms.<id>.screens.inspect` is not `false`.

### Navigation's turn, the cue and the hint

- The route map turns about the table's axis (`js/routemap.js` `TURN`, `main.js` `turning()`). A drag across the room (mouse, pen or finger; more than 6 px and at least as far across as up or down), a sideways wheel (`deltaX`) or Shift + a vertical wheel turns it; a plain vertical wheel does not and is left to the page. Released, it coasts (at most `TURN.FAST` rad/s) and settles with a station exactly at the front; with reduced motion it lands at once and a wheel steps a station (100 px) at a time. Not while something is read, not from inside `#reader`, the nav, the bar or a button; a press that stops a coasting map is not a click, nor is a click right after a drag. Focusing a station turns the map to it; turning it by hand with a station in focus moves the focus to the station that comes to the front. A synthetic `pointermove` must carry `buttons: 1`.
- The cue (`js/hud.js`, `#cue`): a pick may carry `cue: { pointer, touch }` (`rooms.writing.cue`: "CLICK TO CHOOSE A BOOK" / "TAP TO CHOOSE A BOOK"). The display shows it on the first live pick that has one, in the room's wide view at rest only: marks on the pick's outline and a tag `<name> | <words>` (`display.catalogue`, `rooms.writing.cue`), clear of the page's words. It is not there while the lock is on anything, with anything in focus, during a glide or the opening move, while a room loads or while reading, and for good (this visit to the room) once its pick has been in focus. Pressing the tag's words does what a click on the pick does.
- The hint: `display.hint` is the general one (`pointer`, `touch`). A room may have its own (`rooms.experience.hint = { pointer, touch, until: 'turn' }`), shown in its place until the visitor has done what `until` names (the map turned by hand), remembered for the page's life.

### `scene.json`: `focus[].boxes`

An entry of `focus` (a round-ish thing the camera can come to: `c`, `r`, `dir`) may carry `boxes`: `[{ c: [x, y, z], size: [w, d, h], turn, reads? }]`, in Blender's axes (the room maps (x, y, z) to (x, z, -y)): the centre, the size along x, y and z, the turn about the vertical in radians, and `reads: true` on the one the reading's light rises from. Where there are boxes the exhibit's source has `bodies`, and its pick's `bounds()` are their corners. The Lounge's `focus[0]` has the two books on the table.

### `content.json`, as the tests read it

- `rooms.<id>.sub` is `[]` in every room but the Atrium (`["{name}  ·  {headline}"]`) and the Lounge (`["{headline}  ·  {location}"]`); `js/site.js` fills them from `profile.json`, drops a line whose place it cannot fill, and with no profile both are `[]`. `main.js` hides `.sub` when it has no lines. There is no other explanatory line under a room's headline.
- `rooms.projects.screens.inspect` and `rooms.experience.screens.inspect` are `false`, and their cards have no `cta`: the wall screens of those rooms are not picks, not on the tour and not sources.
- `reader.receiving` ("RECEIVING") is what the receiving says; `reader.scanning` what the glyph says while a flat thing is scanned.
- `display` holds the display's own words: the verbs `read`, `inspect`, `open`, `write`, `enter`, `stops`, `sealed`, `choose`, the names `catalogue` and `exhibit`, and `hint`.
- `rooms.comms` (Contact): `cta` ("GET IN TOUCH  →"), `bright: true` (`main.js` sets `body.bright`), screens tag "COMMS" and two placeholders `js/site.js` fills, and `comms`: `title`, `standby`, `openTo`, `resume`, `opens`, `writeNote`. It offers Contact's three links (from `profile.contact.links` followed by `profile.resume`, with the first marked as the way to write to the owner). `section#comms[data-mode="links"]` holds real links `a[target=_blank][rel=noopener]` with `aria-label` `"<label>, opens in a new tab"`, `inert` until the field is open. The pick `picks.find(p => p.cta)` is named "CONTACT" and its verb is `display.open`.

## 5. Tests

`tools/dtest.sh <script.mjs> [args]` runs a Playwright script from `tools/docker/` against the checkout it is in, serving `public/` inside the container at `http://127.0.0.1:8080` (env `ORIGIN`); nothing listens on the host. Screenshots go to `/out` (host `$OUT`, default `/tmp/dtest`). `hud.mjs [desktop|phone|reduced|all]` tests the visitor's display (§4): the lock, the names, the bar's caption, the hint, and that the READ glyph and the scan are still unless READ is asked. For pixel-identical engine regression checks across all six rooms (`max diff == 0`), `tools/ci/run.sh pictures [--against <base>]` runs `docker/detsnap.mjs` (hiding DOM overlays without collapsing layout under a paused fake clock) over the 34 fixed states in `tools/ci/pictures.txt` and enforces `pdiff.mjs --strict --fail-max=0` (with golden caching on the CI host by commit and a hash of the state list, `detsnap.mjs`, the Playwright image ID and the container setup). `detsnap.mjs` draws 2D canvases in software (`--disable-accelerated-2d-canvas`), so the `snap` tier and `tools/detsnap.sh`, which run the same script, do too; GPU-drawn canvas text is not the same from run to run.

The other browser scripts print `ok` or `FAIL [profile item] what` and exit 1 on a failure (`tools/check.sh` runs them all):

| Script | Tests |
|---|---|
| `rooms.text.mjs` | the page's words (`sub`), the wall screens that are not to be pressed |
| `opening.mjs` | the ways of opening: Fabrication (scan, receive), the Lounge's books, a station unfolding |
| `turn.mjs` | the route map's turn (mouse, pen, touch, wheel), the tour, Navigation's hint |
| `cue.mjs` | the Library's cue and the drone's errand |
| `contact.mjs` | Contact's three links (LinkedIn marked to write, GitHub, résumé), keyboard, new tabs, and legibility |
| `rooms.read.mjs`, `rooms.others.mjs`, `rooms.cross.mjs`, `rooms.deeplink.mjs` | each room at its path; what is read in Fabrication, Navigation, the Lounge; links from one reading into another; a project's and an entry's own address |
| `library.mjs`, `history.mjs`, `deeplink.mjs`, `hostile.mjs` | the Library; the address and Back; an article's own URL; the rooms against hostile and thin data |

`rooms.kit.mjs` and `r2.kit.mjs` are what these share (the profiles, a recorder of the reader's meshes, a gate on the page's frames).

Playwright's test runner lives alongside them under `tests/e2e/` (`playwright.config.ts` with `desktop`, `phone`, `reduced`, `smoke-firefox`, and `smoke-webkit`; `serve.mjs`; `fixtures/site.ts`; `pages/station.ts`; `helpers/plaincheck.ts`; and `specs/`). `tests/e2e/README.md` maps every script in `tools/check.sh` to its spec and owning task; legacy scripts in `tools/docker/` stay in place until their owning UI tasks (`U2`–`U8`) replace them.

## 6. A project: `data/projects/<slug>.md`

Read only through `content.load_projects()`. The slug is the file name (lower-case words joined by hyphens). Same file shape as a post: a header between two `---` lines in the same strict subset of YAML (§2), then a body.

```
---
title: "Evaluating detectors on driving scenes"
name: "Driving detection study"
summary: "One or two sentences."
order: 5
status: completed
types: [research, software]
started: 2026-01-01
ended: 2026-02-01
date_precision: year
cover: 24224f39…-2160x1440.png
cover_alt: "…"
problem: "…"
approach: "…"
highlights:
  - "…"
parameters:
  - label: "KITTI validation frames"
    value: "3,769"
links:
  - label: "Read report (PDF)"
    kind: paper
    file: "fc41d42d….pdf"
---
## What I changed
…
```

### The header

Written as in §2: strings as JSON strings (`"…"`, unless a single slug-like word), lists as `[a, b]` or `["a b", "c"]` or as `key:` followed by `  - ` lines, a record as `  - key: value` followed by `    key: value` lines. Numbers, `true` and `false` are written bare. Unknown fields are an error. Every field's type is checked; every string is one line, not empty, and without a space at either end. Absent fields come back from `load_projects()` as `None` (a list as `[]`).

| Field | Type | | Meaning |
|---|---|---|---|
| `title` | string | required | The long title: what the page's `h1` says |
| `name` | string | required | The short name, for lists and labels |
| `summary` | string | required | One or two sentences |
| `order` | whole number ≥ 1 | required | Position in lists, ascending. Unique among projects. Only an ordering: never shown or used as an identifier |
| `status` | `active` or `completed` | required | |
| `status_note` | string | optional | What state the work is in, for a reader |
| `types` | list of `software`, `infrastructure`, `research`, `hardware` | required, not empty | |
| `technologies` | list of strings | optional | |
| `role` | string | optional | My part in it |
| `started` | date `2026-01-01` | optional | A real date |
| `ended` | date | optional | Needs `started`, is not before it, and is absent when `status` is `active` |
| `date_precision` | `year` or `month` | with `started`: required; without: not allowed | How much of `started` and `ended` to show (a project begun in 2022 is stored as `2022-01-01`, precision `year`) |
| `dates_approximate` | `true` or `false` | optional, needs `started` | The dates are estimates |
| `featured` | whole number ≥ 1 | optional | Present for the featured projects: 1 is shown first. Unique among projects |
| `quiet` | `true` or `false` | optional | A minor project, shown with less weight. `None` and `false` are the same |
| `cover` | file name | optional | An image in `data/assets/images/` (a bare file name that exists; any format) |
| `cover_alt` | string | optional, needs `cover` | Alt text. Without it the image is decorative (`alt=""`) |
| `cover_caption` | string | optional, needs `cover` | |
| `problem`, `approach`, `outcome` | string | optional | The brief. `problem` and `approach` come together; `outcome` needs them and is often absent |
| `highlights`, `lessons`, `next_steps` | lists of strings | optional | Sentences. Items may use inline Markdown (as a post's `takeaways` do: `` `code` ``, `**strong**`, `*emphasis*`, `[text](url)`, `\` escapes). |
| `parameters` | list of records `label`, `value` (strings, both required) | optional | Facts for a table, in order |
| `results` | list of records `metric`, `value` (required), `note` (optional) | optional | Measured outcomes. `note` comes back as `None` when absent |
| `links` | list of records, see below | optional | |

Every string that is not in the three lists of sentences is plain text: shown as written, `*` and `_` included.

**Nesting.** The Sanity `brief` object became three flat fields (`problem`, `approach`, `outcome`), since it is three strings; the `cover` object became three flat fields (`cover`, `cover_alt`, `cover_caption`); the three lists of records (`parameters`, `results`, `links`) are block lists of flat records.

**A link** has `label` and `kind` (`article`, `repo`, `paper`, `dataset` or `other`), both required, and exactly one place it goes:

| Field | Value | Checked |
|---|---|---|
| `url` | An `http:` or `https:` address (nothing else: no `mailto:`, no `javascript:`, no path) | scheme and host |
| `post` | A post's slug | `data/posts/<slug>.md` exists |
| `project` | A project's slug | that project's file exists |
| `file` | A file name | the file exists in `data/assets/files/` (bare name, not a link) |

`load_projects()` returns each link as a dict with the six keys `label`, `kind`, `url`, `post`, `project`, `file`, the three unused ones `None`. A page makes `post` the address `/blog/<slug>/`, `project` the address `/portfolio/<slug>/`, and `file` a file it copies. (A link to the site's own pages is a `post` or `project` rather than an address, so it cannot go stale.)

### Checks beyond the types

`ended` not before `started`; `status: active` has no `ended`; `order` and `featured` unique; every `cover`, `file`, `post` and `project` exists; and in the body, every `/blog/<slug>/` names a post, every `/portfolio/<slug>/` a project, every `../assets/files/<file>` and `../assets/images/<file>` an existing file (code fences are not looked at). Any mistake is a `ContentError` naming the file and the field, as `` data/projects/homelab.md: `links[1].post`: there is no data/posts/x.md ``.

### The body

Exactly the Markdown of §2 (headings `##` and `###`, paragraphs, lists, quotations, code, images, links), the page's text under its `h1`. It may be empty.

### What `load_projects()` returns

A list ordered by `order`. Each project is a dict of every header field above (typed: `order` and `featured` int, `quiet` and `dates_approximate` bool, dates as `YYYY-MM-DD` strings, lists as lists, records as dicts with all their keys), plus `slug`, `body` (the Markdown) and `words` (prose words of the body, counted as for a post).

## 7. The profile: `data/profile.json`

One JSON file (it is nested lists of records, which the header format cannot hold). Read only through `content.load_profile()`, which returns it as a dict: every field below, absent optional ones `None` (a list `[]`). It is plain JSON: names are `snake_case`; dates are `YYYY-MM-DD` strings; whole numbers and booleans are JSON numbers and booleans; no Sanity bookkeeping (`_key`, `_type`, …); no duplicate keys; no `NaN`.

All text is plain text, shown as written (no Markdown). Strings are not empty and have no space at either end; they are one line, except `bio`, which is paragraphs separated by one blank line (`"\n\n"` in JSON). A file name is a bare name (no folder) of an existing file: `image` names are in `data/assets/images/`, `file` names in `data/assets/files/`. A `post` or `project` is a slug of an existing `data/posts/<slug>.md` or `data/projects/<slug>.md`. Every URL is `http` or `https`. A malformed file is a `ContentError` naming the field (`` data/profile.json: `timeline[1].end_date`: must be a date like 2026-03-30 ``).

| Field | Type | |
|---|---|---|
| `name`, `headline`, `tagline`, `introduction`, `work_summary`, `location`, `seo_description`, `writing_description`, `projects_intro`, `contact_intro`, `contact_invitation` | string | required. `writing_description` is the list page's lede (§3) |
| `bio` | string, paragraphs | required |
| `focus_areas` | list of strings | optional |
| `featured_post` | post slug | optional |
| `resume` | file name (a PDF) | optional. `/resume/<file>.pdf` is written from it (§1) |
| `availability` | record, below | required |
| `contact_routes` | record: route id → `{title, prompt}` (both required strings) | required, not empty (retained in the profile data; not rendered on `/contact/`) |
| `credentials` | list of records, below | optional |
| `skill_groups` | list of `{title, skills}`; `skills` a list of strings | required, neither list empty |
| `social_links` | list of `{label, url}` | required, not empty |
| `contact_links` | list of strings naming `social_links[].label` entries | optional, not empty when present, unique; the first is the way to write to the owner. Absent falls back to `social_links` |
| `current_curiosities` | list of records: `title` (required string), `note` (string), `project` (a project slug) | optional |
| `curiosities_updated_at` | date | optional |
| `talks_and_papers` | list of records, below | optional |
| `timeline` | list of records, below | required, not empty |

`availability`: `status` (a lower-case word, e.g. `open`) and `cta` (string), both required; `seeking` (list of strings) and `updated_at` (date), optional.

`credentials` entries: `title`, `issuer` (strings) and `issued_on` (date), required; `expires_on` (date, not before `issued_on`), `lifetime` (boolean; `true` means no `expires_on`), `verification_url` (URL), `badge` (image file name) and `badge_alt`, optional (`badge_alt` needs `badge`).

`talks_and_papers` entries: `title`, `kind` (free word, e.g. `report`) and `date`, required; `authors`, `venue`, `abstract` (strings), `project` (a project slug) and `links`, optional. A link is `{label, kind, url | post | project | file}` exactly as in §6 (`kind` one of `article`, `repo`, `paper`, `dataset`, `other`; exactly one of the four places).

`timeline` entries, newest first by `start_date`:

| Field | Type | |
|---|---|---|
| `id` | HTML id: lower-case letters, digits, hyphens, starting with a letter | required, unique, **stable**: the address of the entry for links (`#sjsu-2026`). Made from the organization's short name and the start year; it does not change when the entry is edited |
| `kind` | `work` or `education` | required |
| `organization`, `org_short`, `title` | string | required |
| `employment` | string (`full-time`, `internship`) | optional |
| `location`, `summary` | string | optional |
| `start_date` | date | required |
| `end_date` | date, not before `start_date` | optional; absent when `is_current` is `true` |
| `start_precision`, `end_precision` | `year` or `month` | optional; each needs its date. How much of the date to show |
| `expected_end_year` | whole number (year) | optional; not before the year of `start_date` |
| `is_current` | boolean | optional |
| `highlights` | list of strings | optional |
| `logo`, `logo_alt` | image file name, alt text | optional (`logo_alt` needs `logo`; without it the logo is decorative) |

Other checks: no two timeline ids are equal; the timeline is newest first.

## 8. Projects and the profile: what `tools/site.py` writes (phase 5)

Every room has a path, and the page at that path holds the room's text, so it reads without JavaScript or WebGL as the posts do.

| URL | Room | The page's `<main>` |
|---|---|---|
| `/about/` | Lounge | `article.post.page[data-slug="about"]`: who, what, where |
| `/portfolio/` | Fabrication | `section.post-list`: every project |
| `/portfolio/<slug>/` | Fabrication, that project read | `article.post.project[data-slug]` |
| `/experience/` | Navigation | `article.post.page[data-slug="experience"]`: the timeline, skills, credentials, talks, the résumé |
| `/contact/` | Comms | `article.post.page[data-slug="contact"]`: the invitation, the links, the availability |

- `/about`, `/contact` and `/portfolio/*` are pages now, so they leave `_redirects` (Cloudflare adds the trailing slash to `/about` and `/portfolio/<slug>` itself).
- An article page (`/blog/<slug>/`, `/portfolio/<slug>/`) starts as a readable page (`html.reading`); a room's page starts as the station.
- All of these are generated and git-ignored, with the same rules as §3: the shell with three changes, every text escaped, the same link policy, deterministic, nothing written outside `--out`, and a mistake anywhere writes nothing at all.
- On these pages a link to a project is its page, `/portfolio/<slug>/` (a §6 link's `project`, a curiosity's or a paper's `project`, and `/portfolio/<slug>/` in a project's body or inline lists). A post's links to a project are the same.
- Every heading id on a page is unique and none is an id of the shell or of `RUNTIME_IDS` (§3's rule). Ids the data fixes (a timeline entry's `id`) are used as they are and are reserved first, so a section heading of the same words takes `-2`; one that is an id of the shell is an error.

### Markup

The pages use the article markup of §3 (`header` with `.post-meta`, `h1`, `.post-lede`, `.post-tags`; `div.post-body`; `footer`) so that one stylesheet serves all. Additions:

- In `/experience/`, each timeline entry is `<section class="entry" id="<its id>">` with an `h2` (the title), a `p.post-meta` (organization · period · place) and its text. The reader opens the page at `/experience/#<id>`.
- A list of label/value pairs (a project's parameters and results) is a `<dl class="post-facts">`.
- A group of links (a project's links, the social links) is a `<ul class="post-links">`.
- A project page ends with `p.post-next` to the next project in order, as a post does.
- Sections of a page that are not prose from a body get an `h2` with an `id`, like body headings.

Exactly, page by page (an optional part is left out when its field is absent or empty; `·` is ` · `):

**`/portfolio/<slug>/`**

```html
<article class="post project" data-slug="homelab">
  <header>
    <p class="post-meta"><span class="post-status">Active</span> · 2022 – now · Infrastructure, Software</p>
    <h1>title</h1>
    <p class="post-lede">summary</p>
    <p class="post-role"><b>Role</b> role</p>                       <!-- optional -->
    <p class="post-status-note">status_note</p>                    <!-- optional -->
    <ul class="post-tags"><li>technology</li>…</ul>                 <!-- optional -->
  </header>
  <figure class="post-cover"><img class="post-cover-image" src="/media/<name>.webp" width="…" height="…" alt="cover_alt" decoding="async"><figcaption>cover_caption</figcaption></figure>
  <div class="post-body">
    <h2 id="problem">Problem</h2> <p>…</p>   <h2 id="approach">Approach</h2> <p>…</p>   <h2 id="outcome">Outcome</h2> <p>…</p>
    … the body, as a post's (§2, §3) …
    <h2 id="highlights">Highlights</h2> <ul><li>inline Markdown</li></ul>
    <h2 id="results">Results</h2> <dl class="post-facts"><dt>metric</dt><dd>value</dd><dd class="post-note">note</dd>…</dl>
    <h2 id="parameters">Parameters</h2> <dl class="post-facts"><dt>label</dt><dd>value</dd>…</dl>
    <h2 id="lessons">Lessons</h2> <ul>…</ul>   <h2 id="next-steps">Next steps</h2> <ul>…</ul>
    <h2 id="links">Links</h2> <ul class="post-links"><li data-kind="repo"><a href="…">label</a></li>…</ul>
    <h2 id="related-writing">Related writing</h2> <ul class="post-links"><li><a href="/blog/<slug>/">post title</a></li></ul>
  </div>
  <footer><p class="post-next"><a href="/portfolio/<slug>/"><span>Next</span> title of the next project</a></p></footer>
</article>
```

- Meta: the status label (`active` → `Active`, `completed` → `Complete`), the period when there are dates, the types (`Research`, `Software`, `Infrastructure`, `Hardware`) joined by `, `.
- The cover, without `cover_alt`, has `alt=""`; `figcaption` only with `cover_caption`; the image is not lazy (it is at the top). The whole `div.post-body` is left out when the project has none of its parts.
- The fixed section ids are taken before the body's headings: a body `## Links` becomes `links-2`. Related writing: the posts whose `projects:` names this one, newest first.
- `p.post-next`: the next project in `/portfolio/`'s order (below), the last leading to the first; none when there is only one project. A link record becomes: `url` as it is (external), `post` → `/blog/<slug>/`, `project` → `/portfolio/<slug>/`, `file` → `/blog/files/<original name>` (copied as for a post); `data-kind` is the record's `kind`.

**`/portfolio/`**: §3's list, `section.post-list` with `h1` `Projects` and `p.post-lede` the profile's `projects_intro`, then up to two groups, each an `h2` and an `ol`: `<h2 id="selected">Selected projects</h2>` and `<h2 id="more">Experiments &amp; systems</h2>`. Each item is `<li><a href="/portfolio/<slug>/">title</a> <p>summary</p> <p class="post-meta">…the project page's meta…</p></li>`; a quiet project's `li` has `class="quiet"`. The order (the previous site's): the featured projects by rank, then the rest by `order`. Selected: the project with `featured: 1` (else the first) and the next two that are not quiet; a quiet project is never selected unless all are. The rest keep the order.

**`/about/`**: `header`: `p.post-meta` (headline · location), `h1` (name), `p.post-lede` (tagline). `div.post-body`: `<p>` introduction; `h2#story` `The story so far` and a `<p>` per paragraph of `bio`; `h2#focus` `Current focus` and a `<ul>` of focus areas; `h2#curiosities` `Curiosities`, `<p class="post-meta">Updated <time>…</time></p>` (with `curiosities_updated_at`) and `<ul class="post-curiosities"><li><strong>title</strong> <p>note</p> <p class="post-meta">Project: <a href="/portfolio/<slug>/">project name</a></p></li></ul>`; the availability (below); `h2#featured-writing` `Featured writing` and `<p class="post-featured"><a href="/blog/<slug>/">title</a> description</p>`; `h2#elsewhere` `Elsewhere` and `ul.post-links` of the social links, then `Résumé (PDF)` → `/resume/<file>.pdf`.

The availability (on `/about/` and `/contact/`): `h2#availability` `Availability`; `<p class="post-availability" data-status="open"><b>Open</b> · updated <time datetime="2026-09-29">29 September 2026</time></p>`; a `<ul>` of `seeking`; `<p class="post-cta"><a href="/contact/">cta</a></p>` (omitted on `/contact/`).

**`/experience/`**: `header`: `h1` `Experience`, `p.post-lede` the `work_summary`. `div.post-body`: a `<section class="entry" id="<id>" data-kind="work|education">` per timeline entry, newest first, holding `<img class="entry-logo">` (with `logo`), `<h2>title</h2>`, `<p class="post-meta">organization · period · location · employment</p>`, `<p>summary</p>`, `<ul>` of highlights. The period is the timeline period (below), with ` (expected 2028)` when there is an `expected_end_year` and no end; employment is `Full-time`, `Internship`, …, left out when the title says it (`Internship` beside `… Intern`). The entry's `h2` has no id: the section has it. Then `h2#skills` `Skills`, and per group `<h3 id="…">title</h3><ul class="post-tags"><li>skill</li></ul>`; `h2#credentials` `Credentials` and `<ul class="post-credentials"><li><img class="post-badge"> <a href="verification_url">title</a> <span class="post-meta">issuer · Sep 2023 – Sep 2026</span></li></ul>` (the issuer is left out when the title names it; a lifetime credential or one without an expiry shows its issue month alone; no link without `verification_url`); `h2#talks-and-papers` `Talks and papers` and `<ul class="post-talks"><li><strong>title</strong> <p class="post-meta">Kind · <time datetime="2026-10-23">Oct 2026</time> · venue · authors</p> <p>abstract</p> <ul class="post-links">links, then <a href="/portfolio/<slug>/">Project: name</a></ul></li></ul>`; `h2#resume` `Résumé` and `ul.post-links` with the PDF.

**`/contact/`**: `header`: `h1` `Contact`, `p.post-lede` the `contact_intro`. `div.post-body`: `<p>` the `contact_invitation`; `h2#elsewhere` `Elsewhere` and `ul.post-links` of `contact_links` (falling back to `social_links`; the first marked as the way to write) then `Résumé (PDF)` → `/resume/<file>.pdf`, each with `target="_blank" rel="noopener"`; the availability. No form, and no address (§7 has none).

Every `img` on these pages has `width`, `height` (the written file's), `alt` (`""` when the data has none: decorative), `loading="lazy"` (except the cover) and `decoding="async"`.

### Dates and labels

- A month and year is `Dec 2022` (three-letter month); with precision `year`, the year alone.
- A project's period: `start – end`; the same text once when both read the same (`2026`); `start – now` for an `active` project without `ended`; `start` alone for a completed one without `ended`; `c. ` before it when `dates_approximate`; `null` without `started`. Precision: `date_precision` for both ends.
- A timeline period: the same, with `start_precision` and `end_precision` (absent: month), `– now` when `is_current`.
- Dates in full (an update, a revision) are §3's `29 September 2026`.

### Images and files

The cover, a body image of a project, a credential's badge and an organization's logo are written to `/media/<source name>.<8 hex>.webp` under §3's rules for `/blog/media/` (longest side at most 1600 px, WebP, metadata stripped, upright; the 8 hex cover the source and the encoding), so `/media/*.webp` is cached for good. A project's cover is also its `og:image` (that WebP). Files a project or the profile links are copied to `/blog/files/<original name>`, as a post's are; the résumé is §1's `/resume/<file>.pdf`.

### What is removed

`public/` also holds files nobody generates, so `tools/site.py` removes only what it wrote: it keeps `public/.generated-files`, the list of every file of its last run, and a later run removes the files on that list it no longer makes (only under `blog/`, `portfolio/`, `about/`, `experience/`, `contact/`, `media/` and `profile.json`, whatever the list says). `blog/` is wholly the generator's, and anything else in it is removed too (§3).

### Head

As a post's (§3): description, canonical link, `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (+ width, height, alt) when there is an image, `twitter:card` (`summary_large_image` with an image, else `summary`), the RSS link, one JSON-LD block whose `url` is the canonical URL. Titles: `<what> — <name>`.

| Page | `<title>` (`og:title`) | description | `og:type` | JSON-LD |
|---|---|---|---|---|
| `/about/` | `About — <name>` | `seo_description` | `profile` | `ProfilePage`, `mainEntity` the `Person` (`@id` `<SITE>/#person`): description, place, current work, `alumniOf`/`affiliation` (education ended / current), `knowsAbout` (skills), `hasCredential`, `sameAs` (social links) |
| `/portfolio/` | `Projects — <name>` | `projects_intro` | `website` | `CollectionPage` (`@id` `<SITE>/portfolio/`), `mainEntity` an `ItemList` of `ListItem` (`position`, `url`, `name`) in the page's order |
| `/portfolio/<slug>/` | `<title> — <name>` (`<title>`) | `summary` | `website` | `CreativeWork`: `name`, `alternateName` (name), `description`, `genre` (types), `keywords` (technologies), `creator`, `isPartOf` the collection, `image` (cover), `sameAs` (its `url` links) |
| `/experience/` | `Experience — <name>` | `work_summary` | `website` | `WebPage` `about` the `Person` |
| `/contact/` | `Contact — <name>` | `contact_invitation` | `website` | `ContactPage` `about` the `Person` with `sameAs`; no email, telephone or contactPoint |

### The other files

- `sitemap.xml` lists, after the home page, `/blog/` and the posts: `/about/`, `/portfolio/`, every project (in `/portfolio/`'s order), `/experience/`, `/contact/`, without `<lastmod>` (projects and the profile record no date of change).
- `llms.txt` gains `## Projects` (the `projects_intro`, then `- [title](<SITE>/portfolio/<slug>/): summary` in `/portfolio/`'s order) and the five pages under `## Site`.
- `_redirects` keeps `/blog/tags/*` and the résumé's rules only.
- `_headers`: `/portfolio/`, `/portfolio/:slug/`, `/portfolio/index.json`, `/about/`, `/experience/`, `/contact/` and `/profile.json` are `no-cache`; `/media/*.webp` is `public, max-age=31536000, immutable`.

### `public/portfolio/index.json`

```json
{ "v": "<8 hex>",
  "projects": [ { "slug": "homelab", "url": "/portfolio/homelab/", "name": "Homelab", "title": "Rebuildable OpenStack homelab",
                  "summary": "…", "status": "active", "status_label": "Active", "period": "2022 – now", "year": "2022",
                  "types": ["infrastructure"], "role": "…", "technologies": ["MAAS", "Juju"], "featured": null, "quiet": false } ] }
```

In the projects' own order. `period` is how the dates read (`"Dec 2022 – Oct 2026"`, `"2026"`, `"2022 – now"`; `null` with no dates); `year` the year it began. `role`, `featured` (a rank, 1 first) and `period` may be `null`.

Exactly: the keys in this order; `v` is the first 8 hex of the SHA-256 of the `projects` list as JSON with sorted keys (it changes when anything in the file does); the list is in `order` (§6), not in `/portfolio/`'s order; `status` and `types` are §6's values and `status_label` its label (`Active`, `Complete`); `period` as under *Dates*; `year` is `null` without `started`; `technologies` is `[]` without; `quiet` is `false` without.

### `public/profile.json`

```json
{ "v": "<8 hex>", "name": "…", "headline": "…", "tagline": "…", "location": "…", "introduction": "…", "focus": ["…"],
  "availability": { "status": "open", "label": "Write about a role", "seeking": ["Summer 2027 internships"] },
  "curiosities": [ { "kind": "question", "title": "…", "note": "…", "url": null } ],
  "timeline": [ { "id": "canonical-2024", "url": "/experience/#canonical-2024", "kind": "work", "title": "…", "organization": "…", "org_short": "Canonical",
                  "period": "May 2024 – Jul 2026", "year": "2024", "current": false, "location": "Remote", "employment": "full-time", "summary": "…" } ],
  "links": [ { "label": "LinkedIn", "url": "https://…" } ],
  "contact": { "intro": "…", "invitation": "…", "links": [ { "label": "LinkedIn", "url": "https://…" } ], "routes": [ { "id": "hello", "title": "Hello", "prompt": "…" } ] },
  "resume": "/resume/<file>.pdf" }
```

What the rooms show of the profile, as plain text (no markup). `timeline` is newest first. `availability`, `resume` and the optional fields of a record may be `null`. `url` values are site paths or `http(s)` URLs.

Exactly: the keys in this order. `v` is the first 8 hex of the SHA-256 of the rest of the object as JSON with sorted keys. `focus` is `focus_areas` (`[]` without); `availability.label` is `cta` and `seeking` `[]` without; a curiosity's `kind` is `"question"` when its title ends with `?`, else `null` (§7 has no field for it), `note` may be `null`, `url` is `/portfolio/<slug>/` of its project or `null`; a timeline entry's `period` is the timeline period (above), `year` the year of `start_date`, `current` is `is_current` (`false` without), `location`, `employment` (§7's value, `full-time`) and `summary` may be `null`; `links` are all `social_links` (used by `/about/`); `contact.links` are the ordered `contact_links` (falling back to `social_links`, first = way to write); `contact.routes` are `contact_routes` in the profile's order; `resume` is `/resume/<original name, percent-encoded>` or `null`. `availability` is never `null` today (§7 requires it).
