---
type: reference
title: The scene file of a room
depends: []
---
# The scene file of a room

This reference gives the fields of `scene.json` that the reader and the texture loader use.

`tools/pack.py` writes this file with the other room files.

## focus

An entry of `focus` is a thing that the camera can come to, with the fields `c`, `r` and `dir`.

| Field | Contents |
|---|---|
| `boxes` | Not necessary. `[{ c: [x, y, z], size: [w, d, h], turn, reads? }]`, in the axes of Blender. |
| `boxes[].c` | The center of the box. |
| `boxes[].size` | The size along x, y and z. |
| `boxes[].turn` | The angle about the vertical, in radians. |
| `boxes[].reads` | `true` on the box where the light of the reader starts. |

- The room changes the axes (x, y, z) of Blender to (x, z, -y).
- When a focus has boxes, the source of its exhibit has `bodies`, and the `bounds()` of its pick are the corners of the boxes.
- In the Lounge, `focus[0]` has the two books on the table.

## Textures

| Field | Contents |
|---|---|
| `tex_layers` | The number of layers of each group of sky angles and orrery phases. |
| `tex_split` | `{ drop, cut }`: the textures that have a head file and a tail file, with the place of the cut of each texture. |
