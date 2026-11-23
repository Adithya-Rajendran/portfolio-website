# data/ — portfolio content exported from Sanity

A copy of the Sanity project `project-cinnabar-globe` (`ppk2h9tb`), dataset `production`, schema workspace `portfolio-blog`.
Exported 2026-11-22 by `python3 tools/sanity-export.py`, which can be re-run to refresh it. The site does not read these files yet: what it shows is still in `public/content.json`.

| Folder | Contents |
| --- | --- |
| `profile/profile.json` | The `profile` singleton: name, headline, introduction, timeline, credentials, skills, contact routes, links. |
| `posts/<slug>.json` | One `post` per file (4): title, description, takeaways, Portable Text `body`, changelog, tags. |
| `projects/<slug>.json` | One `project` per file (10): designation, title, summary, Portable Text `body`, role, technologies, links. |
| `assets/images/`, `assets/images.json` | 20 uploaded images and their Sanity asset documents (original file name, alt text, dimensions, palette, LQIP). |
| `assets/files/`, `assets/files.json` | 5 uploaded files (four PDFs, one YAML) and their asset documents. |

Each JSON file is the Sanity document unchanged (`_id`, `_type`, `_rev` and all fields), indented. Sanity's system documents (groups, retention, deployed schema) are not included.

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
