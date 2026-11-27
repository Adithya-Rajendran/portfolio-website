---
type: reference
title: The addresses of the site
depends: [docs/ref_rooms.md, docs/ref_room-pages.md, docs/ref_endpoints.md]
---
# The addresses of the site

This reference gives the paths that the site serves and the paths of the first version of the site that go to a new place.

## Paths

| Path | Contents |
|---|---|
| `/` | The Atrium |
| `/about/`, `/portfolio/`, `/experience/`, `/contact/` | The other rooms. See [the rooms](ref_rooms.md). |
| `/portfolio/<slug>/` | Fabrication, with that project open. See [the pages of the rooms](ref_room-pages.md). |
| `/blog/` | The Library, with the list of posts in the page |
| `/blog/<slug>/` | The Library, with that post open. The HTML of the page contains the article. |
| `/blog/media/<name>`, `/blog/files/<name>` | The images and the files of the posts |
| `/media/<name>` | The images of the projects and of the profile |
| `/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/llms.txt` | The static endpoints. See [the endpoints](ref_endpoints.md). |
| `/resume/<file>.pdf` | The resume that the profile names |

## Rules

- A canonical path ends with `/`.
- The canonical origin is `content.SITE` in `tools/content.py`.
- An address with the query `?room=<id>` opens the Atrium, and the address does not change.

## Paths of the first version

`tools/site_extras.py` writes `public/_redirects`, because the file name of the resume comes from the data.

| First path | New path |
|---|---|
| `/blog/tags/*` | `/blog/` |
| `/resume` | `/resume/<file>.pdf` |
| `/resume/view` | `/resume/<file>.pdf` |
| `/resume/download` | `/resume/<file>.pdf` |

- `/about`, `/contact` and `/portfolio/*` are pages, so `_redirects` has no rule for them.
- The site does not serve `/studio`, `/api/contact`, `/openapi.json` and `/.well-known/api-catalog`.
