---
type: reference
title: The pages of the Library
depends: [docs/ref_post-file.md]
---
# The pages of the Library

This reference gives the files that the page generator writes in `public/blog/` from [the post files](ref_post-file.md).

## index.json

```json
{ "v": "<8 hex: hash of everything below>",
  "posts": [ { "slug": "my-homelab", "url": "/blog/my-homelab/", "title": "…", "description": "…",
               "published": "2026-03-30", "revised": "2026-10-25", "date": "30 March 2026",
               "minutes": 6, "words": 1187, "tags": ["homelab", "infrastructure"],
               "sections": [ { "id": "the-chain", "title": "The chain", "level": 2 } ] } ] }
```

- The post with the last date is first.
- `revised` is `null` when the post has no `revised` field.
- `sections` gives the `h2` and `h3` headings of the body, in order.

## The page of a post

The page `public/blog/<slug>/index.html` has this `<main>` element:

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

- The page has `post-revised`, `post-tags`, `post-takeaways`, `figcaption`, `post-changelog` and `post-next` only when the post has data for them.
- The id of a heading is its text in lower case letters, without the characters that are not `a-z0-9`, a space or `-`. Each space changes to `-`. A second heading with the same id has `-2` at the end, and the next one has `-3`.
- The page shows a date as `30 March 2026`.

## Images and files of a post

- The generator writes each image as WebP, with a maximum of 1600 px on each side and with no metadata. It turns an image upright when the camera recorded it on its side. It uses `~/.local/opt/webp/bin/cwebp`.
- `width` and `height` are the size of the file that it writes.
- The name of an image is `<source name>.<8 hex of source and encoding>.webp`, so a cache can keep its URL for all time.
- The generator copies the social card without a change for `og:image`.
- It copies the files to `/blog/files/` with their original names from `data/assets/files.json`.

## The list page

The page `public/blog/index.html` has this `<main>` element:

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
