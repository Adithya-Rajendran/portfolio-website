# data/ — portfolio content exported from Sanity

A copy of the Sanity project `project-cinnabar-globe` (`ppk2h9tb`), dataset `production`, schema workspace `portfolio-blog`.
Exported 2026-11-22 by `python3 tools/sanity-export.py`, which can be re-run to refresh it. The site does not read these files yet: what it shows is still in `public/content.json`.

| Folder | Contents |
| --- | --- |
| `profile/profile.json` | The `profile` singleton: name, headline, introduction, timeline, credentials, skills, contact routes, links. |
| `posts/<slug>.json` | One `post` per file (4): title, description, takeaways, Portable Text `body`, changelog, tags. The Sanity archive: see "Posts are Markdown now". |
| `posts/<slug>.md` | The same post as Markdown (4): the source of the post from now on. |
| `projects/<slug>.json` | One `project` per file (10): designation, title, summary, Portable Text `body`, role, technologies, links. |
| `assets/images/`, `assets/images.json` | 20 uploaded images and their Sanity asset documents (original file name, alt text, dimensions, palette, LQIP). |
| `assets/files/`, `assets/files.json` | 5 uploaded files (four PDFs, one YAML) and their asset documents. |

Each JSON file is the Sanity document unchanged (`_id`, `_type`, `_rev` and all fields), indented. Sanity's system documents (groups, retention, deployed schema) are not included.

## Posts are Markdown now

`posts/<slug>.md` is the source of a post (format: `docs/v1-contracts.md` §2, read by `tools/content.py`). Edit it by hand. The `.json` beside it is the Sanity archive as exported; it is no longer edited and the site does not read it.

`python3 tools/sanity_to_md.py` made the `.md` files from the `.json` ones, and can be run again, for instance after a fresh export. It writes only the `.md` files that do not exist yet. For one that differs from what it would write (a hand edit) it says `DIFFERS`, leaves it alone and exits with status 1; `--force` replaces it with the conversion. It stops with an error, naming the post and the block, on anything it does not know (a block type, style, mark or list level).

`python3 -m unittest tools/test_sanity_to_md.py` compares each `.md` with its `.json` (words, code blocks, images, links, headings, lists, code and strong text, header fields) with a separate Markdown reader. After a post is edited on purpose, those tests report where it no longer matches the archive; that is expected.

## Following references

- A document reference `{"_ref": "<_id>"}` points to the document with that `_id` in `posts/`, `projects/` or `profile/`.
- An image reference `image-<sha1>-<w>x<h>-<ext>` is the file `assets/images/<sha1>-<w>x<h>.<ext>`.
- A file reference `file-<sha1>-<ext>` is the file `assets/files/<sha1>.<ext>`. `assets/files.json` gives each one's original name (for example the CV PDFs).
- Some Portable Text links point at the Sanity CDN (`https://cdn.sanity.io/files/ppk2h9tb/production/<sha1>.<ext>`). The same file is in `assets/files/` under the URL's last segment.

Not every asset is used. Two PDFs (`Adithya-Rajendran-CV-2026-10-25.pdf`, `Adithya-Rajendran-Resume.pdf`) and one image (`detection-f6_gallery.png`) are in the dataset but nothing refers to them. The export downloads them, but `.gitignore` keeps those three files out of the repository; they are still listed in `assets/files.json` and `assets/images.json`.

## Image originals

Every file and 8 of the 20 images are byte-for-byte the uploads (SHA-1 checked). Sanity gives original image bytes only to an authenticated request. Without a token, its image CDN served the other 12 re-encoded, at full resolution but with different bytes. `assets/cdn-copies.json` lists them, with the original and saved hashes and sizes. To replace them with the originals, create a Viewer token for the project (manage.sanity.io → API → Tokens) and run:

```sh
SANITY_TOKEN=<token> python3 tools/sanity-export.py
```

The run checks each original against its SHA-1 and deletes `cdn-copies.json` once none are left.
