---
title: "Every construct: a post that uses all of the Markdown the site accepts"
description: "A fixture for the renderer's tests. It has a colon: here, \"quotes\", an <angle> and an & ampersand, which must all arrive intact."
published: 2026-01-15
revised: 2026-02-01
tags: [fixtures, markdown]
image: 5eeba53d61f7407b70834e8c7526f2a7d8b960a1-1200x630.png
image_alt: "A card with the post's title."
takeaways:
  - "The first takeaway, with `code` in it."
  - "The second: it has a colon and a [link](https://example.org/a?b=1&c=2)."
changelog:
  - date: 2026-02-01
    kind: correction
    note: "Corrected a figure in the second section."
  - date: 2026-01-20
    kind: update
    note: "Added the section on lists."
next: every-construct
next_reason: "It is the only fixture, so it points at itself."
projects: [homelab]
---
An opening paragraph with `inline code`, **strong text**, *emphasis*, an [external link](https://example.org/path?x=1&y=2#frag) and an [internal link](/blog/every-construct/). Characters that HTML cares about, < > & " ', must be escaped; a literal \* and \_ and \` stay as typed.

A second paragraph
that is wrapped over two lines in the source and is still one paragraph.

## Lists

- A bullet.
- A bullet with `code` and a [link](/portfolio/homelab/).
    - A nested bullet.
    - Another nested bullet.
- A last bullet.

1. First step.
2. Second step.
    1. A nested step.
3. Third step.

### A third-level heading with `code` in it

> A quotation, with *emphasis*.

## Code

```bash
# a comment with <angle brackets> & an ampersand
sudo sysctl -w vm.min_free_kbytes=1048576   # trailing spaces and tabs	stay
echo "a line with **stars** and _underscores_ that are not Markdown"
```

```text
NVRM: GPU0 nvCheckOkFailedNoLog: Check failed: Out of memory [NV_ERR_NO_MEMORY]

a blank line above is part of the block
```

```yaml
devices:
  x11:
    type: proxy
```

## Lists

A second heading with the same text as an earlier one: its id must differ.

![A server rack with three small computers.](../assets/images/05754647a9226f0938def18645edaef5169c8aec-3000x4000.jpg "Inside the rack. The caption has \"quotes\" and a [link](https://example.org).")

![An image with no caption.](../assets/images/5eeba53d61f7407b70834e8c7526f2a7d8b960a1-1200x630.png)

A [file link](../assets/files/8b46b93f83223a11d762796f2775bb697b0a94ce.yaml) to something kept in data/assets/files, and a link that must be refused: [bad](javascript:alert(1)).
