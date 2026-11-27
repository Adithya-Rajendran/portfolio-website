---
type: concept
title: The modes of the page
depends: [docs/con_reading.md]
---
# The modes of the page

Each page of the site is in one of three modes.
A class on the `<html>` element tells the mode, and `src/styles/post.css` gives the styles for each mode.
A script of one line in the head of the shell sets the class.

| Class | When | What the page shows |
|---|---|---|
| None | JavaScript is off, the browser has no WebGL2, or the station failed to start. | `#page` as a standard page that scrolls, with `#pagenav`. Without WebGL2, the page also shows the notice `#nogl`. |
| `reading` | The address of an article, from the first paint. | The same page, while the Library loads under it. Then the page goes into the station, or it shows the offer `#stepin` if the visitor scrolled or the browser tells the page to save data. |
| `station` | All other addresses, and after the page goes into the station. | The 3D site. The page removes `#page` from view. |

An article page, `/blog/<slug>/` or `/portfolio/<slug>/`, starts in the `reading` mode.
The page of a room starts in the `station` mode.

In the station, the reader shows a post on the reader panel `#reader`.
The reader uses `article.post` from `#page`. If `#page` does not have the post, the reader loads `/blog/<slug>/` and uses `article.post` from that page.
See [the reader](con_reading.md) for how a thing opens.

The page generator does not write the files in `src/` or the shell.
