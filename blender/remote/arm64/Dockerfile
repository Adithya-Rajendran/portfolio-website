# Blender 5.0.1 for Linux ARM64 with Cycles on CUDA and OptiX, for the NVIDIA GB10 (DGX Spark). Blender publishes no Linux
# ARM64 build, but keeps precompiled ARM64 libraries; this compiles against those (about 10 min on 20 cores).
#   docker build -t blender-arm:5.0.1 blender/remote/arm64      then see live.sh next to this file
FROM nvidia/cuda:12.9.1-devel-ubuntu24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends git git-lfs cmake ninja-build build-essential ca-certificates python3 \
      libx11-dev libxxf86vm-dev libxcursor-dev libxi-dev libxrandr-dev libxinerama-dev libegl-dev libwayland-dev wayland-protocols \
      libxkbcommon-dev libdbus-1-dev linux-libc-dev libdecor-0-dev libgl-dev \
      libsm6 libice6 libxext6 libxrender1 libxi6 libxxf86vm1 libxfixes3 libxkbcommon0 libgl1 libegl1 libglu1-mesa libxrandr2 libxinerama1 libxcursor1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone --depth 1 --branch v5.0.1 https://projects.blender.org/blender/blender.git && cd blender && git lfs install && \
    git clone --depth 1 --branch blender-v5.0-release https://projects.blender.org/blender/lib-linux_arm64.git lib/linux_arm64
RUN git clone --depth 1 https://github.com/NVIDIA/optix-dev.git /opt/optix
# sm_120 kernels run on the GB10 (sm_121); OptiX kernels are compiled by the driver on first use (keep its cache, see live.sh)
RUN cmake -S blender -B build -G Ninja -C blender/build_files/cmake/config/blender_release.cmake \
      -DCMAKE_INSTALL_PREFIX=/opt/blender -DWITH_INSTALL_PORTABLE=ON \
      -DWITH_CYCLES_CUDA_BINARIES=ON -DCYCLES_CUDA_BINARIES_ARCH=sm_120 -DWITH_CYCLES_DEVICE_OPTIX=ON -DOPTIX_ROOT_DIR=/opt/optix \
      -DWITH_CYCLES_DEVICE_HIP=OFF -DWITH_CYCLES_HIP_BINARIES=OFF -DWITH_CYCLES_DEVICE_HIPRT=OFF \
      -DWITH_CYCLES_DEVICE_ONEAPI=OFF -DWITH_CYCLES_ONEAPI_BINARIES=OFF \
    && ninja -C build install && rm -rf build && /opt/blender/blender --version
