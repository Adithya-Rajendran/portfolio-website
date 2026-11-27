---
type: concept
title: The page generator
depends: [docs/con_content-sources.md, docs/ref_blog-pages.md, docs/ref_room-pages.md, docs/ref_page-head.md, docs/ref_site-json.md, docs/ref_endpoints.md]
---
# The page generator

`tools/site.py` is the page generator.
It reads [the content](con_content-sources.md) through `tools/content.py`, and it writes the pages, the JSON files and the endpoints of the site.
`tools/site_extras.py` writes the endpoints for it.
Git does not keep the files that it writes.

## What it writes

| Output | Reference |
|---|---|
| `public/blog/`: the list of posts, a page for each post, `index.json`, and their images and files | [The pages of the Library](ref_blog-pages.md) |
| `public/about/`, `public/portfolio/`, `public/experience/`, `public/contact/` | [The pages of the rooms](ref_room-pages.md) |
| The tags in the head of each page | [The head of a page](ref_page-head.md) |
| `public/portfolio/index.json`, `public/profile.json` | [The reference of the JSON files](ref_site-json.md) |
| `public/media/, feed.xml, sitemap.xml, llms.txt, _redirects, /resume/` | [The reference of the endpoints](ref_endpoints.md) |

## How it makes a page

Each page is `public/index.html` with three changes, and the other bytes of the shell do not change:

- The text of the `<title>` element changes.
- The tags of the head of the page replace `<!--site:head-->`.
- `<main id="page">…</main>` replaces `<!--site:page-->`.

The shell has `<base href="/">`, so each URL that the generator writes starts with `/`.

## Rules

- Two runs give the same files.
- The generator writes only inside `--out`.
- A mistake in any part of the content stops the run before it writes a file.
- The generator escapes each text from the data for HTML.
- The only inline `<script>` that it writes is the JSON-LD, in which each `<` is `\u003c`.
- It permits only the links that start with `http:`, `https:`, `mailto:` or `/`. Other links change to their text, with no link. External links have `target="_blank" rel="noopener"`.
- A link to a project goes to the page of the project, `/portfolio/<slug>/`.
- The ids of the headings of a page are unique. No id is an id of the shell or of `RUNTIME_IDS` in `tools/site.py`.

## What it removes

`public/` also holds files that no tool writes, so the generator removes only the files that it wrote.

- It keeps the list of all files of its last run in `public/.generated-files`.
- A later run removes the files on that list that it does not make again, but only under `blog/`, `portfolio/`, `about/`, `experience/`, `contact/`, `media/` and `profile.json`.
- Only the generator writes in `blog/`, so it removes all other files in `blog/` too.
