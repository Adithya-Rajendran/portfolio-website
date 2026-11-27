---
type: reference
title: The conversion from Sanity
depends: [docs/ref_post-file.md, docs/ref_project-file.md, docs/ref_profile-file.md]
---
# The conversion from Sanity

This reference tells how `tools/sanity_to_md.py` changes the Sanity documents into the files of the site.

| Source | Result |
|---|---|
| `data/posts/<slug>.json` | `data/posts/<slug>.md`, in the format of [the post file](ref_post-file.md) |
| `data/projects/<slug>.json` | `data/projects/<slug>.md`, in the format of [the project file](ref_project-file.md) |
| `data/profile/profile.json` | `data/profile.json`, in the format of [the profile file](ref_profile-file.md) |

## Rules of the tool

- The tool writes only the files that do not exist.
- When a file is different from the result of the conversion, for example after a change by hand, the tool shows `DIFFERS`. It keeps the file and stops with the exit code 1.
- `--force` replaces the file with the result of the conversion.
- The tool stops with an error on a value that it cannot convert. This is a block type, a style, a mark or a list level in a post. It is also a field in a project, in the profile or in their records. The error names the document and the block or the field.
- The tool copies each field into the new file, or the field is in the lists of fields that it drops. The tool shows a `note` for each use of these lists.

## Fields of a project

| Sanity field | Field in `projects/<slug>.md` |
|---|---|
| `title, name, summary, status, types, technologies, highlights, lessons, parameters, results` | The project fields keep the same names. The records of `parameters` (`label`, `value`) and of `results` (`metric`, `value`, `note`) are block lists. |
| `statusNote` | `status_note` |
| `designation` | `order`, which is only a number for the order |
| `myRole` | `role` |
| `startDate`, `endDate`, `datePrecision`, `datesApproximate` | `started`, `ended`, `date_precision`, `dates_approximate` |
| `featured`, `quiet` | The same names |
| `next`, a list of next steps and not a reference | `next_steps` |
| `brief` `{problem, approach, outcome}` | The three flat fields `problem`, `approach` and `outcome` |
| `cover` `{asset, alt, caption}` | `cover`, a file name in `assets/images/`, with `cover_alt` and `cover_caption` |
| `links` `{label, kind, url}` | A block list of `label`, `kind` and one of `url`, `post`, `project` or `file` |
| `body`, in Portable Text | The Markdown body, as for a post |
| `slug` | The file name |

A link changes as this list shows:

- A link to `<SITE>/blog/<slug>` changes to `post: <slug>`.
- A link to `/portfolio/<slug>` changes to `project: <slug>`.
- A link to a file on the Sanity CDN, `https://cdn.sanity.io/files/…/<name>`, changes to `file: <name>`.
- In a body, the links to the posts, to the projects and to the files on the CDN have the forms of the post body.

## Fields that the tool drops from a project

| Field | Reason |
|---|---|
| `model` | Only the homelab project has it: the hotspots, the poster and the size in the world for a 3D viewer. The site has no 3D viewer for it. The poster image is in `assets/images/`, because a post uses it. |
| `_id` | It is only a target for `_ref` references, which are slugs in the new files. |
| `_type`, `_rev`, `_createdAt`, `_updatedAt`, `_system` | The system fields of each Sanity document. |
| `_key` and `_type` inside records (links, parameters, results, cover) | The system fields of the records in a Sanity document. |
| `brief: null`, and empty lists or lists that are not there (`lessons`, `next`, `parameters`) | They contain no data. A file without the field has the same meaning. |

## Fields of the profile

- The names change from `camelCase` to `snake_case`, for example `workSummary` to `work_summary` and `startDate` to `start_date`, in an order that is easy to read.
- A reference `{"_ref": "<_id>"}` to a post or a project (`featuredPost`, the `project` of a curiosity or of a paper) changes to the slug.
- An image `{asset, alt}` changes to a file name (`badge`, `logo`) and its alt text (`badge_alt`, `logo_alt`).
- `resume` is a file name in `assets/files/`. The link of a paper to a file on the CDN changes to `file: <name>`.
- `availability.seeking` is a list of the `label` values of the openings, because a record with only a label is the same as that label.
- Each timeline entry has a new `id`, from the short name of the organization and the start year, for example `canonical-2024`.
- `curiositiesUpdatedAt` changes to a date, for example `2026-10-26`.

## Fields that the tool drops from the profile

| Field | Reason |
|---|---|
| `_id, _type, _rev, _createdAt, _updatedAt, _system` | The system fields of each document in the archive. The archive keeps `_createdAt` and `_updatedAt` of the document. |
| `_key`, `_type` and `_weak` of records | The system fields of the records in a document of the archive. |
| The time of day of `curiositiesUpdatedAt` (`01:47:15.863282+00:00`) | The page shows only a date. |

## Tests of the conversion

`python3 -m unittest tools/test_sanity_to_md.py` compares the new files with the archive, without the code of the tool.

- For a post, the test compares the words, the code blocks, the images, the links, the headings and the lists. It also compares the code, the strong text and the fields of the front matter. It uses a different Markdown parser.
- For a project, the test compares each body block by block, then each word, link, heading and list. Then it compares each highlight, lesson, next step, link, parameter, result and field.
- For the profile, the test finds each string, number and boolean of the Sanity document in the new file. It does this field by field and record by record. It also makes sure that the new file adds no value, and that each number is a number in the two files.
- Then the test breaks the files in many ways in memory, and makes sure that the test finds each change.
- After you change a post on purpose, the test shows where the post is different from the archive. This result is correct.
