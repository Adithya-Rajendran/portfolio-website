---
type: reference
title: The pages of the rooms
depends: [docs/ref_blog-pages.md, docs/ref_project-file.md, docs/ref_profile-file.md]
---
# The pages of the rooms

This reference gives the `<main>` element of the pages that the page generator writes from the projects and the profile.

| Path | Room | `<main>` contents |
|---|---|---|
| `/about/` | Lounge | `article.post.page[data-slug="about"]`: who, what and where |
| `/portfolio/` | Fabrication | `section.post-list`: all projects |
| `/portfolio/<slug>/` | Fabrication, with that project open | `article.post.project[data-slug]` |
| `/experience/` | Navigation | `article.post.page[data-slug="experience"]`: the timeline, the skills, the credentials, the talks and the résumé |
| `/contact/` | Comms | `article.post.page[data-slug="contact"]`: the invitation, the links and the availability |

## Shared markup

- The pages use the article markup of [a post](ref_blog-pages.md#the-page-of-a-post), so one style sheet serves all pages.
- When a field is not in the data or is empty, the page does not have the part for that field.
- `·` in the markup is ` · `, with a space on each side.
- A list of labels and values, for example the parameters and the results of a project, is a `<dl class="post-facts">`.
- A group of links, for example the links of a project or the social links, is a `<ul class="post-links">`.
- A section that is not text from a body has an `h2` with an `id`, as a heading of a body has.
- An id from the data, for example the `id` of a timeline entry, does not change, and the generator gives it to the entry first. A section heading with the same words has `-2` at the end. An id from the data that is an id of the shell is an error.
- Each `img` has `width` and `height` (the size of the file that the generator writes), `alt`, `loading="lazy"` and `decoding="async"`. `alt` is `""` when the data has no alt text, because the image is then decorative. The cover of a project does not have `loading="lazy"`.

## portfolio/<slug>/

```html
<article class="post project" data-slug="homelab">
  <header>
    <p class="post-meta"><span class="post-status">Active</span> · 2022 – now · Infrastructure, Software</p>
    <h1>title</h1>
    <p class="post-lede">summary</p>
    <p class="post-role"><b>Role</b> role</p>
    <p class="post-status-note">status_note</p>
    <ul class="post-tags"><li>technology</li>…</ul>
  </header>
  <figure class="post-cover"><img class="post-cover-image" src="/media/<name>.webp" width="…" height="…" alt="cover_alt" decoding="async"><figcaption>cover_caption</figcaption></figure>
  <div class="post-body">
    <h2 id="problem">Problem</h2> <p>…</p>   <h2 id="approach">Approach</h2> <p>…</p>   <h2 id="outcome">Outcome</h2> <p>…</p>
    … the body, as a post's …
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

- The page has `post-role`, `post-status-note` and `post-tags` only when the project has their fields.
- The meta line has the status label, then the period when the project has dates, then the types (`Research`, `Software`, `Infrastructure`, `Hardware`) with `, ` between them.
- The status label of `active` is `Active`, and of `completed` is `Complete`.
- Without `cover_alt`, the cover has `alt=""`. The page has `figcaption` only with `cover_caption`.
- When the project has none of the parts of `div.post-body`, the page does not have `div.post-body`.
- The fixed section ids come before the headings of the body, so a heading `## Links` in the body has the id `links-2`.
- Related writing gives the posts that name this project in their `projects` field, with the last post first.
- `p.post-next` goes to the next project in the order of `/portfolio/`, and from the last project to the first. With only one project, the page has no `p.post-next`.
- A link record changes to an `a` element. `url` does not change, `post` changes to `/blog/<slug>/`, `project` changes to `/portfolio/<slug>/`, and `file` changes to `/blog/files/<original name>`. The generator copies the file as it copies the files of a post. `data-kind` is the `kind` of the record.

## portfolio

- The page is a `section.post-list`, as the list of posts is, with the `h1` `Projects` and a `p.post-lede` with `projects_intro` of the profile.
- Then the page has a maximum of two groups, each an `h2` and an `ol`: `<h2 id="selected">Selected projects</h2>` and `<h2 id="more">Experiments &amp; systems</h2>`.
- Each item is `<li><a href="/portfolio/<slug>/">title</a> <p>summary</p> <p class="post-meta">…</p></li>`, with the meta line of the page of the project.
- The `li` of a quiet project has `class="quiet"`.
- The order is the featured projects by rank, then the other projects by `order`.
- The group has the project with `featured: 1`, or the first project, and the next two projects that are not quiet. The group does not include a quiet project, except when all projects are quiet.
- The other projects keep the order.

## about

- `header`: `p.post-meta` (`headline` · `location`), `h1` (name) and `p.post-lede` (tagline).
- `div.post-body` starts with a `<p>` with the introduction.
- `h2#story` `The story so far`, with a `<p>` for each paragraph of `bio`.
- `h2#focus` `Current focus`, with a `<ul>` of the focus areas.
- `h2#curiosities` `Curiosities`, with `<p class="post-meta">Updated <time>…</time></p>` from `curiosities_updated_at`, and `<ul class="post-curiosities"><li><strong>title</strong> <p>note</p> <p class="post-meta">Project: <a href="/portfolio/<slug>/">project name</a></p></li></ul>`.
- The availability, as below.
- `h2#featured-writing` `Featured writing`, with `<p class="post-featured"><a href="/blog/<slug>/">title</a> description</p>`.
- `h2#elsewhere` `Elsewhere`, with `ul.post-links` of the social links, then `Résumé (PDF)` to `/resume/<file>.pdf`.

## The availability

The pages `/about/` and `/contact/` show the availability:

- `h2#availability` `Availability`.
- `<p class="post-availability" data-status="open"><b>Open</b> · updated <time datetime="2026-09-29">29 September 2026</time></p>`.
- A `<ul>` of `seeking`.
- `<p class="post-cta"><a href="/contact/">cta</a></p>`, but not on `/contact/`.

## experience

- `header`: `h1` `Experience` and `p.post-lede` with `work_summary`.
- `div.post-body` has a `<section class="entry" id="<id>" data-kind="work|education">` for each timeline entry, with the last entry first. The reader opens the page at `/experience/#<id>`.
- Each entry has `<img class="entry-logo">` (with `logo`), `<h2>title</h2>`, `<p class="post-meta">organization · period · location · employment</p>`, `<p>summary</p>` and a `<ul>` of highlights.
- The `h2` of an entry has no id, because the section has it.
- The period is the timeline period, with ` (expected 2028)` when the entry has `expected_end_year` and no end.
- The employment is a label such as `Full-time` or `Internship`. The page does not show it when the title tells it, for example `Internship` with a title that ends in `Intern`.
- `h2#skills` `Skills`, and for each group `<h3 id="…">title</h3><ul class="post-tags"><li>skill</li></ul>`.
- `h2#credentials` `Credentials`, with `<ul class="post-credentials"><li><img class="post-badge"> <a href="verification_url">title</a> <span class="post-meta">issuer · Sep 2023 – Sep 2026</span></li></ul>`.
- The issuer is not on the page when the title names it. A lifetime credential, or a credential without an expiry, shows only its issue month. A credential without `verification_url` has no link.
- `h2#talks-and-papers` `Talks and papers`, with `<ul class="post-talks"><li><strong>title</strong> <p class="post-meta">Kind · <time datetime="2026-10-23">Oct 2026</time> · venue · authors</p> <p>abstract</p> <ul class="post-links">links, then <a href="/portfolio/<slug>/">Project: name</a></ul></li></ul>`.
- `h2#resume` `Résumé`, with `ul.post-links` with the PDF.

## contact

- `header`: `h1` `Contact` and `p.post-lede` with `contact_intro`.
- `div.post-body` starts with a `<p>` with `contact_invitation`.
- `h2#elsewhere` `Elsewhere`, with `ul.post-links` of `contact_links`, or of `social_links` without `contact_links`, then `Résumé (PDF)` to `/resume/<file>.pdf`. Each link has `target="_blank" rel="noopener"`.
- The availability.
- The page has no form and no address, because [the profile](ref_profile-file.md) has no address.

## Dates and labels

- A month and a year show as `Dec 2022`, with a month of three letters. With the precision `year`, only the year shows.
- The period of a project is `start – end`. When the two ends show the same text, the text shows one time, for example `2026`.
- An `active` project without `ended` shows `start – now`. A completed project without `ended` shows only `start`.
- With `dates_approximate`, the period starts with `c. `.
- Without `started`, the period is `null`.
- `date_precision` applies to the two ends of the period of a project.
- A timeline period follows the same rules, with `start_precision` and `end_precision`, which are `month` when they are not in the entry. With `is_current`, the period ends with `– now`.
- A full date, for example of an update or a revision, shows as `29 September 2026`.

The fields of a project are in [the project file](ref_project-file.md).
