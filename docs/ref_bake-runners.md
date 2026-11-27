---
type: reference
title: The bake runners
depends: []
---
# The bake runners

This reference gives the scripts that run the Blender phases on the bake machines.

## Phases

| Phase | Script | Arguments in `live.sh` |
|---|---|---|
| `build` | `build_scene.py` for `lobby`, or `room_<room>.py` | None |
| `backdrop` | `backdrop.py`, only for the rooms with a window | `4096` |
| `probe` | `reflection_probe.py` | None |
| `draft` | `bake.py` | `0.25 24` |
| `bake` | `bake.py` | `1.0 192` |
| `review` | `preview.py` | `/job/blender/out/review_<room>.png 24 1280` |
| `geom` | `bake.py`, with `LOBBY_PASSES=none` | `0.05 1` |

The rooms with a window are `lobby`, `about`, `writing` and `comms`.

## ARM64 GPU machine

| Script | Use |
|---|---|
| `blender/remote/arm64/Dockerfile` | Makes the image `blender-arm:5.0.1` with Blender for ARM64. |
| `blender/remote/arm64/live.sh <phase> <room>` | Runs one phase for one room in Docker with OptiX, from `blender/`. |
| `blender/remote/arm64/queue.sh <phase> <room>...` | Runs the phase for each room through `live.sh`, and records the time of each step. `BACKDROP=1` also renders the backdrops of the windows. |

- `live.sh` keeps the GPU kernels that Cycles and the driver compile in `~/.cache/blender-arm` between runs.
- `LOBBY_PASSES` selects the bake passes. The default is `base,chand,layers,sky,albedo,finish`.

## Windows bake machine

| Script | Use |
|---|---|
| `blender/remote/setup.ps1` | Prepares `$HOME\lobby-bake` on the machine. |
| `blender/remote/run.ps1 <script.py> [args...]` | Runs one Blender script without a window, with OptiX. |
| `blender/remote/room.ps1 <room> build`, `preview`, `bake` | Runs one phase for one room. |
| `blender/remote/live.ps1 <phase> <room>`, with the phase `build`, `probe`, `bake` or `draft` | Makes the room, renders its probes and bakes it. |
| `blender/remote/queue.ps1 [rooms...]` | Makes, bakes and exports the rooms, one room at a time. |
| `blender/remote/passes.ps1 <passes> <scale> <spp>` | Runs only some bake passes again. |
| `blender/remote/realism.ps1` | Makes the room and renders a review, then bakes the same `.blend` file. |
| `blender/remote/asset.ps1 <room> <asset>...` | Renders one asset of a room alone in a studio. |
| `blender/remote/earth.ps1` | Renders the view of Earth for some `lat,lon,spin` values. |
| `blender/remote/night.ps1` | Downloads the full NASA image of the dark side of Earth and decreases its size for the renders. |
