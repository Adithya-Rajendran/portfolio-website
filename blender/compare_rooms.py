# Regression check that compares two room .blend files after an asset extraction
import hashlib
import sys

import bpy
import numpy as np


def column(collection, key, n, dtype):
    out = np.empty(len(collection) * n, dtype=dtype)
    collection.foreach_get(key, out)
    return out


def topology(mesh, exterior):
    digest = hashlib.sha256()
    sides = column(mesh.polygons, 'loop_total', 1, 'i4')
    indices = column(mesh.loops, 'vertex_index', 1, 'i4')
    mats = column(mesh.polygons, 'material_index', 1, 'i4')
    smooth = column(mesh.polygons, 'use_smooth', 1, '?')
    if exterior and not mesh.uv_layers:
        starts = column(mesh.polygons, 'loop_start', 1, 'i4')
        for n in np.unique(sides):
            rows = sides == n
            f = indices[starts[rows, None] + np.arange(n)]
            order = (f.argmin(axis=1)[:, None] + np.arange(n)) % n
            f = np.column_stack((np.take_along_axis(f, order, axis=1), mats[rows], smooth[rows]))
            digest.update(f[np.lexsort(f.T[::-1])].tobytes())
    else:
        for data in (sides, indices, mats, smooth): digest.update(data.tobytes())
    for uv in mesh.uv_layers:
        digest.update(uv.name.encode()); digest.update(column(uv.uv, 'vector', 2, 'f4').tobytes())
    return digest.hexdigest()


def snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=path)
    scene = bpy.context.scene
    graph = bpy.context.evaluated_depsgraph_get()
    rows = {}
    for obj in scene.objects:
        ob = obj.evaluated_get(graph)
        info = [ob.type, ob.hide_render, [ob.get(k) for k in ('grp','em','fx')]]
        co = np.array(ob.matrix_world).flatten()
        if ob.type == 'MESH':
            mesh = ob.data
            info.append([m.name if m else None for m in mesh.materials])
            info.append(topology(mesh, any(c.name == 'Outside' for c in obj.users_collection)))
            co = np.concatenate((co, column(mesh.vertices, 'co', 3, 'f4')))
        elif ob.type == 'LIGHT':
            d = ob.data
            info += [d.type, list(d.color), d.energy, d.use_shadow,
                     [getattr(d, k, None) for k in ('angle','size','size_y','shape','shadow_soft_size','spot_size','spot_blend')]]
        elif ob.type == 'CAMERA':
            info += [ob.data.lens, ob.data.clip_start, ob.data.clip_end]
        rows[ob.name] = (info, co)
    return rows, scene['lobby'].to_dict()


first, second = sys.argv[sys.argv.index('--') + 1:]
a, meta_a = snapshot(first)
b, meta_b = snapshot(second)
if meta_a != meta_b: raise ValueError('Changed scene metadata (including camera, doors, picks or FX)')
if a.keys() != b.keys(): raise ValueError(f'Object name differences: {sorted(a.keys() ^ b.keys())[:50]}')
worst = 0.0
failures = []
for key, (info, pos) in a.items():
    other, coords = b[key]
    if info != other or pos.shape != coords.shape:
        failures.append((key, 'topology/material/attributes'))
    else:
        error = float(np.max(np.abs(pos - coords)))
        worst = max(worst, error)
        if not np.isfinite(error) or error > .00001: failures.append((key, error))
if failures: raise ValueError(f'{len(failures)} changed objects: {failures[:30]}')
print(f'MATCH: {len(a)} objects; max coordinate/matrix delta {worst:.8g}; metadata identical')
