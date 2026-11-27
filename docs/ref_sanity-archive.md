---
type: reference
title: The Sanity archive
depends: [docs/ref_sanity-conversion.md, docs/proc_refresh-export.md]
---
# The Sanity archive

This reference gives the contents of the archive in `data/` that comes from Sanity.

- The archive is a copy of the Sanity project `project-cinnabar-globe` (`ppk2h9tb`), dataset `production`, schema workspace `portfolio-blog`.
- `python3 tools/sanity-export.py` made the copy on 2026-11-22. You can run it again to make a new copy.
- `tools/site.py` does not read the archive. It reads the files that [the conversion](ref_sanity-conversion.md) made from it.
- Each JSON file is the Sanity document without a change (`_id`, `_type`, `_rev` and all fields), with indents.
- The archive does not include the system documents of Sanity: the groups, the retention and the deployed schema.

## Directories

| Path | Contents |
|---|---|
| `data/profile/profile.json` | The `profile` singleton: name, headline, introduction, timeline, credentials, skills, contact routes and links. |
| `data/posts/<slug>.json` | One `post` in each file (4): title, description, takeaways, Portable Text `body`, changelog and tags. |
| `data/projects/<slug>.json` | One `project` in each file (10): designation, title, summary, Portable Text `body`, role, technologies and links. |
| `data/assets/images/`, `data/assets/images.json` | 20 images and their Sanity asset documents: original file name, alt text, dimensions, palette and LQIP. |
| `data/assets/files/`, `data/assets/files.json` | 5 files, four PDFs and one YAML file, and their asset documents. |
| `data/assets/cdn-copies.json` | The images that are not the original bytes, with the original and the saved hashes and sizes. |

## References

| Reference | Target |
|---|---|
| `{"_ref": "<_id>"}` | The document with that `_id` in `posts/`, `projects/` or `profile/`. |
| `image-<sha1>-<w>x<h>-<ext>` | The file `assets/images/<sha1>-<w>x<h>.<ext>`. |
| `file-<sha1>-<ext>` | The file `assets/files/<sha1>.<ext>`. `assets/files.json` gives its original name. |
| `https://cdn.sanity.io/files/ppk2h9tb/production/<sha1>.<ext>` | The file in `assets/files/` with the last part of the URL as its name. Some Portable Text links have this form. |

## Files that are not in use

- The dataset has two PDFs and one image that no document refers to.
- The export downloads them, but `.gitignore` keeps the three files out of the repository.
- `assets/files.json` and `assets/images.json` also list them.

## The images as uploaded

- All files and 8 of the 20 images are the same bytes as the uploads. The export checks their SHA-1.
- Sanity gives the original bytes of an image only to a request with a token.
- Without a token, the image CDN of Sanity gives the other 12 images encoded again, at full resolution but with different bytes.
- `assets/cdn-copies.json` lists these 12 images. See [the procedure](proc_refresh-export.md) to replace them.
