# data/ — portfolio content exported from Sanity

A copy of the Sanity project `project-cinnabar-globe` (`ppk2h9tb`), dataset `production`, schema workspace `portfolio-blog`.
Exported 2026-11-22 by `python3 tools/sanity-export.py`, which can be re-run to refresh it. The Sanity documents below are an archive: `tools/site.py` reads only the hand-edited files made from them (`posts/<slug>.md`, `profile.json`; see "Posts are Markdown now" and "Projects and the profile are hand-edited now"). What the 3D rooms show is still `public/content.json`.

| Folder | Contents |
| --- | --- |
| `profile/profile.json` | The `profile` singleton: name, headline, introduction, timeline, credentials, skills, contact routes, links. |
| `posts/<slug>.json` | One `post` per file (4): title, description, takeaways, Portable Text `body`, changelog, tags. The Sanity archive: see "Posts are Markdown now". |
| `posts/<slug>.md` | The same post as Markdown (4): the source of the post from now on. |
| `projects/<slug>.json` | One `project` per file (10): designation, title, summary, Portable Text `body`, role, technologies, links. The Sanity archive. |
| `projects/<slug>.md` | The same project as Markdown (10): the source of the project from now on (`docs/v1-contracts.md` §6). |
| `profile.json` | The profile as a clean, hand-edited JSON file: the source of the profile from now on (§7). `profile/profile.json` is its archive. |
| `assets/images/`, `assets/images.json` | 20 uploaded images and their Sanity asset documents (original file name, alt text, dimensions, palette, LQIP). |
| `assets/files/`, `assets/files.json` | 5 uploaded files (four PDFs, one YAML) and their asset documents. |

Each JSON file is the Sanity document unchanged (`_id`, `_type`, `_rev` and all fields), indented. Sanity's system documents (groups, retention, deployed schema) are not included.

## Posts are Markdown now

`posts/<slug>.md` is the source of a post (format: `docs/v1-contracts.md` §2, read by `tools/content.py`). Edit it by hand. The `.json` beside it is the Sanity archive as exported; it is no longer edited and the site does not read it.

`python3 tools/sanity_to_md.py` made the `.md` files from the `.json` ones, and can be run again, for instance after a fresh export. It writes only the `.md` files that do not exist yet. For one that differs from what it would write (a hand edit) it says `DIFFERS`, leaves it alone and exits with status 1; `--force` replaces it with the conversion. It stops with an error, naming the post and the block, on anything it does not know (a block type, style, mark or list level).

`python3 -m unittest tools/test_sanity_to_md.py` compares each `.md` with its `.json` (words, code blocks, images, links, headings, lists, code and strong text, header fields) with a separate Markdown reader. After a post is edited on purpose, those tests report where it no longer matches the archive; that is expected.

## Projects and the profile are hand-edited now

`projects/<slug>.md` (format: `docs/v1-contracts.md` §6, read by `content.load_projects()`) and `profile.json` (§7, read by `content.load_profile()`) are the sources from now on. Edit them by hand. `projects/<slug>.json` and `profile/profile.json` are the Sanity archive as exported; nothing that builds the site reads them. `python3 tools/content.py` lists the posts and projects and says whether the profile is valid, or what is wrong with a file.

`python3 tools/sanity_to_md.py` makes all of them (posts, projects, profile) from the archive, with the rule of the posts: it writes only the files that do not exist yet; for one that differs from what it would write (a hand edit) it says `DIFFERS`, leaves it alone and exits with status 1; `--force` replaces it with the conversion. It stops with an error, naming the document and the field, on any field it does not know, in a project, in the profile or in any record inside them. Every field is carried into the new file, or is in the list below; each use of the list is printed as a `note`.

How a project document became a file:

| Sanity field | In `projects/<slug>.md` |
| --- | --- |
| `title`, `name`, `summary`, `status`, `statusNote`, `types`, `technologies`, `highlights`, `lessons`, `parameters`, `results` | the same, with `statusNote` as `status_note`; the records of `parameters` (`label`, `value`) and `results` (`metric`, `value`, `note`) as block lists |
| `designation` | `order` (only an ordering number) |
| `myRole` | `role` |
| `startDate`, `endDate`, `datePrecision`, `datesApproximate` | `started`, `ended`, `date_precision`, `dates_approximate` |
| `featured`, `quiet` | the same |
| `next` (a list of next steps, not a reference) | `next_steps` |
| `brief` `{problem, approach, outcome}` | three flat fields `problem`, `approach`, `outcome` |
| `cover` `{asset, alt, caption}` | `cover` (a file name in `assets/images/`), `cover_alt`, `cover_caption` |
| `links` `{label, kind, url}` | block list: `label`, `kind` and one of `url`, `post`, `project`, `file`. A link to `https://adithya-rajendran.com/blog/<slug>` is `post: <slug>`, to `/portfolio/<slug>` is `project: <slug>`, to a Sanity CDN file (`https://cdn.sanity.io/files/…/<name>`) is `file: <name>` |
| `body` (Portable Text) | the Markdown body, as for a post (§2); links to this site's posts and projects, and to CDN files, in the forms of §2 |
| `slug` | the file name |

Deliberately not carried, and why:

| Dropped | Why |
| --- | --- |
| `model` (homelab only: a 3D viewer's hotspots, poster and real-world size) | The new site has no 3D viewer for it. The poster image stays in `assets/images/` (a post uses it) |
| `_id` | Only a target for `_ref` references, which are slugs now |
| `_type`, `_rev`, `_createdAt`, `_updatedAt`, `_system` | Sanity's own bookkeeping |
| `_key`, `_type` inside records (links, parameters, results, cover) | The same |
| `brief: null`, and empty or absent lists (`lessons`, `next`, `parameters`, ...) | There is nothing in them; a file without the field says the same |

How the profile became `profile.json`: field names are the camelCase names in `snake_case` (`workSummary` → `work_summary`, `startDate` → `start_date`), in a readable order. The changes of structure:

- References `{"_ref": "<_id>"}` to a post or project (`featuredPost`, a curiosity's or paper's `project`) are the slug. An image `{asset, alt}` is a file name (`badge`, `logo`) and its alt text (`badge_alt`, `logo_alt`); `resume` is a file name in `assets/files/`; a paper's link to a CDN file is `file: <name>`.
- `availability.seeking` is a list of the openings' `label`s, since a record of only a label is that label.
- Every timeline entry has a new `id`, made from the organization's short name and the start year (`canonical-2024`), unique and kept as it is when the entry is edited.
- `curiositiesUpdatedAt` is a date (`2026-10-26`).

Deliberately not carried from the profile: `_id`, `_type`, `_rev`, `_createdAt`, `_updatedAt`, `_system` and the `_key`, `_type` and `_weak` of records (Sanity's bookkeeping; the document's own `_createdAt` and `_updatedAt` are in the archive), and the time of day of `curiositiesUpdatedAt` (`01:47:15.863282+00:00`; the page shows a date).

`python3 -m unittest tools/test_sanity_to_md.py` also checks these two, without the converter's code. For projects: every body (block by block, then every word, link, heading and list), every highlight, lesson, next step, link, parameter and result and each header field is compared with the `.json`. For the profile: every leaf string, number and boolean of the Sanity document is found in the new file (and none is invented), field by field and record by record, and a number stays a number. The tests then break the files in many ways in memory and require that the comparison notices each.

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
