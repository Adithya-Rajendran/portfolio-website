---
type: concept
title: The content sources
depends: [docs/ref_post-file.md, docs/ref_project-file.md, docs/ref_profile-file.md, docs/ref_sanity-archive.md, docs/ref_content-json.md]
---
# The content sources

The content of the site comes from two places.
The posts, the projects and the profile are in `data/`.
The words of the 3D rooms are in [the content file of the rooms](ref_content-json.md), `public/content.json`.

## The files that you change

| File | Contents | Format |
|---|---|---|
| `data/posts/<slug>.md` | One post | [The post file](ref_post-file.md) |
| `data/projects/<slug>.md` | One project | [The project file](ref_project-file.md) |
| `data/profile.json` | The profile | [The profile file](ref_profile-file.md) |
| `data/assets/images/` | The images that the posts, the projects and the profile use | The file name is `<sha1>-<w>x<h>.<ext>`. |
| `data/assets/files/` | The files that the posts, the projects and the profile use | The file name is `<sha1>.<ext>`. `data/assets/files.json` gives the original name of each file. |

## How the tools read the content

`tools/content.py` is the only parser of the content files, so the format has one definition.
Its functions are `load_posts()`, `load_projects()` and `load_profile()`, and its constants are `SITE` and `DATA`.
The file name of a post or a project is its slug.
A mistake in a file is a `ContentError` that names the file and the field.
`python3 tools/content.py` lists the posts and the projects, and tells if the profile is correct, or what is incorrect in a file.

## The archive

The files `data/posts/<slug>.json`, `data/projects/<slug>.json` and `data/profile/profile.json` are an archive from Sanity.
See [the Sanity archive](ref_sanity-archive.md).
