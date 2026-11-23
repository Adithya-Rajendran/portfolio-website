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

Read only through `tools/content.py` (`load_posts()`, `load_profile()`, `SITE`, `DATA`). The slug is the file name.

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
- Every field's type is checked, and: `revised` is not before `published`; the changelog is newest first and no entry predates `published`; each `projects` slug has a `data/projects/<slug>.json`.
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
