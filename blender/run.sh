#!/bin/bash
# Wrapper for the official Blender build (has OIDN + CUDA + numpy)
export LD_LIBRARY_PATH=$HOME/.local/opt/blender-libs/root/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
exec $HOME/.local/opt/blender-official/blender-5.0.1-linux-x64/blender "$@"
