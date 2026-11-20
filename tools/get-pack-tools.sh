#!/bin/bash
# The three command-line tools tools/pack.py needs, into ~/.local/opt (Linux x86-64, no root).
set -e; O="$HOME/.local/opt"; T="$(mktemp -d)"; cd "$T"
curl -sSLO https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Linux-x86_64.tar.bz2
echo "c6b08c817f8c8dd299deccae4f2fbb8d55e9acd2  KTX-Software-4.4.2-Linux-x86_64.tar.bz2" | sha1sum -c -
mkdir -p "$O/ktx" && tar -xjf KTX-Software-4.4.2-Linux-x86_64.tar.bz2 -C "$O/ktx" --strip-components=1                  # ktx create: PNG -> KTX2
curl -sSLO https://github.com/zeux/meshoptimizer/releases/download/v1.3/gltfpack-ubuntu.zip
mkdir -p "$O/gltfpack" && unzip -o -q gltfpack-ubuntu.zip -d "$O/gltfpack" && chmod +x "$O/gltfpack/gltfpack"            # geometry
curl -sSLO https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.5.0-linux-x86-64.tar.gz
mkdir -p "$O/webp" && tar -xzf libwebp-1.5.0-linux-x86-64.tar.gz -C "$O/webp" --strip-components=1                       # dwebp: WebP -> PNG
rm -rf "$T"; echo "ok: $O/{ktx,gltfpack,webp}"
