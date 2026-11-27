# Render of the local reflection probes of a room from a built Blender 5 scene
USAGE = "Render a room's local reflection probes from an already built Blender 5 scene."

import argparse
import json
import math
import os
from pathlib import Path
import sys
import tempfile

import bpy
import numpy as np
from mathutils import Vector


SOURCE_SIZE = (1024, 512)
WIDTH, HEIGHT = 512, 256
SPP = 128
ROUGHNESS = (0.0, 0.25, 0.5, 0.75, 1.0)
RANGE = 16.0
GGX_SAMPLES = 256
CLEARANCE = 0.25

ROOMS = {
    'lobby': ([(0.0, -1.0, 1.9), (0.0, 6.5, 1.9), (0.0, 13.5, 1.9), (0.0, 18.5, 1.9)], (-10.0, -7.0, 0.0), (10.0, 26.0, 12.35)),
    'about': ([(0.0, -3.0, 1.3), (0.0, 1.6, 1.15), (0.0, 6.0, 1.3)], (-7.0, -6.0, 0.0), (7.0, 9.0, 6.6)),
    'projects': ([(0.0, 0.5, 1.7), (0.0, 8.0, 1.7), (0.0, 16.0, 1.7)], (-8.0, -7.0, 0.0), (8.0, 25.0, 8.6)),
    'experience': ([(0.75, -0.55, 1.5), (0.0, -5.6, 1.7)], (-9.0, -9.0, 0.0), (9.0, 9.0, 8.4)),
    'writing': ([(0.0, -1.6, 1.5), (0.0, 4.55, 1.45), (0.0, 10.5, 1.45)], (-6.5, -5.0, 0.0), (6.5, 14.0, 8.6)),
    'comms': ([(0.0, -2.5, 1.6), (0.0, 3.5, 1.6), (0.0, 9.6, 1.6)], (-8.0, -6.0, 0.0), (8.0, 12.0, 7.2)),
}


def moves(obj):
    return str(obj.get('grp', '')).startswith('chand') or str(obj.get('em', '')).startswith('chand')


def prepare(scene):
    outside = set(bpy.data.collections['Outside'].all_objects) if 'Outside' in bpy.data.collections else set()
    hidden = {'exterior': 0, 'moving': 0, 'lamps': 0}
    for obj in scene.objects:
        if obj.type == 'LIGHT':
            if obj.data.type == 'SUN': obj.hide_render = True
            else: obj.visible_camera = False; hidden['lamps'] += 1
        elif obj in outside: obj.visible_camera = False; hidden['exterior'] += 1
        elif moves(obj): obj.visible_camera = False; hidden['moving'] += 1
    scene.render.film_transparent = True
    print('PROBE: hidden from camera rays', hidden, flush=True)


def clearance(scene, origin):
    deps = bpy.context.evaluated_depsgraph_get(); o = Vector(origin); worst = (math.inf, None)
    n = 400; golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n; r = math.sqrt(1 - z * z); d = Vector((math.cos(golden * i) * r, math.sin(golden * i) * r, z))
        start = o.copy()
        for _ in range(8):
            hit, loc, _, _, obj, _ = scene.ray_cast(deps, start, d, distance=CLEARANCE)
            if not hit: break
            if obj.hide_render or obj.visible_camera is False or 'fx' in obj:
                start = loc + d * 1e-3; continue
            dist = (loc - o).length
            if dist < worst[0]: worst = (dist, obj.name)
            break
    if worst[1]: raise RuntimeError(f'Probe at {origin} is {worst[0]:.2f} m from {worst[1]}: move it')


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

    camera = bpy.data.cameras.get('ReflectionProbe') or bpy.data.cameras.new('ReflectionProbe')
    camera.type = 'PANO'
    camera.panorama_type = 'EQUIRECTANGULAR'
    camera.longitude_min, camera.longitude_max = -math.pi, math.pi
    camera.latitude_min, camera.latitude_max = -math.pi / 2, math.pi / 2
    camera.clip_start, camera.clip_end = 0.01, 5000.0
    obj = bpy.data.objects.get('ReflectionProbe')
    if obj is None:
        obj = bpy.data.objects.new('ReflectionProbe', camera)
        scene.collection.objects.link(obj)
    obj.location = origin
    obj.rotation_euler = (math.pi / 2, 0.0, 0.0)
    scene.camera = obj

    render = scene.render
    render.resolution_x, render.resolution_y = SOURCE_SIZE
    render.resolution_percentage = 100
    render.pixel_aspect_x = render.pixel_aspect_y = 1.0
    render.use_border = render.use_compositing = render.use_sequencer = False
    render.use_multiview = False
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    settings = render.image_settings
    settings.file_format = 'OPEN_EXR'
    settings.color_mode = 'RGBA'
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
        image.colorspace_settings.name = 'Non-Color'
        rgba = np.empty((h, w, 4), dtype=np.float32)
        image.pixels.foreach_get(rgba.ravel())
        rgba = np.ascontiguousarray(rgba[::-1])
        np.nan_to_num(rgba, copy=False, nan=0.0, posinf=0.0, neginf=0.0)
        rgba[..., 3] = np.clip(rgba[..., 3], 0.0, 1.0)
        return rgba
    finally:
        bpy.data.images.remove(image)


def solid_angle_mips(rgb):
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
    result, bit = 0.0, 0.5
    while i:
        result += (i & 1) * bit
        i >>= 1
        bit *= 0.5
    return result


def prefilter_ggx(mips, roughness):
    u_center = (np.arange(WIDTH, dtype=np.float32)[None, :] + 0.5) / WIDTH
    theta = math.pi * (np.arange(HEIGHT, dtype=np.float32) + 0.5) / HEIGHT
    sin_n, cos_n = np.sin(theta), np.cos(theta)
    acc = np.zeros((HEIGHT, WIDTH, mips[0].shape[2]), dtype=np.float32)
    total_weight = 0.0
    alpha_sq = roughness ** 4
    source_w, source_h = SOURCE_SIZE
    equator_texel_area = math.tau * math.pi / (source_w * source_h)
    last_level = len(mips) - 1
    for i in range(GGX_SAMPLES):
        xi = radical_inverse(i)
        phi = math.tau * i / GGX_SAMPLES
        no_h_sq = (1.0 - xi) / (1.0 + (alpha_sq - 1.0) * xi)
        no_l = 2.0 * no_h_sq - 1.0
        if no_l <= 0.0:
            continue
        tangent_len = 2.0 * math.sqrt(no_h_sq * (1.0 - no_h_sq))
        east = tangent_len * math.cos(phi)
        south = tangent_len * math.sin(phi)
        forward = sin_n * no_l + cos_n * south
        up = cos_n * no_l - sin_n * south
        horizontal = np.hypot(east, forward)
        du = np.arctan2(east, forward) / math.tau
        v = np.arctan2(horizontal, up) / math.pi
        d = no_h_sq * (alpha_sq - 1.0) + 1.0
        pdf = alpha_sq / (4.0 * math.pi * d * d)
        sample_area = 1.0 / (GGX_SAMPLES * pdf)
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


def save_layer(rgba, path):
    if rgba.shape != (HEIGHT, WIDTH, 4):
        raise ValueError(f'Unexpected probe layer shape: {rgba.shape}')
    out = np.empty((HEIGHT, WIDTH, 4), dtype=np.float32)
    out[:, :, :3] = np.sqrt(np.clip(rgba[::-1, :, :3], 0.0, RANGE) / RANGE)
    out[:, :, 3] = np.clip(rgba[::-1, :, 3], 0.0, 1.0)
    image = bpy.data.images.new('ProbeEncoded', WIDTH, HEIGHT, alpha=True, float_buffer=False)
    try:
        image.colorspace_settings.name = 'Non-Color'
        image.alpha_mode = 'CHANNEL_PACKED'
        image.pixels.foreach_set(out.ravel())
        image.filepath_raw = str(path)
        image.file_format = 'WEBP'
        image.save(quality=100)
    finally:
        bpy.data.images.remove(image)


def main():
    parser = argparse.ArgumentParser(description=USAGE)
    parser.add_argument('--exr', type=Path, help='Optional path prefix to retain each scene-linear EXR')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

    scene = bpy.context.scene
    room = scene.get('lobby', {}).get('room')
    if room not in ROOMS:
        raise ValueError(f'Unsupported room {room!r}; load a built room .blend, not an asset bench')
    origins, low, high = ROOMS[room]
    out = Path(__file__).resolve().parent.parent / 'assets-src' / room
    tex = out / 'tex'
    tex.mkdir(parents=True, exist_ok=True)
    for stale in tex.glob('probe_c*.webp'):
        stale.unlink()
    prepare(scene)
    for origin in origins:
        clearance(scene, origin)

    for p, origin in enumerate(origins):
        with tempfile.TemporaryDirectory(prefix='arcadia-probe-') as tmp:
            exr = Path(f'{args.exr}-{p}.exr').resolve() if args.exr else Path(tmp) / 'probe.exr'
            exr.parent.mkdir(parents=True, exist_ok=True)
            render_panorama(scene, origin, exr)
            mips = solid_angle_mips(load_panorama(exr))
        print(f'PROBE {p}: interior coverage {mips[-1][0, 0, 3]:.3f}', flush=True)
        for i, roughness in enumerate(ROUGHNESS):
            rgba = prefilter_ggx(mips, roughness) if roughness else mips[1]
            path = tex / f'probe_c{p * len(ROUGHNESS) + i}.webp'
            save_layer(rgba, path)
            print(f'PROBE: wrote {path} (probe {p}, roughness {roughness:g})', flush=True)

    metadata = {
        'probes': [{'origin': list(o)} for o in origins],
        'bounds': {'min': list(low), 'max': list(high)},
        'coordinates': 'blender',
        'projection': 'equirectangular',
        'texture': 'tex/probe_c.ktx2',
        'width': WIDTH,
        'height': HEIGHT,
        'roughness': list(ROUGHNESS),
        'range': RANGE,
        'encoding': 'sqrt',
        'alpha': 'interior',
        'hidden': ['exterior', 'sun', 'lamps', 'moving'],
    }
    (out / 'probe.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print(f'PROBE: wrote {out / "probe.json"}', flush=True)


if __name__ == '__main__':
    main()
