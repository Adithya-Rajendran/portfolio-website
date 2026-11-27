---
type: reference
title: The post file
depends: []
---
# The post file

This reference gives the format of a post, `data/posts/<slug>.md`.

## Front matter

The front matter is between two `---` lines, in a strict subset of YAML, so GitHub shows it as a table.

```yaml
---
title: "Quoted with JSON escapes when it holds a colon, a quote or a #"
description: "One or two sentences."
published: 2026-03-30
revised: 2026-10-25
tags: [homelab, infrastructure]
image: 5eeba53d…-1200x630.png
image_alt: "…"
takeaways:
  - "…"
changelog:
  - date: 2026-10-25
    kind: correction
    note: "…"
next: another-slug
next_reason: "…"
projects: [homelab]
---
```

| Field | Rule |
|---|---|
| `title`, `description`, `published`, `tags` | Necessary |
| `revised` | Not necessary. It is not before `published`. |
| `image`, `image_alt` | Not necessary. The social card: a file name in `data/assets/images/`, with no directory. |
| `takeaways` | Not necessary. The items can use inline Markdown. |
| `changelog` | Not necessary. The last entry by date is first. No entry is before `published`. `kind` is `update` or `correction`. |
| `next`, `next_reason` | Not necessary. The slug of the next post, and the reason to read it. |
| `projects` | Not necessary. Slugs of files in `data/projects/`. Each slug must have a file `data/projects/<slug>.md`. |

- Write a string value as a JSON string (`"…"`), except a date or one word that has the form of a slug.
- A field that is not in the table is an error.
- The parser checks the type of each field.
- The site copies `image` without a change, so it must be a PNG or a JPEG of 1200 × 630 px with no EXIF data.

## Body

The body uses only the Markdown in this table, which is CommonMark, so GitHub shows a preview of it.

`tools/testdata/posts/every-construct.md` uses each construct, and the tests of the renderer use it.

| Construct | Form |
|---|---|
| Headings | `## ` and `### `. The title is the only `h1` of the page. |
| Paragraph | Lines until an empty line. |
| Inline | `` `code` ``, `**strong**`, `*emphasis*`, `[text](url)`. A `\` escapes `` * _ \ ` [ ] ``. |
| Lists | `- ` and `1. `, with one nested level that has an indent of 4 spaces. |
| Quote | `> ` |
| Code | A fence of three backticks with a language: `bash`, `yaml`, `python` or `text`. The tool does not change the content. |
| Image | Alone in a paragraph: `![alt](../assets/images/<file> "caption")`. The caption is not necessary. It can use inline Markdown, and it escapes `"` as `\"`. |
| Link to a post | `/blog/<slug>/` |
| Link to a project | `/portfolio/<slug>/` |
| Link to a file | `../assets/files/<file>` |

HTML in a body is not Markdown: `<` is text, and the page escapes it.
