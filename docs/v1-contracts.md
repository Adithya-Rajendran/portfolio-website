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
- Old URLs redirect (`public/_redirects`): `/blog/tags/*` → `/blog/`; `/portfolio`, `/portfolio/*` → `/?room=projects`; `/about` → `/?room=about`; `/contact` → `/?room=comms`; `/resume`, `/resume/view`, `/resume/download` → the PDF. `/studio`, `/api/contact`, `/openapi.json` and `/.well-known/api-catalog` are gone.
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
- Images: longest side at most 1600 px, WebP, metadata stripped (`~/.local/opt/webp/bin/cwebp`); `width`/`height` are the written file's. Files: copied to `/blog/files/` under their original name (`data/assets/files.json`).
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

- With no JavaScript or no WebGL, `#page` is the page: an ordinary scrolling document (`public/page.css`).
- When the station starts, it takes `article.post` out of `#page` and shows that same element inside the hologram. Going to another post in the room fetches `/blog/<slug>/index.html` and takes its `article.post`.
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
