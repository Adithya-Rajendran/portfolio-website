---
type: reference
title: The project file
depends: [docs/ref_post-file.md]
---
# The project file

This reference gives the format of a project, `data/projects/<slug>.md`.

The slug is the file name, in lower case words with hyphens between them.

The file has front matter between two `---` lines and a body, as in [the post file](ref_post-file.md).

```yaml
---
title: "Evaluating detectors on driving scenes"
name: "Driving detection study"
summary: "One or two sentences."
order: 5
status: completed
types: [research, software]
started: 2026-01-01
ended: 2026-02-01
date_precision: year
cover: 24224f39…-2160x1440.png
cover_alt: "…"
problem: "…"
approach: "…"
highlights:
  - "…"
parameters:
  - label: "KITTI validation frames"
    value: "3,769"
links:
  - label: "Read report (PDF)"
    kind: paper
    file: "fc41d42d….pdf"
---
## What I changed
…
```

## Front matter

- A string has the same form as a string in a post.
- Write a list as `[a, b]`, as `["a b", "c"]`, or as `key:` with `  - ` lines under it.
- Write a record as a `  - key: value` line with `    key: value` lines under it.
- Write numbers, `true` and `false` without quotes.
- The parser refuses a project with a field that the table does not give, and it checks the types of all fields.
- Each string is one line, is not empty, and has no space at its start or at its end.
- `load_projects()` returns `None` for a field that is not in the file, and `[]` for a list that is not in the file.

| Field | Type | Rule | Meaning |
|---|---|---|---|
| `title` | string | Necessary | The long title, in the `h1` of the page. |
| `name` | string | Necessary | The short name, for lists and labels. |
| `summary` | string | Necessary | One or two sentences. |
| `order` | integer, 1 or more | Necessary. No two projects have the same value. | The position in lists, from low to high. The page does not show it, and it is not an identifier. |
| `status` | `active` or `completed` | Necessary | The status of the work. |
| `status_note` | string | Not necessary | The state of the work, for a visitor. |
| `types` | list of `software`, `infrastructure`, `research`, `hardware` | Necessary, not empty | The types of work. |
| `technologies` | list of strings | Not necessary | The tools and the languages of the work. |
| `role` | string | Not necessary | The part of the owner in the work. |
| `started` | date, for example `2026-01-01` | Not necessary | A date. |
| `ended` | date | Not necessary | Only with `started`. It is not before `started`, and it is not in the file when `status` is `active`. |
| `date_precision` | `year` or `month` | Necessary with `started`, not possible without it | The part of `started` and `ended` that the page shows. A project that started in 2022 has `2022-01-01` with the precision `year`. |
| `dates_approximate` | `true` or `false` | Not necessary, only with `started` | The dates are approximate. |
| `featured` | integer, 1 or more | Not necessary. No two projects have the same value. | The rank of a featured project. The page shows 1 first. |
| `quiet` | `true` or `false` | Not necessary | A small project, which the page shows with less weight. `None` and `false` have the same meaning. |
| `cover` | file name | Not necessary | An image in `data/assets/images/`, in any format. |
| `cover_alt` | string | Not necessary, only with `cover` | The alt text. Without it, the image is decorative (`alt=""`). |
| `cover_caption` | string | Not necessary, only with `cover` | The caption of the cover. |
| `problem`, `approach`, `outcome` | string | Not necessary | The brief. `problem` and `approach` are together. `outcome` can be present only with them. |
| `highlights`, `lessons`, `next_steps` | list of strings | Not necessary | Sentences. The items can use the inline Markdown of a post. |
| `parameters` | list of records `label`, `value` | Not necessary | Facts for a table, in order. The two strings are necessary. |
| `results` | list of records `metric`, `value`, `note` | Not necessary | The measured results. `metric` and `value` are necessary. `note` is `None` when it is not in the file. |
| `links` | list of records | Not necessary | See the links below. |

Each string that is not in the three lists of sentences is plain text, and the page shows it as it is, with `*` and `_`.

## Links

A link has `label` and `kind`, which are necessary, and one field from this table.

`kind` is `article`, `repo`, `paper`, `dataset` or `other`.

| Field | Value | Check |
|---|---|---|
| `url` | An `http:` or `https:` address, with no other scheme: no `mailto:`, no `javascript:` and no path. | The scheme and the host name |
| `post` | The slug of a post | `data/posts/<slug>.md` exists. |
| `project` | The slug of a project | The file of that project exists. |
| `file` | A file name | The file exists in `data/assets/files/`. The value is a file name, not a link. |

- `load_projects()` returns each link as a dict with the six keys `label`, `kind`, `url`, `post`, `project` and `file`. The three keys that the link does not use are `None`.
- A link to a page of the site is a `post` or a `project`, not an address, so the link is correct also when an address changes.

## Checks

- `ended` is not before `started`, and a project with `status: active` has no `ended`.
- No two projects have the same `order` or the same `featured`.
- Each `cover`, `file`, `post` and `project` exists.
- In the body, each `/blog/<slug>/` names a post, each `/portfolio/<slug>/` names a project, and each `../assets/files/<file>` and `../assets/images/<file>` names a file. The check does not examine code fences.
- A mistake is a `ContentError` that names the file and the field, for example `` data/projects/homelab.md: `links[1].post`: there is no data/posts/x.md ``.

## Body

The body uses only the Markdown of a post.

The body is the text of the page under the `h1`, and it can be empty.

## Return value

`load_projects()` returns a list in the sequence of `order`.

- Each project is a dict of all fields of the front matter, with their types. `order` and `featured` are int, and `quiet` and `dates_approximate` are bool. The dates are `YYYY-MM-DD` strings, and the records are dicts with all their keys.
- Each project also has `slug`, `body` (the Markdown) and `words` (the words of the body, counted as for a post).
