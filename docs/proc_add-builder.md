---
type: procedure
title: Add a shared builder
depends: [docs/con_room-kit.md, docs/ref_model-tools.md, docs/proc_asset-census.md]
---
# Add a shared builder

Use this procedure to add a builder to [the shared kit of the rooms](con_room-kit.md).

## Prerequisites

- You have the list of the rooms that use the builder.

## Procedure

1. Write the builder as a function in the form that [the shared kit](con_room-kit.md#how-a-builder-works) gives.
2. Add the builder to the dict of its module, for example `TECH` in `blender/assets_tech.py`.
3. Render the builder alone in its canonical studio with [the model tools](ref_model-tools.md).
   ```sh
   python3 tools/review-models.py <key>
   ```

## Verification

- `blender/out/model-review/<room>/` has two views of the builder.

## Troubleshooting

- In the Library, do not move `FX_screen0`, the catalogue screen, the dock, the slot or the delivery poses without the others.

## Next steps

- [Count the parts of the rooms](proc_asset-census.md) again.
