#!/usr/bin/env bash
# live.ps1 for an ARM64 Linux GPU machine: blender/remote/arm64/live.sh build|probe|bake|draft <room>, run from blender/.
# The GPU kernels Cycles and the driver compile on first use (minutes) are kept in ~/.cache/blender-arm between runs.
set -euo pipefail
phase=$1; room=$2; mkdir -p ~/.cache/blender-arm
case $phase in
  build) args="--python-exit-code 2 -P $([[ $room == lobby ]] && echo build_scene.py || echo room_$room.py)";;
  probe) args="$room.blend --python-exit-code 2 -P reflection_probe.py";;
  draft) args="$room.blend --python-exit-code 2 -P bake.py -- 0.25 24";;
  bake)  args="$room.blend --python-exit-code 2 -P bake.py -- 1.0 192";;
esac
exec docker run --rm --gpus all -e NVIDIA_DRIVER_CAPABILITIES=all -e LOBBY_DEVICE=OPTIX -e HOME=/cache -e OPTIX_CACHE_PATH=/cache/optix \
  --user "$(id -u):$(id -g)" -v ~/.cache/blender-arm:/cache -v "$(cd .. && pwd)":/job -w /job/blender blender-arm:5.0.1 /opt/blender/blender -b $args
