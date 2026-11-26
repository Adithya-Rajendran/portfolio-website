#!/usr/bin/env python3
"""Packs the bakes in assets-src/<room>/ into public/assets/<room>/: KTX2 textures, and room geometry with faces that lie on each other separated, meshopt-compressed."""
import json, os, re, shutil, struct, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OPT = os.path.expanduser('~/.local/opt')
KTX, DWEBP, GLTFPACK = f'{OPT}/ktx/bin/ktx', f'{OPT}/webp/bin/dwebp', f'{OPT}/gltfpack/gltfpack'
ENV = dict(os.environ, LD_LIBRARY_PATH=f'{OPT}/ktx/lib')
# Light (dark, smooth) -> UASTC + Zstandard: near-lossless, 8 bits per pixel on the GPU. BasisLZ/ETC1S is a fifth of the
# download but turns such light into coloured blocks; it is only used for the surface-colour atlases (_a), which
# are flat colour and only ever seen multiplied by sunlight.
UASTC = ['--encode', 'uastc', '--uastc-quality', '2', '--zstd', '18']
ETC1S = ['--encode', 'basis-lz', '--qlevel', '255', '--clevel', '3']

COMP = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def glb_read(path):
    with open(path, 'rb') as f: b = f.read()
    if b[:4] != b'glTF': sys.exit(f'{path}: not a binary glTF')
    jl = struct.unpack_from('<I', b, 12)[0]; js = json.loads(b[20:20 + jl]); o = 20 + jl
    bl = struct.unpack_from('<I', b, o)[0] if o + 8 <= len(b) else 0
    return js, bytearray(b[o + 8:o + 8 + bl])

def glb_write(path, js, bin_):
    bin_ = bytearray(bin_) + bytes(-len(bin_) % 4)
    js['buffers'][0]['byteLength'] = len(bin_)
    j = json.dumps(js, separators=(',', ':')).encode(); j += b' ' * (-len(j) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(j) + len(bin_)))
        f.write(struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(bin_), 0x004E4942) + bin_)

def accessor(js, bin_, i):
    a = js['accessors'][i]
    if 'sparse' in a or 'bufferView' not in a: sys.exit('sparse or empty accessors are not supported')
    v = js['bufferViews'][a['bufferView']]; fmt = '<' + COMP[a['componentType']] * WIDTH[a['type']]; size = struct.calcsize(fmt)
    stride, o = v.get('byteStride') or size, v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return fmt, [bytes(bin_[o + k * stride:o + k * stride + size]) for k in range(a['count'])]

def append(js, bin_, items, fmt, like, target):
    bin_ += bytes(-len(bin_) % 4); off = len(bin_); bin_ += b''.join(items)
    js['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(bin_) - off, 'target': target})
    a = {k: v for k, v in like.items() if k not in ('bufferView', 'byteOffset', 'count', 'min', 'max')}
    a.update(bufferView=len(js['bufferViews']) - 1, count=len(items))
    if 'min' in like:
        vals = [struct.unpack(fmt, x) for x in items]
        a['min'] = [min(v[c] for v in vals) for c in range(len(vals[0]))]; a['max'] = [max(v[c] for v in vals) for c in range(len(vals[0]))]
    js['accessors'].append(a)
    return len(js['accessors']) - 1

def node_matrix(n):
    if 'matrix' in n: m = n['matrix']; return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    (x, y, z, w), s, t = n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1]), n.get('translation', [0, 0, 0])
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[r][0] * s[0], R[r][1] * s[1], R[r][2] * s[2], t[r]] for r in range(3)] + [[0, 0, 0, 1]]

def mesh_nodes(js):
    out = []
    def walk(i, M):
        n = js['nodes'][i]; L = node_matrix(n); W = [[sum(M[r][k] * L[k][c] for k in range(4)) for c in range(4)] for r in range(4)]
        if 'mesh' in n: out.append((n['mesh'], W))
        for c in n.get('children', []): walk(c, W)
    for r in js['scenes'][js.get('scene', 0)]['nodes']: walk(r, [[float(r == c) for c in range(4)] for r in range(4)])
    return out

def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])

def clipped_area(t1, t2):
    poly = list(t2)
    for i in range(3):
        a, b, out = t1[i], t1[(i + 1) % 3], []
        side = lambda p: (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        for k in range(len(poly)):
            p, q = poly[k], poly[(k + 1) % len(poly)]; sp, sq = side(p), side(q)
            if sp >= 0: out.append(p)
            if (sp >= 0) != (sq >= 0): u = sp / (sp - sq); out.append((p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])))
        poly = out
        if len(poly) < 3: return 0.0
    return abs(sum(poly[k][0] * poly[(k + 1) % len(poly)][1] - poly[(k + 1) % len(poly)][0] * poly[k][1] for k in range(len(poly)))) / 2

def separate(src, dst, lift=0.003, plane=5e-4, least=1e-6):
    stats, cur, only = None, src, None
    for n in range(1, 6):
        once, only = separate_once(cur, dst, lift, plane, least, only)
        stats = once if stats is None else dict(stats, lifted=stats['lifted'] + once['lifted'], dropped=stats['dropped'] + once['dropped'], deepest_mm=max(stats['deepest_mm'], once['deepest_mm'])); cur = dst
        if not once['lifted'] and not once['dropped']: break
    return dict(stats, passes=n)

def separate_once(src, dst, lift, plane, least, only=None):
    js, bin_ = glb_read(src)
    uses = {}
    for m, _ in mesh_nodes(js): uses[m] = uses.get(m, 0) + 1
    cam = js['scenes'][js.get('scene', 0)].get('extras', {}).get('lobby', {}).get('cam')
    eye = (cam[0], cam[2], -cam[1]) if cam else None
    prims, tris = [], []
    for m, M in mesh_nodes(js):
        for p in js['meshes'][m]['primitives']:
            if p.get('mode', 4) != 4 or uses[m] > 1: continue
            fmt, raw = accessor(js, bin_, p['attributes']['POSITION'])
            P = [struct.unpack(fmt, r) for r in raw]
            I = [struct.unpack(f, r)[0] for f, rs in [accessor(js, bin_, p['indices'])] for r in rs] if 'indices' in p else list(range(len(P)))
            N = [struct.unpack(f, r) for f, rs in [accessor(js, bin_, p['attributes']['NORMAL'])] for r in rs] if 'NORMAL' in p['attributes'] else None
            Wp = [tuple(M[r][0] * q[0] + M[r][1] * q[1] + M[r][2] * q[2] + M[r][3] for r in range(3)) for q in P]
            k = len(prims); prims.append({'p': p, 'M': M, 'P': P, 'I': I})
            for t in range(len(I) // 3):
                ia, ib, ic = I[3 * t:3 * t + 3]; a, b, c = Wp[ia], Wp[ib], Wp[ic]
                n = cross(sub(b, a), sub(c, a)); l = dot(n, n) ** 0.5
                if l < 1e-12: continue
                n = (n[0] / l, n[1] / l, n[2] / l)
                if N:
                    s = [sum(M[r][q] * N[v][q] for q in range(3)) for v in (ia, ib, ic) for r in range(3)]
                    if dot(n, (s[0] + s[3] + s[6], s[1] + s[4] + s[7], s[2] + s[5] + s[8])) < 0: n = (-n[0], -n[1], -n[2])
                tris.append((k, t, (a, b, c), n, dot(n, a), l / 2))
    if eye is None:
        lo = [min(v[q] for tr in tris for v in tr[2]) for q in range(3)] if tris else [0, 0, 0]; hi = [max(v[q] for tr in tris for v in tr[2]) for q in range(3)] if tris else [0, 0, 0]
        eye = tuple((lo[q] + hi[q]) / 2 for q in range(3))
    parent = list(range(len(tris)))
    def find(i):
        while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
        return i
    same = lambda i, j: dot(tris[i][3], tris[j][3]) > 1 - 1e-6 and abs(tris[i][4] - tris[j][4]) < plane
    edges = {}
    for i, (k, t, V, n, d, A) in enumerate(tris):
        I = prims[k]['I'][3 * t:3 * t + 3]
        for e in range(3): edges.setdefault((k,) + tuple(sorted((I[e], I[(e + 1) % 3]))), []).append((i, V[(e + 2) % 3], V[e], V[(e + 1) % 3]))
    for key, items in edges.items():
        for x in range(len(items)):
            for y in range(x + 1, len(items)):
                (i, pi, a, b), (j, pj, _, _) = items[x], items[y]
                if not same(i, j): continue
                e = sub(b, a); h = cross(tris[i][3], e)
                if dot(h, sub(pi, a)) * dot(h, sub(pj, a)) < 0: parent[find(i)] = find(j)
    buckets = {}
    for i, (k, t, V, n, d, A) in enumerate(tris): buckets.setdefault((round(n[0] * 1000), round(n[1] * 1000), round(n[2] * 1000), round(d * 1000)), []).append(i)
    facing = lambda i, j: dot(tris[i][3], tris[j][3]) < -1 + 1e-6 and abs(tris[i][4] + tris[j][4]) < plane
    overlap, seen, cover, floor = {}, set(), {}, {}
    for key, ks in buckets.items():
        if only is not None and key not in only: continue
        near = [i for sg in (1, -1) for dx in (-1, 0, 1) for dy in (-1, 0, 1) for dz in (-1, 0, 1) for dd in (-1, 0, 1)
                for i in buckets.get((sg * key[0] + dx, sg * key[1] + dy, sg * key[2] + dz, sg * key[3] + dd), ())]
        if len(near) < 2: continue
        ax = max(range(3), key=lambda q: abs(key[q])); u, v = (ax + 1) % 3, (ax + 2) % 3
        flat = lambda i: [(p[u], p[v]) for p in tris[i][2]]
        grid, cell = {}, 0.25
        for j in near:
            f = flat(j)
            for gx in range(int(min(p[0] for p in f) // cell), int(max(p[0] for p in f) // cell) + 1):
                for gy in range(int(min(p[1] for p in f) // cell), int(max(p[1] for p in f) // cell) + 1): grid.setdefault((gx, gy), []).append(j)
        for i in ks:
            fi = flat(i); cand = set()
            for gx in range(int(min(p[0] for p in fi) // cell), int(max(p[0] for p in fi) // cell) + 1):
                for gy in range(int(min(p[1] for p in fi) // cell), int(max(p[1] for p in fi) // cell) + 1): cand.update(grid.get((gx, gy), ()))
            for j in cand:
                if j == i or (min(i, j), max(i, j)) in seen: continue
                both = same(i, j)
                if not both and not facing(i, j): continue
                seen.add((min(i, j), max(i, j)))
                fj = flat(j)
                if max(p[0] for p in fj) <= min(p[0] for p in fi) or min(p[0] for p in fj) >= max(p[0] for p in fi) or max(p[1] for p in fj) <= min(p[1] for p in fi) or min(p[1] for p in fj) >= max(p[1] for p in fi): continue
                if (fi[1][0] - fi[0][0]) * (fi[2][1] - fi[0][1]) - (fi[1][1] - fi[0][1]) * (fi[2][0] - fi[0][0]) < 0: fi2 = [fi[0], fi[2], fi[1]]
                else: fi2 = fi
                if (fj[1][0] - fj[0][0]) * (fj[2][1] - fj[0][1]) - (fj[1][1] - fj[0][1]) * (fj[2][0] - fj[0][0]) < 0: fj = [fj[0], fj[2], fj[1]]
                ov = clipped_area(fi2, fj)
                if ov > least and both:
                    a, b = sorted((find(i), find(j)))
                    if a != b: overlap[(a, b)] = overlap.get((a, b), 0.0) + ov
                elif ov > least:
                    mid = lambda q: tuple(sum(p[c] for p in tris[q][2]) / 3 for c in range(3))
                    q = i if dot(tris[i][3], sub(eye, mid(i))) < dot(tris[j][3], sub(eye, mid(j))) else j
                    if abs(tris[q][3][1]) > 1 - 1e-6 and abs(mid(q)[1]) < plane:
                        q = i if tris[i][3][1] < 0 else j; floor[find(q)] = floor.get(find(q), 0.0) + ov
                    else: cover[find(q)] = cover.get(find(q), 0.0) + ov
    area, first = {}, {}
    for i, tr in enumerate(tris): r = find(i); area[r] = area.get(r, 0.0) + tr[5]; first.setdefault(r, i)
    away = {r for r, c in cover.items() if c / area[r] > 0.999}
    sunk = {r for r, c in floor.items() if c / area[r] > 0.999}
    if sunk:
        xz = lambda q: [(p[0], p[2]) for p in tris[q][2]]
        wind = lambda f: f if (f[1][0] - f[0][0]) * (f[2][1] - f[0][1]) - (f[1][1] - f[0][1]) * (f[2][0] - f[0][0]) >= 0 else [f[0], f[2], f[1]]
        roof, cell = {}, 0.25
        for q, tr in enumerate(tris):
            if tr[3][1] > 1 - 1e-6 and plane < tr[2][0][1] <= 0.05:
                f = xz(q)
                for gx in range(int(min(p[0] for p in f) // cell), int(max(p[0] for p in f) // cell) + 1):
                    for gy in range(int(min(p[1] for p in f) // cell), int(max(p[1] for p in f) // cell) + 1): roof.setdefault((gx, gy), []).append(q)
        hid = {}
        for q, tr in enumerate(tris):
            r = find(q)
            if r not in sunk: continue
            f = wind(xz(q)); near = set()
            for gx in range(int(min(p[0] for p in f) // cell), int(max(p[0] for p in f) // cell) + 1):
                for gy in range(int(min(p[1] for p in f) // cell), int(max(p[1] for p in f) // cell) + 1): near.update(roof.get((gx, gy), ()))
            hid[r] = hid.get(r, 0.0) + min(tr[5], sum(clipped_area(f, wind(xz(u))) for u in sorted(near)))
        sunk = {r for r in sunk if hid.get(r, 0.0) / area[r] < 0.999}
    key = lambda r: (area[r], first[r])
    over, drop, twin = {}, set(sunk), {}
    for (a, b), ov in sorted(overlap.items()):
        if ov / area[a] > 0.999 and ov / area[b] > 0.999:
            gone = min(a, b, key=lambda r: (round(tris[first[r]][4], 6), first[r])); drop.add(gone); twin[gone] = b if gone == a else a; continue
        top, base = sorted((a, b), key=key)
        over.setdefault(top, set()).add(base)
    def kept(q):
        while q in drop and q in twin: q = twin[q]
        return q
    under = lambda r: tris[first[r]][3][1] < -1 + 1e-6 and abs(tris[first[r]][4]) < plane
    shift, level = {r: lift for r in away if r not in drop}, {}
    for _ in range(len(over) + 1):
        changed = False
        for r in sorted(over, key=key, reverse=True):
            if r in drop or under(r): continue
            bases = sorted({kept(q) for q in over[r]} - {r})
            if not bases: continue
            s = max(lift if r in away else 0.0, max(tris[first[q]][4] + shift.get(q, 0.0) for q in bases) + lift - tris[first[r]][4])
            lv = 1 + max(level.get(q, 0) for q in bases)
            if abs(s - shift.get(r, 0.0)) > 1e-9 or lv != level.get(r): shift[r], level[r], changed = s, lv, True
        if not changed: break
    moved = {}
    for i, (k, t, V, n, d, A) in enumerate(tris):
        r = find(i)
        if r in drop: moved.setdefault(k, {})[t] = None
        elif shift.get(r, 0.0) > 0: moved.setdefault(k, {})[t] = (r, tuple(shift[r] * c for c in n))
    stats = {'lifted': sum(1 for m in moved.values() for x in m.values() if x), 'dropped': sum(1 for m in moved.values() for x in m.values() if x is None),
             'surfaces': len(level), 'levels': max(level.values(), default=0), 'deepest_mm': round(1000 * max(shift.values(), default=0.0), 2), 'backs': len(away - drop), 'loose': len(cover) - len(away), 'floor': len(sunk), 'area': round(sum(overlap.values()), 3)}
    for k, change in moved.items():
        pr = prims[k]; p, M, P, I = pr['p'], pr['M'], pr['P'], pr['I']
        A3 = [[M[r][c] for c in range(3)] for r in range(3)]
        det = dot(A3[0], cross(A3[1], A3[2]))
        inv = [[(A3[(c + 1) % 3][(r + 1) % 3] * A3[(c + 2) % 3][(r + 2) % 3] - A3[(c + 1) % 3][(r + 2) % 3] * A3[(c + 2) % 3][(r + 1) % 3]) / det for c in range(3)] for r in range(3)]
        attrs = {name: accessor(js, bin_, i) for name, i in p['attributes'].items()}
        rows = {name: list(raw) for name, (fmt, raw) in attrs.items()}
        fresh, idx = {}, []
        for t in range(len(I) // 3):
            if t in change and change[t] is None: continue
            for v in I[3 * t:3 * t + 3]:
                if t not in change: idx.append(v); continue
                r, w = change[t]
                if (v, r) not in fresh:
                    fresh[(v, r)] = len(rows['POSITION'])
                    loc = [sum(inv[q][c] * w[c] for c in range(3)) for q in range(3)]
                    for name, (fmt, raw) in attrs.items(): rows[name].append(struct.pack(fmt, *[P[v][q] + loc[q] for q in range(3)]) if name == 'POSITION' else raw[v])
                idx.append(fresh[(v, r)])
        if fresh:
            for name, (fmt, raw) in attrs.items(): p['attributes'][name] = append(js, bin_, rows[name], fmt, js['accessors'][p['attributes'][name]], 34962)
        ct = 5125 if len(rows['POSITION']) > 65535 else 5123
        like = dict(js['accessors'][p['indices']]) if 'indices' in p else {'type': 'SCALAR'}
        like['componentType'] = ct
        p['indices'] = append(js, bin_, [struct.pack('<' + COMP[ct], x) for x in idx], '<' + COMP[ct], like, 34963)
    glb_write(dst, js, bin_)
    near = {(sg * a + x, sg * b + y, sg * c + z, sg * e + w) for i, (k, t, V, n, d, A) in enumerate(tris) if shift.get(find(i), 0.0) > 0 and find(i) not in drop
            for a, b, c, e in [(round(n[0] * 1000), round(n[1] * 1000), round(n[2] * 1000), round((d + shift[find(i)]) * 1000))]
            for sg in (1, -1) for x in (-1, 0, 1) for y in (-1, 0, 1) for z in (-1, 0, 1) for w in (-1, 0, 1)}
    return stats, near

def run(*cmd):
    r = subprocess.run(cmd, env=ENV, capture_output=True, text=True)
    if r.returncode: sys.exit('FAILED %s\n%s' % (' '.join(cmd), r.stdout + r.stderr))

def pack(room):
    src, dst = f'{ROOT}/assets-src/{room}', f'{ROOT}/public/assets/{room}'
    # These static hologram inputs are tracked, not regenerated by a remote room bake.
    # Reject an incomplete staging tree before touching a working preview.
    if room == 'lobby':
        for name in ('landmask.png', 'citylights.png'):
            if not os.path.isfile(f'{src}/tex/{name}'):
                sys.exit(f'Missing Atrium hologram input: {src}/tex/{name}. Include the tracked PNGs before packing.')
    with open(f'{src}/scene.json') as f: info = json.load(f)
    if info.get('room') != room or not os.path.isfile(f'{src}/room.glb'): sys.exit(f'Incomplete {room} geometry or manifest')
    needed = set(info['groups'])
    if info.get('portal'): needed.add('backdrop')
    for group in info.get('chand',{}).get('layered',[]):
        needed.update(f'{group}_c{i}' for i in range(len(info['chand']['phases'])))
    for group in info.get('spin',{}).get('layered',[]):
        needed.add(group+'_a'); needed.update(f'{group}_s{i}' for i in range(info['spin']['phases']))
    rgba = set()                                                      # outputs that keep a fourth channel
    if 'finish' in info:
        # Live reflections: every surface needs its finish atlas and the room its probes. Bakes made
        # before this were evaluated from the hero camera; never mix the two kinds of master.
        if not os.path.isfile(f'{src}/probe.json'): sys.exit(f'{room}: render blender/reflection_probe.py for this bake')
        with open(f'{src}/probe.json') as f: probe = json.load(f)
        if probe.get('alpha') != 'interior' or not probe.get('probes'): sys.exit(f'{room}: probe.json predates the live-reflection format')
        missing = set(info['groups']) - set(info['finish']['groups']) - {g for g in info['groups'] if g.startswith('floor')}
        if missing: sys.exit(f'{room}: no finish atlas for {sorted(missing)}')
        needed.update(f'{g}_f' for g in info['finish']['groups']); rgba.update(f'{g}_f' for g in info['finish']['groups'])
        info['probe'] = dict(probe, groups=sorted(g for g in info['groups'] if not g.startswith('floor')), layout='mips'); rgba.add('probe_c')
    elif 'polish' in needed and 'probe' not in info: sys.exit(f'{room}: polished fittings have no reflection probe')
    if 'probe' in info:
        p = info['probe']
        if not set(p['groups']) <= set(info['groups']): sys.exit(f'{room}: unrecognised polished group')
        if p['roughness'] != [0,.25,.5,.75,1] or p['encoding'] != 'sqrt': sys.exit(f'{room}: unsupported probe encoding or roughness levels')
        needed.update(f'probe_c{i}' for i in range(len(p['roughness']) * len(p.get('probes', [0]))))
    for n in sorted(needed):
        if not os.path.isfile(f'{src}/tex/{n}.webp'): sys.exit(f'Missing {room} bake input: {n}.webp')
    # Do not take a working room offline while the encoders run (or if one fails).
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f'.pack-{room}-', dir=os.path.dirname(dst)) as stage:
        new = f'{stage}/new'; os.makedirs(f'{new}/tex')
        with tempfile.TemporaryDirectory() as tmp: encode(room, src, new, tmp, needed, rgba, info)
        old = f'{stage}/old'
        if os.path.isdir(dst): os.rename(dst,old)
        try: os.rename(new,dst)
        except BaseException:
            if os.path.isdir(old): os.rename(old,dst)
            raise

def encode(room, src, dst, tmp, needed, rgba, info):
    src_dir = f'{src}/tex'
    jobs = {}                                                        # output name -> (kind, [source images, in layer order])
    for f in sorted(os.listdir(f'{src}/tex')):
        name, ext = os.path.splitext(f)
        if room == 'lobby' and f in {'landmask.png', 'citylights.png'}:
            shutil.copy(f'{src}/tex/{f}', f'{dst}/tex/{f}'); continue
        if ext != '.webp' or name not in needed: continue  # stale layers are not part of this room version
        m = re.fullmatch(r'(.+)_([cs])(\d+)', name)
        if m: jobs.setdefault(f'{m[1]}_{m[2]}', ('layers', []))[1].append(name)
        else: jobs[name] = ('albedo' if name.endswith('_a') or name.endswith('_f') else 'backdrop' if name == 'backdrop' else 'base', [name])   # _f: smooth shader data, ETC1S
    for kind, names in jobs.values():                                # layer k is image k: 'probe_c10' sorts before 'probe_c2'
        names.sort(key=lambda n: int(re.search(r'(\d+)$', n)[1]) if kind == 'layers' else 0)
        if kind == 'layers' and [int(re.search(r'(\d+)$', n)[1]) for n in names] != list(range(len(names))): sys.exit(f'{room}: layers {names} are not 0..n-1')
    def one(item):
        out, (kind, names) = item
        pngs = []
        if out == 'probe_c' and info.get('probe', {}).get('layout') == 'mips':
            # One array layer per probe; mip k holds roughness k/4 at half the size of k-1, so a shader gets any
            # roughness in ONE trilinear fetch. Below the roughest level the chain repeats it, shrinking to 1 px.
            p = info['probe']; w, h = p['width'], p['height']; n = len(p['probes']); per = len(p['roughness'])
            levels = max(w, h).bit_length()
            for lv in range(levels):
                for k in range(n):
                    layer = names[k * per + min(lv, per - 1)]; png = f'{tmp}/{layer}-{lv}.png'; pngs.append(png)
                    run(DWEBP, '-quiet', '-scale', str(max(1, w >> lv)), str(max(1, h >> lv)), f'{src_dir}/{layer}.webp', '-o', png)
            run(KTX, 'create', '--format', 'R8G8B8A8_UNORM', '--assign-tf', 'linear', '--layers', str(n), '--levels', str(levels), *UASTC, *pngs, f'{dst}/tex/{out}.ktx2')
            return
        for n in names:
            pngs.append(f'{tmp}/{n}.png')                            # the backdrop is the only image stored top row first
            run(DWEBP, '-quiet', *(['-flip'] if kind == 'backdrop' else []), f'{src}/tex/{n}.webp', '-o', pngs[-1])
        run(KTX, 'create', '--format', 'R8G8B8A8_UNORM' if out in rgba else 'R8G8B8_UNORM', '--assign-tf', 'linear', '--generate-mipmap',
            *(['--layers', str(len(pngs))] if kind == 'layers' else []), *(ETC1S if kind == 'albedo' else UASTC), *pngs, f'{dst}/tex/{out}.ktx2')
    with ThreadPoolExecutor(3) as ex: list(ex.map(one, jobs.items()))
    # geometry: keep node names, extras and unused attributes (lightmap UVs, vertex colours); lightmap UVs stay floats (quantized ones need a texture transform that our materials do not have)
    with open(f'{dst}/scene.json', 'w') as f: json.dump(info, f, indent=1)   # including the current probe.json
    print(room, 'coplanar surfaces', json.dumps(separate(f'{src}/room.glb', f'{tmp}/room.glb')), flush=True)
    run(GLTFPACK, '-i', f'{tmp}/room.glb', '-o', f'{dst}/room.glb', '-cc', '-kn', '-ke', '-km', '-kv', '-vp', '16', '-vtf', '-vn', '10', '-vc', '12')
    size = lambda d: sum(os.path.getsize(os.path.join(p, f)) for p, _, fs in os.walk(d) for f in fs) / 1e6
    print('%-11s %5.1f MB -> %5.1f MB   (%d files -> %d)' % (room, size(src), size(dst), sum(len(f) for *_, f in os.walk(src)), sum(len(f) for *_, f in os.walk(dst))), flush=True)

if __name__ == '__main__':
    for room in sys.argv[1:] or sorted(os.listdir(f'{ROOT}/assets-src')): pack(room)