#!/usr/bin/env python3
# Report of the coplanar overlapping triangles and exact duplicates in the geometry of a room
import json, math, multiprocessing, os, struct, sys

COMP = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
PLANE, LEAST, CELL, EYES = 1e-3, 1e-6, 0.25, (1.2, 1.6, 1.9)


def read(path):
    with open(path, 'rb') as f: b = f.read()
    if b[:4] != b'glTF': sys.exit(f'{path}: not a binary glTF')
    jl = struct.unpack_from('<I', b, 12)[0]; js = json.loads(b[20:20 + jl]); o = 20 + jl
    bl = struct.unpack_from('<I', b, o)[0] if o + 8 <= len(b) else 0
    return js, b[o + 8:o + 8 + bl]


def values(js, bin_, i):
    a = js['accessors'][i]
    if 'sparse' in a or 'bufferView' not in a: sys.exit('sparse or empty accessors are not supported')
    v = js['bufferViews'][a['bufferView']]; fmt = '<' + COMP[a['componentType']] * WIDTH[a['type']]; size = struct.calcsize(fmt)
    stride, o = v.get('byteStride') or size, v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from(fmt, bin_, o + k * stride) for k in range(a['count'])]


def matrix(n):
    if 'matrix' in n: m = n['matrix']; return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    (x, y, z, w), s, t = n.get('rotation', [0, 0, 0, 1]), n.get('scale', [1, 1, 1]), n.get('translation', [0, 0, 0])
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[r][0] * s[0], R[r][1] * s[1], R[r][2] * s[2], t[r]] for r in range(3)] + [[0, 0, 0, 1]]


def eyes(js):
    info = js['scenes'][js.get('scene', 0)].get('extras', {}).get('lobby', {})
    pts = [info[k] for k in ('cam', 'close') if k in info] + [v['pos'] for v in info.values() if isinstance(v, dict) and isinstance(v.get('pos'), list) and len(v['pos']) == 3]
    pts += [[d['c'][0] + d['n'][0] * 1.2, d['c'][1] + d['n'][1] * 1.2, d['c'][2] + 0.4] for d in info.get('doors', []) if 'c' in d and 'n' in d]
    far = 1.25 / math.tan(math.radians(info.get('fov', 50)) / 2)
    for f in info.get('focus', []):
        d = f['dir']; l = dot(d, d) ** 0.5
        pts.append([f['c'][q] + d[q] / l * f['r'] * far for q in range(3)])
    return [(p[0], p[2], -p[1]) for p in pts]


def height(V, x, z):
    (ax, _, az), (bx, _, bz), (cx, _, cz) = V
    det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
    if abs(det) < 1e-12: return None
    u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det; v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det
    if min(u, v, 1 - u - v) < 0: return None
    return u * V[0][1] + v * V[1][1] + (1 - u - v) * V[2][1]


def standing(rays, tris, views, across=5, along=9):
    floor = [t[1] for t in tris if t[0].startswith('floor')]
    if not floor: return []
    xs = [p[0] for V in floor for p in V]; zs = [p[2] for V in floor for p in V]
    out = []
    for (ox, oz), (i, j), eye in ((o, (i, j), e) for o in ((0.5, 0.5), (0.81, 0.93)) for i in range(across + 1) for j in range(along + 1) for e in EYES):
        u, v = (i + ox) / (across + 0.5), (j + oz) / (along + 0.5)
        if u >= 1 or v >= 1: continue
        x = min(xs) + (max(xs) - min(xs)) * u; z = min(zs) + (max(zs) - min(zs)) * v
        h = [y for y in (height(V, x, z) for V in floor) if y is not None]
        if not h: continue
        e = (x, max(h) + eye, z)
        if views and not rays.sees(e, (0, 0, 0), views[0], set(), True): continue
        if rays.blocked(e, (0, -1, 0), set(), eye - 1.1) or any(rays.blocked(e, d, set(), 0.3) for d in ((1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1), (0, 1, 0))): continue
        out.append(e)
    return out


def triangles(path):
    js, bin_ = read(path)
    out = []
    def walk(i, M):
        n = js['nodes'][i]; L = matrix(n); W = [[sum(M[r][k] * L[k][c] for k in range(4)) for c in range(4)] for r in range(4)]
        if 'mesh' in n:
            name = n.get('name', js['meshes'][n['mesh']].get('name', '?'))
            for p in js['meshes'][n['mesh']]['primitives']:
                if p.get('mode', 4) != 4: continue
                P = [tuple(W[r][0] * q[0] + W[r][1] * q[1] + W[r][2] * q[2] + W[r][3] for r in range(3)) for q in values(js, bin_, p['attributes']['POSITION'])]
                I = [v[0] for v in values(js, bin_, p['indices'])] if 'indices' in p else list(range(len(P)))
                for t in range(len(I) // 3): out.append((name, P[I[3 * t]], P[I[3 * t + 1]], P[I[3 * t + 2]]))
        for c in n.get('children', []): walk(c, W)
    for r in js['scenes'][js.get('scene', 0)]['nodes']: walk(r, [[float(a == b) for b in range(4)] for a in range(4)])
    return out, eyes(js)


def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def ccw(f): return f if (f[1][0] - f[0][0]) * (f[2][1] - f[0][1]) - (f[1][1] - f[0][1]) * (f[2][0] - f[0][0]) >= 0 else [f[0], f[2], f[1]]


def shared(t1, t2):
    poly = list(t2)
    for i in range(3):
        a, b, out = t1[i], t1[(i + 1) % 3], []
        side = lambda p: (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        for k in range(len(poly)):
            p, q = poly[k], poly[(k + 1) % len(poly)]; sp, sq = side(p), side(q)
            if sp >= 0: out.append(p)
            if (sp >= 0) != (sq >= 0): u = sp / (sp - sq); out.append((p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])))
        poly = out
        if len(poly) < 3: return 0.0, poly
    return abs(sum(poly[k][0] * poly[(k + 1) % len(poly)][1] - poly[(k + 1) % len(poly)][0] * poly[k][1] for k in range(len(poly)))) / 2, poly


def lift(p, ax, u, v, t):
    n, d = t[4], t[5] * t[3]
    q = [0.0, 0.0, 0.0]; q[u], q[v] = p[0], p[1]; q[ax] = (d - n[u] * p[0] - n[v] * p[1]) / n[ax]
    return tuple(q)


class Rays:
    def __init__(self, tris, cell=0.25):
        self.t, self.cell, self.grid = tris, cell, {}
        for i, (name, V, *_rest) in enumerate(tris):
            lo = [int(min(p[q] for p in V) // cell) for q in range(3)]; hi = [int(max(p[q] for p in V) // cell) for q in range(3)]
            for x in range(lo[0], hi[0] + 1):
                for y in range(lo[1], hi[1] + 1):
                    for z in range(lo[2], hi[2] + 1): self.grid.setdefault((x, y, z), []).append(i)
        self.pre = [(V[0], sub(V[1], V[0]), sub(V[2], V[0])) for _, V, *_rest in tris]
        self.lo = [min(k[q] for k in self.grid) for q in range(3)]; self.hi = [max(k[q] for k in self.grid) for q in range(3)]

    def blocked(self, o, d, skip, far):
        c = self.cell; cur = [int(o[q] // c) for q in range(3)]
        step = [1 if d[q] > 0 else -1 for q in range(3)]
        tmax = [((cur[q] + (step[q] > 0)) * c - o[q]) / d[q] if abs(d[q]) > 1e-12 else 1e30 for q in range(3)]
        tdel = [c / abs(d[q]) if abs(d[q]) > 1e-12 else 1e30 for q in range(3)]
        lo, hi, grid, pre, tested = self.lo, self.hi, self.grid, self.pre, set()
        dx, dy, dz = d; ox, oy, oz = o
        while lo[0] - 1 <= cur[0] <= hi[0] + 1 and lo[1] - 1 <= cur[1] <= hi[1] + 1 and lo[2] - 1 <= cur[2] <= hi[2] + 1 and min(tmax) - min(tdel) < far:
            for i in grid.get(tuple(cur), ()):
                if i in tested or i in skip: continue
                tested.add(i); (vx, vy, vz), (ax, ay, az), (bx, by, bz) = pre[i]
                hx, hy, hz = dy * bz - dz * by, dz * bx - dx * bz, dx * by - dy * bx
                a = ax * hx + ay * hy + az * hz
                if -1e-14 < a < 1e-14: continue
                f = 1 / a; sx, sy, sz = ox - vx, oy - vy, oz - vz
                uu = f * (sx * hx + sy * hy + sz * hz)
                if uu < 0 or uu > 1: continue
                qx, qy, qz = sy * az - sz * ay, sz * ax - sx * az, sx * ay - sy * ax
                vv = f * (dx * qx + dy * qy + dz * qz)
                if vv < 0 or uu + vv > 1: continue
                if 1e-7 < f * (bx * qx + by * qy + bz * qz) < far: return i
            m = 0 if tmax[0] <= tmax[1] and tmax[0] <= tmax[2] else 1 if tmax[1] <= tmax[2] else 2
            cur[m] += step[m]; tmax[m] += tdel[m]
        return None

    def hits(self, i, o, d, far):
        (vx, vy, vz), (ax, ay, az), (bx, by, bz) = self.pre[i]; dx, dy, dz = d
        hx, hy, hz = dy * bz - dz * by, dz * bx - dx * bz, dx * by - dy * bx
        a = ax * hx + ay * hy + az * hz
        if -1e-14 < a < 1e-14: return False
        f = 1 / a; sx, sy, sz = o[0] - vx, o[1] - vy, o[2] - vz
        uu = f * (sx * hx + sy * hy + sz * hz)
        if uu < 0 or uu > 1: return False
        qx, qy, qz = sy * az - sz * ay, sz * ax - sx * az, sx * ay - sy * ax
        vv = f * (dx * qx + dy * qy + dz * qz)
        return vv >= 0 and uu + vv <= 1 and 1e-7 < f * (bx * qx + by * qy + bz * qz) < far

    def sees(self, p, n, eye, skip, free=False, last=None):
        o = tuple(p[q] + 2e-4 * n[q] for q in range(3)); d = sub(eye, o); l = dot(d, d) ** 0.5
        if l < 1e-6 or (dot(d, n) <= 0 and not free): return False
        d = (d[0] / l, d[1] / l, d[2] / l)
        if last and any(self.hits(k, o, d, l) for k in last): return False
        k = self.blocked(o, d, skip, l)
        if k is not None and last is not None: last.insert(0, k); del last[4:]
        return k is None


def visible(rays, poly, n, skip, eyes, last=None):
    c = tuple(sum(p[q] for p in poly) / len(poly) for q in range(3))
    pts = [c] + [tuple(c[q] + 0.8 * (p[q] - c[q]) for q in range(3)) for p in poly[:4]]
    last = [] if last is None else last
    return any(rays.sees(p, n, e, skip, last=last) for e in eyes for p in pts)


def blender(p): return (round(p[0], 3), round(-p[2], 3), round(p[1], 3))


SHARED = {}


def judge(chunk):
    rays, views, tris = SHARED['rays'], SHARED['views'], SHARED['tris']
    out = []
    for (i, j), (ov, poly) in chunk:
        last = []
        out.append(visible(rays, poly, tris[i][4], {i, j}, views, last) or (dot(tris[i][4], tris[j][4]) < 0 and visible(rays, poly, tris[j][4], {i, j}, views, last)))
    return out


def check(path):
    tris, dups, seen = [], [], {}
    found_tris, views = triangles(path)
    for name, a, b, c in found_tris:
        n = cross(sub(b, a), sub(c, a)); l = dot(n, n) ** 0.5
        if l < 1e-12: continue
        n = (n[0] / l, n[1] / l, n[2] / l)
        key = tuple(sorted(tuple(round(v, 4) for v in p) for p in (a, b, c)))
        if key in seen:
            j = seen[key]; m = tuple(sum(p[q] for p in (a, b, c)) / 3 for q in range(3))
            dups.append((tris[j][0], name, 'same' if dot(tris[j][4], n) > 0 else 'opposite', blender(m), l / 2, m, n))
            continue
        seen[key] = len(tris)
        ax = max(range(3), key=lambda q: abs(n[q])); s = 1 if n[ax] > 0 else -1
        tris.append((name, (a, b, c), ax, s, n, s * dot(n, a), l / 2))
    planes = {}
    for i, t in enumerate(tris):
        n, s = t[4], t[3]
        planes.setdefault((t[2], round(s * n[0] * 1000), round(s * n[1] * 1000), round(s * n[2] * 1000), round(t[5] * 1000)), []).append(i)
    found = {}
    for key, ks in planes.items():
        ax, kx, ky, kz, kd = key
        near = [j for dx in (-1, 0, 1) for dy in (-1, 0, 1) for dz in (-1, 0, 1) for dd in (-1, 0, 1) for j in planes.get((ax, kx + dx, ky + dy, kz + dz, kd + dd), ())]
        if len(near) < 2: continue
        u, v = (ax + 1) % 3, (ax + 2) % 3
        flat = lambda i: [(p[u], p[v]) for p in tris[i][1]]
        grid = {}
        for j in near:
            f = flat(j)
            for gx in range(int(min(p[0] for p in f) // CELL), int(max(p[0] for p in f) // CELL) + 1):
                for gy in range(int(min(p[1] for p in f) // CELL), int(max(p[1] for p in f) // CELL) + 1): grid.setdefault((gx, gy), set()).add(j)
        for i in ks:
            fi = flat(i); cand = set()
            for gx in range(int(min(p[0] for p in fi) // CELL), int(max(p[0] for p in fi) // CELL) + 1):
                for gy in range(int(min(p[1] for p in fi) // CELL), int(max(p[1] for p in fi) // CELL) + 1): cand |= grid.get((gx, gy), set())
            for j in cand:
                if j <= i and j in ks: continue
                pair = (min(i, j), max(i, j))
                if pair in found: continue
                ti, tj = tris[i], tris[j]
                if abs(abs(dot(ti[4], tj[4])) - 1) > 1e-5 or max(abs(dot(ti[4], sub(p, ti[1][0]))) for p in tj[1]) > PLANE: continue
                fj = flat(j)
                if max(p[0] for p in fj) <= min(p[0] for p in fi) or min(p[0] for p in fj) >= max(p[0] for p in fi) or max(p[1] for p in fj) <= min(p[1] for p in fi) or min(p[1] for p in fj) >= max(p[1] for p in fi): continue
                ov, poly = shared(ccw(fi), ccw(fj))
                if ov > LEAST: found[pair] = (ov, [lift(p, ax, u, v, ti) for p in poly])
    rays = Rays(tris); views = views + standing(rays, tris, views)
    lying, backs = [], []
    SHARED.update(rays=rays, views=views, tris=tris)
    items = list(found.items()); chunks = [items[k:k + 400] for k in range(0, len(items), 400)]
    if len(chunks) > 1:
        with multiprocessing.get_context('fork').Pool(min(len(chunks), os.cpu_count() or 1)) as pool: seen = [x for part in pool.map(judge, chunks) for x in part]
    else: seen = [x for part in map(judge, chunks) for x in part]
    for ((i, j), (ov, poly)), shown in zip(items, seen):
        if not shown: continue
        ti, tj = tris[i], tris[j]
        c = blender(tuple(sum(p[q] for p in poly) / len(poly) for q in range(3)))
        (lying if dot(ti[4], tj[4]) > 0 else backs).append((ti[0], tj[0], c, ov))
    dups = [x for x in dups if visible(rays, [x[5]], x[6], set(), views) or visible(rays, [x[5]], tuple(-c for c in x[6]), set(), views)]
    return dict(eyes=[blender(e) for e in views], triangles=len(tris) + len(dups), duplicates=[x[:5] for x in dups], lying=lying, backs=backs)


def faults(found): return len(found['lying']) + len(found['backs']) + len(found['duplicates'])


def summary(found, top):
    def by(items, area):
        g = {}
        for it in items:
            k = tuple(sorted((it[0], it[1]))); e = g.setdefault(k, [0, 0.0, it[-2]]); e[0] += 1; e[1] += it[area]
        return [dict(meshes=list(k), pairs=v[0], area_cm2=round(v[1] * 1e4, 2), at=list(v[2])) for k, v in sorted(g.items(), key=lambda kv: -kv[1][1])[:top]]
    return dict(eyes=found['eyes'], triangles=found['triangles'], duplicates=len(found['duplicates']), duplicates_same_facing=sum(1 for d in found['duplicates'] if d[2] == 'same'),
                lying=len(found['lying']), lying_cm2=round(sum(x[3] for x in found['lying']) * 1e4, 2), backs=len(found['backs']), backs_cm2=round(sum(x[3] for x in found['backs']) * 1e4, 2),
                worst_duplicates=by([(a, b, c, A) for a, b, f, c, A in found['duplicates']], 3), worst_lying=by(found['lying'], 3), worst_backs=by(found['backs'], 3))


if __name__ == '__main__':
    args = sys.argv[1:]; top = 12
    if args[:1] == ['--top']: top = int(args[1]); args = args[2:]
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets-src')
    over = []
    for room in args or sorted(os.listdir(root)):
        path = room if room.endswith('.glb') else os.path.join(root, room, 'room.glb')
        found = check(path); print(json.dumps(dict(room=room, faults=faults(found), **summary(found, top))), flush=True)
        if faults(found): over.append(room)
    if over: sys.exit(f'overlapping or duplicate faces: {" ".join(over)}')
