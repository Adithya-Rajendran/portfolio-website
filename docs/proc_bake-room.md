---
type: procedure
title: Bake a room
depends: [docs/ref_bake-runners.md, docs/ref_room-files.md]
---
# Bake a room

Use this procedure to make, bake and pack one room on a Linux machine with Blender 5.0.1.
The example is the Lounge, `about`.

## Prerequisites

- `blender/run.sh` starts Blender 5.0.1 from `~/.local/opt/blender-official/`.
- The machine has an NVIDIA GPU.

## Procedure

1. Set the Cycles device to `CUDA` or `OPTIX`.
   ```sh
   export LOBBY_DEVICE=OPTIX
   ```
2. Make the Blender scene of the room.
   ```sh
   blender/run.sh -b --python-exit-code 2 -P blender/room_about.py
   ```
3. Render the reflection probe.
   ```sh
   blender/run.sh -b blender/about.blend --python-exit-code 2 -P blender/reflection_probe.py
   ```
4. Render the backdrop of the window, only for a room with a window.
   ```sh
   blender/run.sh -b blender/about.blend --python-exit-code 2 -P blender/backdrop.py -- 4096
   ```
5. Bake the light of the room.
   ```sh
   blender/run.sh -b blender/about.blend --python-exit-code 2 -P blender/bake.py -- 1.0 192
   ```
6. Pack the room.
   ```sh
   python3 tools/pack.py about
   ```

## Verification

- `tools/pack.py` writes [the room files](ref_room-files.md) of the room, and it shows no error.

## Troubleshooting

- If `tools/pack.py` refuses the room because of faces that overlap, run `python3 tools/geomcheck.py about` to list them.
- Do not replace the two hologram PNG files of the Atrium that Git keeps. This applies when you copy bake files from a different machine.

## Additional resources

- [The bake runners](ref_bake-runners.md) run the same phases on the Windows bake machine and on an ARM64 GPU machine.
