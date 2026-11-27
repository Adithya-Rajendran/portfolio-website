---
type: reference
title: The rooms
depends: [docs/ref_room-pages.md, docs/ref_blog-pages.md, docs/ref_review-pages.md]
---
# The rooms

This reference gives the identifier, the path and the source of each room.

| Identifier | Path | Room | Blender script | Text of the page |
|---|---|---|---|---|
| `lobby` | `/` | Atrium | `blender/build_scene.py` | The page of the shell |
| `about` | `/about/` | Lounge | `blender/room_about.py` | [`/about/`](ref_room-pages.md#about) |
| `projects` | `/portfolio/` | Fabrication | `blender/room_projects.py` | [`/portfolio/`](ref_room-pages.md#portfolio) |
| `experience` | `/experience/` | Navigation | `blender/room_experience.py` | [`/experience/`](ref_room-pages.md#experience) |
| `writing` | `/blog/` | Library | `blender/room_writing.py` | [The list of posts](ref_blog-pages.md#the-list-page) |
| `comms` | `/contact/` | Comms | `blender/room_comms.py` | [`/contact/`](ref_room-pages.md#contact) |

- The path names a room. A query does not name a room.
- A move from one room to a different room does not load the page again.
- The identifier is the name of the directory of the room in `assets-src/` and in `public/assets/`.
- `blender/build_scene.py` also makes the kit that the other rooms share.
- [The review pages and the data files](ref_review-pages.md) give the parts and the models of each room.
