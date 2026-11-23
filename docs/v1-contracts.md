# V1 content migration: contracts

The posts move from Sanity into `data/`, and each becomes a real page at `/blog/<slug>/` that is also the Library room with that volume read as a hologram. Several people and agents build the parts; this file fixes what passes between them. If a part needs something different, change this file in the same commit.

## 1. URLs

| URL | What it is |
|---|---|
| `/` | Atrium. Other rooms: `/?room=about`, `projects`, `experience`, `comms` (unchanged in V1) |
| `/blog/` | The Library, with the list of posts in the page |
| `/blog/<slug>/` | The Library with that post read; the article is in the page's HTML |
| `/blog/media/<name>`, `/blog/files/<name>` | Images (re-encoded) and files used by posts |
| `/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/llms.txt` | Static endpoints |
| `/resume/<file>.pdf` | The résumé the profile points to |

- Canonical URLs end in `/`. Canonical origin: `content.SITE` (`https://adithya-rajendran.com`).
- Old URLs redirect (`public/_redirects`, written by `tools/site_extras.py` because the résumé's file name comes from the data): `/blog/tags/*` → `/blog/`; `/portfolio`, `/portfolio/*` → `/?room=projects`; `/about` → `/?room=about`; `/contact` → `/?room=comms`; `/resume`, `/resume/view`, `/resume/download` → the PDF. `/studio`, `/api/contact`, `/openapi.json` and `/.well-known/api-catalog` are gone.
- `?room=writing` keeps working and means `/blog/`.

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
- Links: only `http:`, `https:`, `mailto:` and paths starting with `/` are allowed; anything else renders as its text with no link. External links get `target="_blank" rel="noopener"`. `/portfolio/<slug>/` is written as `/?room=projects&project=<slug>`.
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
| `reader.slug()` | the post being read, or `null` |
| `reader.read(slug)`, `reader.close()` | what the READ button and BACK do |
| `volumes()` | the catalogue: `[{ slug, title }]` in shelf order |
| `held()` | slug of the book the drone presents, or `null` |

## 5. Tests

`tools/dtest.sh <script.mjs> [args]` runs a Playwright script from `tools/docker/` against the checkout it is in, serving `public/` inside the container at `http://127.0.0.1:8080` (env `ORIGIN`); nothing listens on the host. Screenshots go to `/out` (host `$OUT`, default `/tmp/dtest`).

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

`load_projects()` returns each link as a dict with the six keys `label`, `kind`, `url`, `post`, `project`, `file`, the three unused ones `None`. A page makes `post` the address `/blog/<slug>/`, `project` the address `/?room=projects&project=<slug>` (§3), and `file` a file it copies. (A link to the site's own pages is a `post` or `project` rather than an address, so it cannot go stale.)

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
| `contact_routes` | record: route id → `{title, prompt}` (both required strings) | required, not empty. The ids (`hello`, `hiring`, …) are valid HTML ids and keep their order |
| `credentials` | list of records, below | optional |
| `skill_groups` | list of `{title, skills}`; `skills` a list of strings | required, neither list empty |
| `social_links` | list of `{label, url}` | required, not empty |
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
| `/contact/` | Comms | `article.post.page[data-slug="contact"]`: the invitation, what to write about, the links |

- `/?room=<id>` still works. `/about`, `/contact` and `/portfolio/*` are pages now, so they leave `_redirects`.
- An article page (`/blog/<slug>/`, `/portfolio/<slug>/`) starts as a readable page (`html.reading`); a room's page starts as the station.
- All of these are generated and git-ignored, with the same rules as §3: the shell with three changes, every text escaped, the same link policy, deterministic, nothing written outside `--out`.

### Markup

The pages use the article markup of §3 (`header` with `.post-meta`, `h1`, `.post-lede`, `.post-tags`; `div.post-body`; `footer`) so that one stylesheet serves all. Additions:

- In `/experience/`, each timeline entry is `<section class="entry" id="<its id>">` with an `h2` (the title), a `p.post-meta` (organization · period · place) and its text. The reader opens the page at `/experience/#<id>`.
- A list of label/value pairs (a project's parameters and results) is a `<dl class="post-facts">`.
- A group of links (a project's links, the social links) is a `<ul class="post-links">`.
- A project page ends with `p.post-next` to the next project in order, as a post does.
- Sections of a page that are not prose from a body get an `h2` with an `id`, like body headings.

### `public/portfolio/index.json`

```json
{ "v": "<8 hex>",
  "projects": [ { "slug": "homelab", "url": "/portfolio/homelab/", "name": "Homelab", "title": "Rebuildable OpenStack homelab",
                  "summary": "…", "status": "active", "status_label": "Active", "period": "2022 – now", "year": "2022",
                  "types": ["infrastructure"], "role": "…", "technologies": ["MAAS", "Juju"], "featured": null, "quiet": false } ] }
```

In the projects' own order. `period` is how the dates read (`"Dec 2022 – Oct 2026"`, `"2026"`, `"2022 – now"`; `null` with no dates); `year` the year it began. `role`, `featured` (a rank, 1 first) and `period` may be `null`.

### `public/profile.json`

```json
{ "v": "<8 hex>", "name": "…", "headline": "…", "tagline": "…", "location": "…", "introduction": "…", "focus": ["…"],
  "availability": { "status": "open", "label": "Write about a role", "seeking": ["Summer 2027 internships"] },
  "curiosities": [ { "kind": "question", "title": "…", "note": "…", "url": null } ],
  "timeline": [ { "id": "canonical-2024", "url": "/experience/#canonical-2024", "kind": "work", "title": "…", "organization": "…", "org_short": "Canonical",
                  "period": "May 2024 – Jul 2026", "year": "2024", "current": false, "location": "Remote", "employment": "full-time", "summary": "…" } ],
  "links": [ { "label": "LinkedIn", "url": "https://…" } ],
  "contact": { "intro": "…", "invitation": "…", "email": null, "routes": [ { "id": "hello", "title": "Hello", "prompt": "…" } ] },
  "resume": "/resume/<file>.pdf" }
```

What the rooms show of the profile, as plain text (no markup). `timeline` is newest first. `availability`, `resume`, `contact.email` and the optional fields of a record may be `null`. `url` values are site paths or `http(s)` URLs.
