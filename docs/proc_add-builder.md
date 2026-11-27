---
type: procedure
title: Add a shared builder
depends: [docs/proc_asset-census.md]
---
# Add a shared builder

Use this procedure to add a builder to the shared kit of the rooms.

## Prerequisites

- You have the list of the rooms that use the builder.

## Procedure

1. Write the builder as a function with a Blender placement matrix `M` as its first argument.
2. Give the local dimensions and the direction where they change as arguments of the builder.
3. Use only the materials of the `MAT` and `EM` palette that the room supplies.
4. Keep the fixed positions, the wall labels and the pick data in the script of the room.
5. Add the builder to the dict of its module, for example `TECH` in `blender/assets_tech.py`.
6. Render the builder alone in its canonical studio.
   ```sh
   python3 tools/review-models.py <key>
   ```

## Verification

- `blender/out/model-review/<room>/` has two views of the builder.

## Troubleshooting

- A builder cannot run in a room that does not supply its palette.
- In the Library, do not move `FX_screen0`, the catalogue screen, the dock, the slot or the delivery poses without the others.

## Next steps

- [Count the parts of the rooms](proc_asset-census.md) again.
