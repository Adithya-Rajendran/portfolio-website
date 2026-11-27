---
type: reference
title: The profile file
depends: [docs/ref_project-file.md]
---
# The profile file

This reference gives the format of the profile, `data/profile.json`.

## The file

- The profile is one JSON file, because it has nested lists of records, which front matter cannot hold.
- `content.load_profile()` returns a dict with all fields of the tables. A field that is not in the file is `None`, and a list that is not in the file is `[]`.
- The names are `snake_case`. The dates are `YYYY-MM-DD` strings. Integers and booleans are JSON numbers and booleans.
- The file has no Sanity keys (`_key`, `_type`), no duplicate keys and no `NaN`.
- All text is plain text, and the page shows it as it is, with no Markdown.
- A string is not empty and has no space at its start or at its end. A string is one line, except `bio`, which has paragraphs with one empty line between them (`"\n\n"` in JSON).
- A file name has no directory, and the file exists. An `image` name is in `data/assets/images/`, and a `file` name is in `data/assets/files/`.
- A `post` or a `project` is the slug of a file `data/posts/<slug>.md` or `data/projects/<slug>.md` that exists.
- Each URL is `http` or `https`.
- A mistake is a `ContentError` that names the field, for example `` data/profile.json: `timeline[1].end_date`: must be a date like 2026-03-30 ``.

## Fields

| Field | Type | Rule |
|---|---|---|
| `name, headline, tagline, introduction, work_summary, location, seo_description, writing_description, projects_intro, contact_intro, contact_invitation` | string | Necessary text fields. `writing_description` is the lede of the list of posts. |
| `bio` | string with paragraphs | Necessary |
| `focus_areas` | list of strings | Not necessary |
| `featured_post` | slug of a post | Not necessary |
| `resume` | file name of a PDF | Not necessary. The page generator writes `/resume/<file>.pdf` from it. |
| `availability` | record | Necessary. See below. |
| `contact_routes` | record: route id to `{title, prompt}`, with two necessary strings | Necessary, not empty. The profile keeps it, but `/contact/` does not show it. |
| `credentials` | list of records | Not necessary. See below. |
| `skill_groups` | list of `{title, skills}`, where `skills` is a list of strings | Necessary. The two lists are not empty. |
| `social_links` | list of `{label, url}` | Necessary, not empty |
| `contact_links` | list of strings that name `social_links[].label` entries | Not necessary. Not empty, with no duplicates. The first is the way to write to the owner. Without it, the pages use `social_links`. |
| `current_curiosities` | list of records: `title` (necessary string), `note` (string), `project` (slug of a project) | Not necessary |
| `curiosities_updated_at` | date | Not necessary |
| `talks_and_papers` | list of records | Not necessary. See below. |
| `timeline` | list of records | Necessary, not empty. See below. |

## Availability

- `status`, a lower case word, for example `open`, and `cta`, a string, are necessary.
- `seeking`, a list of strings, and `updated_at`, a date, are not necessary.

## Credentials

- `title` and `issuer`, strings, and `issued_on`, a date, are necessary.
- `expires_on` is a date that is not necessary. It is not before `issued_on`.
- `lifetime` is a boolean that is not necessary. With `true`, there is no `expires_on`.
- `verification_url` is a URL that is not necessary.
- `badge`, an image file name, and `badge_alt` are not necessary. `badge_alt` can be present only with `badge`.

## Talks and papers

- `title`, `kind` and `date` are necessary. `kind` is a word, for example `report`.
- `authors`, `venue` and `abstract` are strings that are not necessary.
- `project` is the slug of a project, and it is not necessary.
- `links` is not necessary. A link is `{label, kind, url | post | project | file}`, with the rules of [a project link](ref_project-file.md#links).

## Timeline

The entry with the last `start_date` is first.

| Field | Type | Rule |
|---|---|---|
| `id` | HTML id: lower case letters, digits and hyphens, with a letter first | Necessary. No two entries have the same id. It is the address of the entry for links, for example `#sjsu-2026`. It comes from the short name of the organization and the start year, and it does not change when the entry changes. |
| `kind` | `work` or `education` | Necessary |
| `organization`, `org_short`, `title` | string | Necessary |
| `employment` | string, for example `full-time` or `internship` | Not necessary |
| `location`, `summary` | string | Not necessary |
| `start_date` | date | Necessary |
| `end_date` | date, not before `start_date` | Not necessary. Not in the entry when `is_current` is `true`. |
| `start_precision`, `end_precision` | `year` or `month` | Not necessary. Each can be present only with its date. The part of the date that the page shows. |
| `expected_end_year` | integer, a year | Not necessary. Not before the year of `start_date`. |
| `is_current` | boolean | Not necessary |
| `highlights` | list of strings | Not necessary |
| `logo`, `logo_alt` | image file name, alt text | Not necessary. `logo_alt` can be present only with `logo`. Without `logo_alt`, the logo is decorative. |
