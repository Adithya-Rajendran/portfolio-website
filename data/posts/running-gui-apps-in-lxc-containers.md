---
title: "Running GUI apps in LXD containers"
description: "The LXD profile I use to run GUI tools on my Linux desktop, with shared display sockets, GPU access, and the limits of that isolation."
published: 2026-03-26
revised: 2026-10-25
tags: [homelab, containers, linux]
image: 2f1a10bc0ed068b1f4ff1c502fd59e6bb98738b2-1200x630.png
image_alt: "Running GUI apps in LXD containers. An engineering note by Adithya Rajendran."
takeaways:
  - "An LXD proxy relays the host's display sockets into the container, while a GPU device gives applications access to rendering hardware."
  - "Adapt the UID, GID, socket paths, and display assumptions to your desktop. The original notes do not establish a host-version compatibility matrix."
  - "This profile assumes a trusted, single-user container. Sharing display services is not a security boundary for hostile applications."
changelog:
  - date: 2026-10-25
    kind: correction
    note: "Added a downloadable profile, documented the missing host-version record, and explained container-side 0777 socket permissions. The profile is unchanged; no new compatibility test is claimed."
next: my-homelab
next_reason: "See how I organize the rest of the lab around explicit dependencies, from the Raspberry Pi bootstrap tier to the OpenStack machines."
projects: [homelab]
---
I wanted to keep GUI applications and their dependencies in a container while using them from my normal Linux desktop. This LXD profile connects the container to the host’s display sockets and GPU, so application windows appear alongside my other desktop apps.

This post walks through the LXD profile I use for that setup. It runs applications such as Antigravity in an isolated container while their windows render natively on my desktop.

## The Core Problem: Display Sockets Don’t Cross Container Boundaries

On a modern Linux desktop, graphical applications connect through Unix-domain sockets. Wayland commonly uses `$XDG_RUNTIME_DIR/wayland-0`, while X11 or Xwayland uses a socket under `/tmp/.X11-unix/`. Those sockets live in host-managed runtime directories, which a container cannot access by default.

There are a few common workarounds:

- Bind-mounting the socket directory works, but it exposes the host’s runtime directory directly to the container and broadens the access surface.
- SSH X forwarding supports X11, but it adds latency and does not provide a native Wayland path.
- Running VNC or RDP inside the container adds a second desktop session and more moving parts.

I prefer LXD’s `proxy` device. It relays connections between a socket path on the host and a separate endpoint inside the container. The container does not receive a direct bind mount of the host socket, although it still gains access to the host display service.

## The Profile

[Download the profile as gui-lxd-profile.yaml](../assets/files/8b46b93f83223a11d762796f2775bb697b0a94ce.yaml). This file matches the listing below; check the environment and permission assumptions before applying it.

This example assumes a desktop user with UID/GID 1000, a Wayland socket at `/run/user/1000/wayland-0`, Xwayland on display `:1`, and a GPU-access group with GID 44 inside the container. Check the desktop IDs and display sockets on the host, and the GPU group ID in the container image.

```yaml
config:
  security.nesting: "true"
  cloud-init.user-data: |
    #cloud-config
    package_update: true
    packages:
      # Desktop integration and session management
      - dbus-user-session
      - xdg-utils
      - x11-utils
      # Core graphics and hardware acceleration drivers
      - libgl1
      - libgl1-mesa-dri
      - libegl1
      - mesa-vulkan-drivers
      # Wayland rendering base
      - libwayland-egl1
      # Base typography (prevents invisible text in headless containers)
      - fontconfig
      - fonts-liberation
      - fonts-ubuntu
    write_files:
      - path: /usr/local/bin/setup-gui-sockets.sh
        permissions: "0755"
        content: |
          #!/bin/bash
          uid=1000
          gid="$(getent passwd ${uid} | cut -d: -f4)"
          run_dir="/run/user/${uid}"
          tmp_dir="/tmp/.X11-unix"
          mkdir -p "${run_dir}" && chmod 700 "${run_dir}" && chown ${uid}:${gid} "${run_dir}"
          mkdir -p "${tmp_dir}" && chmod 1777 "${tmp_dir}"
          if [ -S /mnt/wayland-0 ] && [ ! -e "${run_dir}/wayland-0" ]; then
            ln -s /mnt/wayland-0 "${run_dir}/wayland-0"
          fi
          if [ -S /mnt/X1 ] && [ ! -e "${tmp_dir}/X1" ]; then
            ln -s /mnt/X1 "${tmp_dir}/X1"
          fi
      - path: /etc/systemd/system/setup-gui-sockets.service
        content: |
          [Unit]
          Description=Link GUI sockets from /mnt to runtime dirs
          After=local-fs.target
          [Service]
          Type=oneshot
          ExecStart=/usr/local/bin/setup-gui-sockets.sh
          [Install]
          WantedBy=multi-user.target
      - path: /home/ubuntu/.profile
        append: true
        owner: "ubuntu:ubuntu"
        defer: true
        content: |
          export WAYLAND_DISPLAY=wayland-0
          export XDG_SESSION_TYPE=wayland
          export QT_QPA_PLATFORM=wayland
          export DISPLAY=:1
          export XDG_RUNTIME_DIR=/run/user/1000
    runcmd:
      - systemctl daemon-reload
      - systemctl enable --now setup-gui-sockets.service
      - usermod -a -G video,render ubuntu
description: GUI applications with host display integration
devices:
  gpu:
    type: gpu
    gid: 44
  wayland_socket:
    type: proxy
    bind: container
    connect: unix:/run/user/1000/wayland-0
    listen: unix:/mnt/wayland-0
    security.uid: "1000"
    security.gid: "1000"
    mode: "0777"
  xwayland_socket:
    type: proxy
    bind: container
    connect: unix:/tmp/.X11-unix/X1
    listen: unix:/mnt/X1
    security.uid: "1000"
    security.gid: "1000"
    mode: "0777"
```

### Environment assumptions

The launch command uses an Ubuntu 24.04 container image. The original notes do not record the host OS, LXD release, compositor, or GPU-driver versions, so this is a configuration example rather than a verified compatibility matrix. Record those versions when reproducing it, and check the UID/GID and socket assumptions above.

The socket endpoints use `mode: "0777"`. That makes them accessible to other container users who can reach `/mnt`, even though the normal Wayland runtime directory is private. This profile assumes a trusted, single-user container. Restrict socket ownership and permissions for a multi-user setup, then test both display paths. LXD documents `mode`, `uid`, and `gid` separately from the proxy process’s `security.uid` and `security.gid` in its [proxy-device reference](https://canonical.com/lxd/docs/latest/reference/devices_proxy/).

## How It Works

### Devices: Proxy Sockets and GPU Passthrough

The `devices` section is where the real work happens.

`wayland_socket` and `xwayland_socket` are both `proxy` devices. For each one, LXD accepts connections at `listen` inside the container (`/mnt/wayland-0` or `/mnt/X1`) and relays them to `connect` on the host. With the container-side bind setting, LXD creates the listening endpoint inside the container rather than on the host.

`security.uid` and `security.gid` make the proxy process drop privileges to UID/GID 1000. That matches the host desktop user in this example; it is not a portable constant. Verify the host user’s IDs before applying the profile, or the proxy may fail with `EACCES`.

> **Why both Wayland and X11?** Some apps (especially Electron-based tools like Antigravity) may fall back to X11 via Xwayland even on a Wayland session. Providing both sockets means you don’t have to fight with environment variables to coerce an app into the right protocol.

The `gpu` device exposes the host GPU to the container. Its `gid` option sets the group owner of the device inside the container, so `44` is only correct when that is the intended GPU-access group in the image. Verify the `video` and `render` group IDs rather than assuming a universal value. Hardware acceleration is noticeably smoother than software rendering for GPU-composited interfaces.

### cloud-init Package Installation

The packages install three things:

1. Graphics stack: `libgl1`, `libgl1-mesa-dri`, `libegl1`, `mesa-vulkan-drivers`, and `libwayland-egl1` provide Mesa’s OpenGL, EGL, Vulkan, and Wayland support. Without the required libraries, applications may fail to start or fall back to CPU rendering.
    - NVIDIA note: Follow LXD’s NVIDIA passthrough path rather than installing a second kernel driver inside the container. Depending on the LXD version and setup, use an NVIDIA CDI device or `nvidia.runtime` to pass the host runtime libraries into the container.
2. Desktop plumbing: `dbus-user-session` and `xdg-utils` support interprocess messaging and MIME/URL handling. Many desktop applications expect a D-Bus user session; without one, some integrations fail silently.
3. Fonts: Fonts are easy to overlook. Without them, applications may show missing glyphs or placeholder text. `fonts-liberation` and `fonts-ubuntu` cover several common families.

### The Socket Setup Script

The proxy devices create sockets at `/mnt/wayland-0` and `/mnt/X1` inside the container. Applications expect them at `$XDG_RUNTIME_DIR/wayland-0` and the X11 socket path under `/tmp/.X11-unix/`, so the profile links the proxy endpoints into those locations.

The `setup-gui-sockets.sh` script bridges this gap by symlinking the `/mnt` sockets into the expected locations:

```bash
if [ -S /mnt/wayland-0 ] && [ ! -e "${run_dir}/wayland-0" ]; then
  ln -s /mnt/wayland-0 "${run_dir}/wayland-0"
fi
if [ -S /mnt/X1 ] && [ ! -e "${tmp_dir}/X1" ]; then
  ln -s /mnt/X1 "${tmp_dir}/X1"
fi
```

The script also creates `/run/user/1000` with mode `0700` and ownership assigned to the `ubuntu` user. Many Wayland-aware applications check this runtime directory at launch and exit if it is missing or has the wrong ownership.

The script runs as a oneshot systemd service enabled for `multi-user.target` and ordered after `local-fs.target`, so it runs during boot before a typical interactive user session.

### Environment Variables

The `.profile` additions wire up the session for both Wayland and X11:

```bash
export WAYLAND_DISPLAY=wayland-0       # Wayland socket name (relative to XDG_RUNTIME_DIR)
export XDG_SESSION_TYPE=wayland        # Tells toolkits this is a Wayland session
export QT_QPA_PLATFORM=wayland         # Forces Qt apps to use the Wayland backend
export DISPLAY=:1                      # X display number (matches XWayland socket X1)
export XDG_RUNTIME_DIR=/run/user/1000  # Runtime dir for the ubuntu user
```

`DISPLAY=:1` matches the `X1` socket used by this profile. Do not assume every host uses display `:1`; confirm the active X11 or Xwayland display and socket before applying the profile.

## Using the Profile

Save the profile as `gui.yaml`, then create it:

```bash
lxc profile create gui < gui.yaml
```

Launch a container with it:

```bash
lxc launch ubuntu:24.04 ai-dev --profile default --profile gui
```

Wait for cloud-init to finish using `lxc exec ai-dev -- cloud-init status --wait`. Then open a login shell as the container’s ubuntu user. This loads the desktop settings from .profile. Install your application, then launch it as ubuntu:

```bash
lxc exec ai-dev -- su --login ubuntu
# Install your application, then launch it as ubuntu.
```

## Caveats

- Audio: This profile does not configure audio. Supporting it usually requires exposing the appropriate PipeWire socket and matching its permissions and session environment.
- Clipboard: Clipboard behavior depends on the compositor and protocol in use. Test it on your host before adding a `wl-copy`/`wl-paste` bridge or another compositor-specific workaround.
    - X11 clipboard sharing usually works, but X11 provides a weaker isolation boundary: a client may be able to observe or interact with other X11 clients on the host.
- NVIDIA GPUs: Device paths, runtime libraries, and group IDs may differ from Mesa-based setups. Use LXD’s documented NVIDIA passthrough configuration rather than assuming this generic profile is sufficient.
- User IDs: This profile assumes the `ubuntu` user has UID 1000 inside the container and the desktop user has UID/GID 1000 on the host. If either differs, update that side’s paths and IDs. The proxy’s `security.uid` and `security.gid` select its host-side credentials; the runtime directory and GPU-access group must match the container user.

This setup is useful for isolating application files and dependencies, but display and GPU access deliberately cross the container boundary. Treat it as operational isolation for trusted tools, not as a VM-strength sandbox for hostile code.
