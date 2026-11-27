---
type: reference
title: The endpoints
depends: [docs/ref_blog-pages.md]
---
# The endpoints

This reference gives the static files that the site serves next to the pages.

`tools/site_extras.py` writes `feed.xml`, `sitemap.xml`, `llms.txt`, the résumé and `_redirects` when `tools/site.py` runs.

## Images and files of the projects and the profile

- The generator writes the cover and the body images of a project, the badge of a credential and the logo of an organization to `/media/<source name>.<8 hex>.webp`.
- These images follow the rules of [the images of a post](ref_blog-pages.md#images-and-files-of-a-post).
- The generator copies the files that a project or the profile links to `/blog/files/<original name>`.
- The résumé is `/resume/<file>.pdf`.

## Files

| File | Contents |
|---|---|
| `sitemap.xml` | The home page, `/blog/` and the posts, then `/about/`, `/portfolio/`, each project in the order of `/portfolio/`, `/experience/` and `/contact/`. The projects and the profile have no `<lastmod>`, because they record no date of change. |
| `llms.txt` | A section `## Projects`, with `projects_intro` and then `- [title](<SITE>/portfolio/<slug>/): summary` in the order of `/portfolio/`. A section `## Site` with the five pages. |
| `feed.xml` | The feed of the posts. |
| `_redirects` | Only the rules for `/blog/tags/*` and for the résumé. |
| `public/_headers` | Git keeps this file. See the cache rules below. |
| `public/robots.txt` | Git keeps this file. |

## Cache rules

| Paths | `Cache-Control` |
|---|---|
| `/assets/*` | `public, max-age=31536000, immutable` |
| `/assets/*/scene.json` | `no-cache`, in place of the rule of `/assets/*` |
| `/vendor/*` | `public, max-age=2592000` |
| `/blog/, /blog/:slug/, /blog/index.json, /portfolio/, /portfolio/:slug/, /portfolio/index.json, /about/, /experience/, /contact/, /profile.json, /resume/*` | `no-cache` |
| `/blog/media/*.webp`, `/media/*.webp` | `public, max-age=31536000, immutable` |
| `/feed.xml, /sitemap.xml, /llms.txt, /robots.txt` | `public, max-age=3600` |

- `public/_headers` gives these rules to Cloudflare.
- Cloudflare joins the values of all rules for a path, so each path has a maximum of one rule.
- A social card and a file of a post keep their original names, so Cloudflare gives them its default rule.
