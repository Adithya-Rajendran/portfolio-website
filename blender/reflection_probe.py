"""Bake one room-local reflection probe from an already built Blender 5 scene.

  LOBBY_DEVICE=OPTIX blender -b blender/lobby.blend -P blender/reflection_probe.py
  # CUDA is the default. Add -- --exr /tmp/lobby-probe.exr to keep the HDR render.

The probe is a single fixed view of the authored room: geometry, material reflections,
non-sun lights and mesh emission (including the Atrium orrery in its rest pose), plus
Earth, Moon, stars and their lighting where visible at the authored sky phase. The
Blender SUN lights are off for all paths: the disc and direct sun are live at runtime,
and a fixed probe should not freeze their highlights, sun patches or bounce. The
exterior's authored emission (including sunlit Earth) stays on. Browser-only effects
are not captured; any authored stand-ins and proxy lights remain. This is reflected
radiance, not a second diffuse lightmap or a replacement for the live planar mirror.

Runtime direction d is room-local, +Y up (Blender x,z,-y). For normalized d:
  u = fract(0.5 + atan2(d.x, -d.z) / (2*pi)); v = acos(clamp(d.y,-1,1)) / pi
Equator landmarks: u=0/1 +Z, .25 -X, .5 -Z, .75 +X. North is bitmap row 0,
which pack.py uploads at GL v=0 without a flip. Use repeat U / clamp V. Layer
indices are ordered by roughness; recover linear radiance as encoded.rgb**2 * range.
Origin and bounds in probe.json use Blender room coordinates, like scene.json;
convert to runtime coordinates (and reorder the two Z extremes for the AABB).
"""

import argparse
import json
import math
import os
from pathlib import Path
import sys
import tempfile

import bpy
import numpy as np


SOURCE_SIZE = (1024, 512)
WIDTH, HEIGHT = 512, 256
SPP = 128
ROUGHNESS = (0.0, 0.25, 0.5, 0.75, 1.0)
RANGE = 16.0
GGX_SAMPLES = 256  # At roughness 1, 128 of these reflect above the horizon.

# Authored shell AABBs in Blender metres, not mesh bounds (which include space).
# In particular, the Atrium's hull crown is HC+RL, not the balcony height;
# Navigation uses the drum radius and dome/oculus, not the oversized floor quad.
# Each origin is clear of tabletop/projector optics, lamps and other geometry.
ROOMS = {
    # Atrium: above and just aft of the dais center (and offset from HoloGlow).
    'lobby': ((0.0, 6.5, 1.9), (-10.0, -7.0, 0.0), (10.0, 26.0, 12.35)),
    # Observation Lounge: above the low coffee table, clear of books and drinks.
    'about': ((0.0, 1.6, 1.15), (-7.0, -6.0, 0.0), (7.0, 9.0, 6.6)),
    # Fabrication: middle aisle between the exhibit pairs and clear of the crane.
    'projects': ((0.0, 8.0, 1.7), (-8.0, -7.0, 0.0), (8.0, 25.0, 8.6)),
    # Navigation: above the projection table, offset from the lens and mapglow.
    'experience': ((0.75, -0.55, 1.5), (-9.0, -9.0, 0.0), (9.0, 9.0, 8.4)),
    # Library: above an open stretch of reading table between the banker's lamps.
    'writing': ((0.0, 4.55, 1.45), (-6.5, -5.0, 0.0), (6.5, 14.0, 8.6)),
}


def render_panorama(scene, origin, path):
    scene.render.engine = 'CYCLES'
    backend = os.environ.get('LOBBY_DEVICE', 'CUDA').strip().upper()
    if backend not in {'OPTIX', 'CUDA'}:
        raise ValueError('LOBBY_DEVICE must be OPTIX or CUDA')
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = backend
    prefs.refresh_devices()
    devices = []
    for device in prefs.devices:
        device.use = device.type == backend
        if device.use:
            devices.append(device.name)
    if not devices:
        raise RuntimeError(f'No {backend} Cycles device; check GPU drivers and LOBBY_DEVICE')
    print(f'PROBE: {backend} {devices}, {SPP} spp, Blender origin {origin}', flush=True)

    cycles = scene.cycles
    cycles.device = 'GPU'
    cycles.samples = SPP
    cycles.seed = 0
    cycles.use_adaptive_sampling = False
    cycles.use_denoising = False
    cycles.sample_clamp_direct = cycles.sample_clamp_indirect = 0.0
    for obj in scene.objects:
        if obj.type == 'LIGHT' and obj.data.type == 'SUN':
            obj.hide_render = True

    camera = bpy.data.cameras.new('ReflectionProbe')
    camera.type = 'PANO'
    camera.panorama_type = 'EQUIRECTANGULAR'
    camera.longitude_min, camera.longitude_max = -math.pi, math.pi
    camera.latitude_min, camera.latitude_max = -math.pi / 2, math.pi / 2
    camera.clip_start, camera.clip_end = 0.01, 5000.0
    obj = bpy.data.objects.new('ReflectionProbe', camera)
    scene.collection.objects.link(obj)
    obj.location = origin
    # Cycles' full equirect is centered on camera local -Z, with local +X
    # to the right at center and +Y at the zenith. Rx(+90°) makes these
    # Blender +Y, +X and +Z respectively, i.e. runtime -Z, +X and +Y.
    obj.rotation_euler = (math.pi / 2, 0.0, 0.0)
    scene.camera = obj

    render = scene.render
    render.resolution_x, render.resolution_y = SOURCE_SIZE
    render.resolution_percentage = 100
    render.pixel_aspect_x = render.pixel_aspect_y = 1.0
    render.use_border = render.use_compositing = render.use_sequencer = False
    render.use_multiview = render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    # A full-float EXR writes scene-linear data, bypassing the display transform.
    settings = render.image_settings
    settings.file_format = 'OPEN_EXR'
    settings.color_mode = 'RGB'
    settings.color_depth = '32'
    settings.exr_codec = 'ZIP'
    settings.color_management = 'FOLLOW_SCENE'
    render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def load_panorama(path):
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        w, h = image.size
        if (w, h) != SOURCE_SIZE:
            raise RuntimeError(f'Unexpected EXR size: {w}x{h}')
        image.colorspace_settings.name = 'Non-Color'  # EXR samples are already scene-linear.
        rgba = np.empty((h, w, 4), dtype=np.float32)
        image.pixels.foreach_get(rgba.ravel())
        # Blender's pixel array starts at bottom-left. Filtering uses north first.
        rgb = np.ascontiguousarray(rgba[::-1, :, :3])
        np.nan_to_num(rgb, copy=False, nan=0.0, posinf=0.0, neginf=0.0)
        return rgb
    finally:
        bpy.data.images.remove(image)


def solid_angle_mips(rgb):
    """Equirect box mip chain, averaging in linear radiance by texel steradians."""
    mips = [rgb]
    while rgb.shape[0] > 1:
        h = rgb.shape[0]
        edges = np.cos(np.linspace(0.0, math.pi, h + 1))
        areas = (edges[:-1] - edges[1:]).astype(np.float32)[:, None, None]
        a, b = areas[::2], areas[1::2]
        cols = (rgb[:, ::2] + rgb[:, 1::2]) * 0.5
        rgb = (cols[::2] * a + cols[1::2] * b) / (a + b)
        mips.append(rgb)
    return mips


def bilinear(rgb, u, v):
    """u is a row of longitudes (plus per-row offsets); v is a column of latitudes."""
    h, w = rgb.shape[:2]
    x = u * w - 0.5
    y = np.clip(v * h - 0.5, 0, h - 1)
    x0, y0 = np.floor(x), np.floor(y)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    ix, iy = x0.astype(np.intp), y0.astype(np.intp)
    jx, jy = (ix + 1) % w, np.minimum(iy + 1, h - 1)
    ix %= w
    a = rgb[iy, ix] * (1 - fx) + rgb[iy, jx] * fx
    b = rgb[jy, ix] * (1 - fx) + rgb[jy, jx] * fx
    return a * (1 - fy) + b * fy


def radical_inverse(i):
    """Base-2 Van der Corput, the second component of the Hammersley point."""
    result, bit = 0.0, 0.5
    while i:
        result += (i & 1) * bit
        i >>= 1
        bit *= 0.5
    return result


def prefilter_ggx(mips, roughness):
    """Normalized sum of L_i*NoL, importance sampling GGX half-vectors at V=N."""
    u_center = (np.arange(WIDTH, dtype=np.float32)[None, :] + 0.5) / WIDTH
    theta = math.pi * (np.arange(HEIGHT, dtype=np.float32) + 0.5) / HEIGHT
    sin_n, cos_n = np.sin(theta), np.cos(theta)
    acc = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
    total_weight = 0.0
    alpha_sq = roughness ** 4  # GGX alpha = perceptual roughness squared.
    source_w, source_h = SOURCE_SIZE
    equator_texel_area = math.tau * math.pi / (source_w * source_h)
    last_level = len(mips) - 1

    # The tangent frame is east, south, N. For each sample, direction changes
    # with output latitude but only rotates in longitude over each row. Project
    # that row once, then gather in blocks by source mip. No pixels-by-samples
    # arrays and no extra sin(theta) weighting of samples drawn in solid angle.
    for i in range(GGX_SAMPLES):
        xi = radical_inverse(i)
        phi = math.tau * i / GGX_SAMPLES
        no_h_sq = (1.0 - xi) / (1.0 + (alpha_sq - 1.0) * xi)
        no_l = 2.0 * no_h_sq - 1.0  # L = 2*dot(V,H)*H - V, with V=N.
        if no_l <= 0.0:
            continue
        tangent_len = 2.0 * math.sqrt(no_h_sq * (1.0 - no_h_sq))
        east = tangent_len * math.cos(phi)
        south = tangent_len * math.sin(phi)
        forward = sin_n * no_l + cos_n * south
        up = cos_n * no_l - sin_n * south
        horizontal = np.hypot(east, forward)
        # At longitude zero, L = (east, up, -forward) in runtime coordinates.
        du = np.arctan2(east, forward) / math.tau
        v = np.arctan2(horizontal, up) / math.pi

        # PDF in light-direction solid angle: D(H)*NoH/(4*VoH) = D(H)/4.
        d = no_h_sq * (alpha_sq - 1.0) + 1.0
        pdf = alpha_sq / (4.0 * math.pi * d * d)
        sample_area = 1.0 / (GGX_SAMPLES * pdf)
        # Estimate the source footprint from local texel area. Limit the polar
        # anisotropy of the isotropic mip choice (longitude narrows to zero).
        texel_area = equator_texel_area * np.maximum(horizontal, 0.2)
        lod = np.clip(0.5 * np.log2(sample_area / texel_area), 0, last_level)
        lower = lod.astype(np.intp)
        for level in np.unique(lower):
            rows = np.flatnonzero(lower == level)
            u_rows = u_center + du[rows, None]
            v_rows = v[rows, None]
            color = bilinear(mips[level], u_rows, v_rows)
            if level < last_level:
                t = (lod[rows] - level)[:, None, None]
                color += (bilinear(mips[level + 1], u_rows, v_rows) - color) * t
            acc[rows] += color * no_l
        total_weight += no_l
    return acc / total_weight


def save_layer(rgb, path):
    if rgb.shape != (HEIGHT, WIDTH, 3):
        raise ValueError(f'Unexpected probe layer shape: {rgb.shape}')
    # The WebP writer emits top first from Blender's bottom-first pixel buffer.
    # Flip only for that API, so the on-disk bitmap begins with the north row.
    rgba = np.ones((HEIGHT, WIDTH, 4), dtype=np.float32)
    rgba[:, :, :3] = np.sqrt(np.clip(rgb[::-1], 0.0, RANGE) / RANGE)
    image = bpy.data.images.new('ProbeEncoded', WIDTH, HEIGHT, alpha=False, float_buffer=False)
    try:
        image.colorspace_settings.name = 'Non-Color'
        image.pixels.foreach_set(rgba.ravel())
        image.filepath_raw = str(path)
        image.file_format = 'WEBP'
        image.save(quality=100)
    finally:
        bpy.data.images.remove(image)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--exr', type=Path, help='Optional path to retain the scene-linear EXR')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if args.exr and args.exr.suffix != '.exr':
        parser.error('--exr must end in .exr')

    scene = bpy.context.scene
    room = scene.get('lobby', {}).get('room')
    if room not in ROOMS:
        raise ValueError(f'Unsupported room {room!r}; load a built room .blend, not an asset bench')
    origin, low, high = ROOMS[room]
    out = Path(__file__).resolve().parent.parent / 'assets-src' / room
    tex = out / 'tex'
    tex.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix='arcadia-probe-') as tmp:
        exr = args.exr.resolve() if args.exr else Path(tmp) / 'probe.exr'
        exr.parent.mkdir(parents=True, exist_ok=True)
        render_panorama(scene, origin, exr)
        mips = solid_angle_mips(load_panorama(exr))

    for i, roughness in enumerate(ROUGHNESS):
        rgb = prefilter_ggx(mips, roughness) if roughness else mips[1]
        path = tex / f'probe_c{i}.webp'
        save_layer(rgb, path)
        print(f'PROBE: wrote {path} (roughness {roughness:g})', flush=True)

    metadata = {
        'origin': origin,
        'bounds': {'min': low, 'max': high},
        'coordinates': 'blender',
        'projection': 'equirectangular',
        'texture': 'tex/probe_c.ktx2',  # packed name; relative to the room directory
        'width': WIDTH,
        'height': HEIGHT,
        'roughness': ROUGHNESS,
        'range': RANGE,
        'encoding': 'sqrt',
    }
    (out / 'probe.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print(f'PROBE: wrote {out / "probe.json"}', flush=True)


if __name__ == '__main__':
    main()
