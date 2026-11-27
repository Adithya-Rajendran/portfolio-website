---
type: procedure
title: Count the parts of the rooms
depends: [docs/ref_review-pages.md, docs/ref_model-tools.md]
---
# Count the parts of the rooms

Use this procedure to make the data files of [the review pages](ref_review-pages.md) again from Blender builds of the rooms.
Do this procedure in a different checkout, because the Blender scripts save `.blend` files.

## Prerequisites

- `blender/run.sh` starts Blender 5.0.1.
- The environment has no `ASSET` variable.

## Procedure

1. Make a directory for the trace files.
   ```sh
   mkdir -p /path/to/traces
   ```
2. Record a trace for each of the five rooms that the tools count.
   ```sh
   for ROOM in lobby about projects experience writing; do
     blender/run.sh -b --python-exit-code 2 -P blender/audit_assets.py -- $ROOM /path/to/traces/$ROOM.json
   done
   ```
3. Write the builder matrix.
   ```sh
   python3 tools/asset-inventory.py /path/to/traces > docs/asset-placements.tsv
   ```
4. Write the parts inspector and the room totals.
   ```sh
   python3 tools/scene-parts.py /path/to/traces
   ```
5. Render the studio views of the families.
   ```sh
   python3 tools/review-models.py
   ```
6. Make the gallery and its WebP thumbnails.
   ```sh
   python3 tools/asset-catalogue.py
   ```

## Verification

- `docs/asset-placements.tsv` and `docs/scene-parts.tsv` have data for each of the five rooms.
- `/asset-catalogue/parts.html` shows the objects of each room, which include the objects outside a builder.

## Troubleshooting

- The `#` groups of names in the parts inspector are only a short form for the page. The gzip TSV files keep the full names and the paths of the builder instances.

## Additional resources

- [The model tools](ref_model-tools.md) render the builders alone and compare two builds of a room.
