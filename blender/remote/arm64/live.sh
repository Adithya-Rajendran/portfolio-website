#!/usr/bin/env bash
# Live reflection phases for one room on an ARM64 Linux GPU machine
set -euo pipefail
phase=$1; room=$2; mkdir -p ~/.cache/blender-arm out; env=(-e "LOBBY_PASSES=${LOBBY_PASSES:-base,chand,layers,sky,albedo,finish}")
case $phase in
  build) args="--python-exit-code 2 -P $([[ $room == lobby ]] && echo build_scene.py || echo room_$room.py)";;
  backdrop) args="$room.blend --python-exit-code 2 -P backdrop.py -- 4096";;
  probe) args="$room.blend --python-exit-code 2 -P reflection_probe.py";;
  draft) args="$room.blend --python-exit-code 2 -P bake.py -- 0.25 24";;
  bake)  args="$room.blend --python-exit-code 2 -P bake.py -- 1.0 192";;
  review) args="$room.blend --python-exit-code 2 -P preview.py -- /job/blender/out/review_$room.png 24 1280";;
  geom) args="$room.blend --python-exit-code 2 -P bake.py -- 0.05 1"; env=(-e LOBBY_PASSES=none);;
  *) echo "unknown phase $phase" >&2; exit 2;;
esac
exec docker run --rm --gpus all -e NVIDIA_DRIVER_CAPABILITIES=all -e LOBBY_DEVICE=OPTIX -e HOME=/cache -e OPTIX_CACHE_PATH=/cache/optix "${env[@]}" \
  --user "$(id -u):$(id -g)" -v ~/.cache/blender-arm:/cache -v "$(cd .. && pwd)":/job -w /job/blender blender-arm:5.0.1 /opt/blender/blender -b $args
