---
type: reference
title: The model tools
depends: []
---
# The model tools

This reference gives the tools that render the builders alone and compare two builds of a room.

## Review of the builders

- `python3 tools/review-models.py --list` lists the canonical studios.
- `python3 tools/review-models.py telescope closed_book` renders only these families. Two views of each family go into `blender/out/model-review/`.

## Compare two builds

- The command `blender/run.sh -b --python-exit-code 2 -P blender/compare_rooms.py -- /before/ROOM.blend /after/ROOM.blend` compares two builds of a room.
- The two builds must use the same Blender version.
- The command compares the mesh positions, the polygons, the materials, the UVs and the tags.
- The command also compares the lamps, and the camera and pick data.
- The command compares the faces of the UV spheres outside the room without their order.
- Blender does not make the faces of a UV sphere in the same order each time.
