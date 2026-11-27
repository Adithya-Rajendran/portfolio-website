---
type: concept
title: The shared kit of the rooms
depends: [docs/ref_review-pages.md, docs/proc_add-builder.md]
---
# The shared kit of the rooms

The Blender scripts of the rooms share builders for the things that more than one room has.
A builder is a Python function that makes one family of objects.
Shared furniture has one definition in Python, but each room bakes it into the lightmap atlas of that room.
The kit does not make instances at run time, and it does not decrease the downloads.

## Builders that the rooms share

| Builder | Source | Rooms |
|---|---|---|
| `pressure_door()` | `blender/build_scene.py` | All rooms. Each room can change the surround and the signs, but it keeps the dimensions, the gaskets, the hardware and the pick target of the door. |
| `a_bay, a_ladder, a_armchair, a_stack, a_openbook, a_closed_book, a_shelf_volume, a_bookend` | `blender/assets_reading.py` | The parts for books in the Lounge and the Library, which do not read code from the scripts of each other. |
| Pylons | `blender/assets_tech.py` | The Atrium and Navigation |
| `a_stanchion` and `a_floorhatch` | `blender/assets_tech.py` | The Atrium and Fabrication |
| `a_grille` and the extinguishers | `blender/assets_tech.py` | Navigation and Fabrication |
| `boxed_cushion()` | `blender/build_scene.py` | The seat and the back of each wing chair, and the seat pads of the sofa in the Lounge. The placement changes the dimensions, the direction and the material. |
| The other `a_*` builders | `blender/assets_projection.py`, `blender/assets_lounge.py`, `blender/assets_exhibits.py` | One room each. A studio can render them alone. |

- `blender/surface_finishes.py` holds the shared material recipes. They change the Blender bakes, but not the book or the drone that three.js moves.
- The Atrium, the Lounge and the Library share the scene of Earth outside and the system of the rolling sky.
- All rooms use the systems of the wall screens and of the floor reflection.
- A call to `a_shelf_volume` makes one upright book and zero or two gilt bands. It does not make a new book design.
- A stanchion call makes a belt with two posts. `posts=` tells which of the posts it makes: 0 at the start, and the length of the belt at the end. Two belts at the same point can then share one post.

## How a builder works

- The first argument of each builder is a Blender placement matrix `M`.
- Before the room loads the module, it supplies its `MAT` and `EM` palette. For example, the kit of the Lounge and the Library uses `BOOKS` and the keys of its materials. `map_table` uses `EM_core` of Navigation.
- A builder uses only local dimensions. The script of the room keeps the fixed positions of the room, the labels on the walls and the data of the picks.
- The canonical studio of a builder is the set of materials that the builder can use.
- `blender/build_scene.py`, `room_about.py`, `room_writing.py` and `room_comms.py` set `PEOPLE = False`, so these scripts place no models of persons.
- The six route stops are in `public/js/routemap.js`, not in the mesh of the table.

[The review pages](ref_review-pages.md) show the builders, their studios and where the rooms use them.
See [the procedure](proc_add-builder.md) to add a builder.
