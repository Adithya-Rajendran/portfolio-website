---
type: reference
title: The head of a page
depends: []
---
# The head of a page

This reference gives the tags that the page generator writes in place of `<!--site:head-->` on each page.

## Tags

- `description`, the canonical link, and the Open Graph tags `og:type`, `og:site_name`, `og:title`, `og:description` and `og:url`.
- `og:image`, with its width, height and alt, when the page has an image.
- `twitter:card`: `summary_large_image` with an image, or `summary` without an image.
- `<link rel="alternate" type="application/rss+xml">`.
- One JSON-LD block `<script type="application/ld+json">`. Its `url` is the canonical URL.
- The titles have the form `<what> — <name>`.

## Values for each page

| Page | `<title>` (`og:title`) | description | `og:type` | JSON-LD |
|---|---|---|---|---|
| `/blog/<slug>/` | `<title> — <name>`, and `og:title` is the `<title>` of the post | `description` of the post | `article` | `BlogPosting` |
| `/blog/` | `Writing — <name>` | `writing_description` | `website` | `Blog`, with a `BlogPosting` for each post |
| `/about/` | `About — <name>` | `seo_description` | `profile` | `ProfilePage`. Its `mainEntity` is the `Person` (`@id` `<SITE>/#person`), with description, place, current work, `alumniOf` and `affiliation` (education that ended, and current), `knowsAbout` (skills), `hasCredential` and `sameAs` (social links). |
| `/portfolio/` | `Projects — <name>` | `projects_intro` | `website` | `CollectionPage` (`@id` `<SITE>/portfolio/`). Its `mainEntity` is an `ItemList` of `ListItem` (`position`, `url`, `name`) in the order of the page. |
| `/portfolio/<slug>/` | `<title> — <name>`, and `og:title` is `<title>` | `summary` | `website` | `CreativeWork`: `name`, `alternateName` (name), `description`, `genre` (types), `keywords` (technologies), `creator`, `isPartOf` the collection, `image` (cover) and `sameAs` (its `url` links). |
| `/experience/` | `Experience — <name>` | `work_summary` | `website` | `WebPage`, `about` the `Person` |
| `/contact/` | `Contact — <name>` | `contact_invitation` | `website` | `ContactPage`, `about` the `Person` with `sameAs`. It has no email, telephone or `contactPoint`. |

The cover of a project, as a WebP file, is also its `og:image`.
