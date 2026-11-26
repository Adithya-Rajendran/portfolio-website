"""Tests for tools/pack.py: the separation of coplanar surfaces, what each room's textures are packed into, and js/ktx2small.js. python3 -m unittest tools/test_pack.py"""
import importlib.util, json, math, os, struct, tempfile, unittest

TOOLS = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('pack', os.path.join(TOOLS, 'pack.py'))
pack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack)


def quad(x0, y0, x1, y1, z=0.0, up=True):
    v = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]
    return v, ([0, 1, 2, 0, 2, 3] if up else [0, 2, 1, 0, 3, 2]), (0, 0, 1 if up else -1)


def flat(part, h=0.0):
    v, t, n = part
    return [(x, z + h, -y) for x, y, z in v], t, (n[0], n[2], -n[1])


def build(path, parts, cam=None, node=None):
    pos, nrm, uv, idx = [], [], [], []
    for verts, tri, n in parts:
        base = len(pos)
        for p in verts: pos.append(p); nrm.append(n); uv.append((p[0] * 0.1 + len(idx) * 0.01, p[1] * 0.1))
        idx += [base + i for i in tri]
    blobs = [b''.join(struct.pack('<fff', *p) for p in pos), b''.join(struct.pack('<fff', *n) for n in nrm),
             b''.join(struct.pack('<ff', *t) for t in uv), b''.join(struct.pack('<H', i) for i in idx)]
    views, off, bin_ = [], 0, b''
    for b in blobs:
        b += bytes(-len(b) % 4); views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b)}); bin_ += b; off += len(b)
    js = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [dict({'mesh': 0, 'name': 'arch', 'extras': {'grp': 'archC'}}, **(node or {}))],
          'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3}]}],
          'buffers': [{'byteLength': len(bin_)}], 'bufferViews': views,
          'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
                         'min': [min(p[i] for p in pos) for i in range(3)], 'max': [max(p[i] for p in pos) for i in range(3)]},
                        {'bufferView': 1, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3'},
                        {'bufferView': 2, 'componentType': 5126, 'count': len(pos), 'type': 'VEC2'},
                        {'bufferView': 3, 'componentType': 5123, 'count': len(idx), 'type': 'SCALAR'}]}
    if cam: js['scenes'][0]['extras'] = {'lobby': {'cam': [cam[0], -cam[2], cam[1]]}}
    pack.glb_write(path, js, bytearray(bin_))


def pole(x, z, r=0.02, y0=0.04, y1=0.92, sides=40):
    parts = []
    for s in range(sides):
        a, b = 2 * math.pi * s / sides, 2 * math.pi * (s + 1) / sides
        v = [(x + r * math.cos(a), y0, z + r * math.sin(a)), (x + r * math.cos(b), y0, z + r * math.sin(b)), (x + r * math.cos(b), y1, z + r * math.sin(b)), (x + r * math.cos(a), y1, z + r * math.sin(a))]
        m = (a + b) / 2; parts.append((v, [0, 2, 1, 0, 3, 2], (math.cos(m), 0, math.sin(m))))
    return parts


def triangles(path):
    js, bin_ = pack.glb_read(path)
    p = js['meshes'][0]['primitives'][0]
    fmt, raw = pack.accessor(js, bin_, p['attributes']['POSITION']); P = [struct.unpack(fmt, r) for r in raw]
    fmt, raw = pack.accessor(js, bin_, p['attributes']['TEXCOORD_0']); U = [struct.unpack(fmt, r) for r in raw]
    fmt, raw = pack.accessor(js, bin_, p['indices']); I = [struct.unpack(fmt, r)[0] for r in raw]
    return [([P[v] for v in I[t:t + 3]], [U[v] for v in I[t:t + 3]]) for t in range(0, len(I), 3)], js


class SeparateTest(unittest.TestCase):
    def run_on(self, parts, **kw):
        with tempfile.TemporaryDirectory() as d:
            build(f'{d}/a.glb', parts, kw.pop('cam', None), kw.pop('node', None))
            stats = pack.separate(f'{d}/a.glb', f'{d}/b.glb', **kw)
            before, _ = triangles(f'{d}/a.glb'); after, js = triangles(f'{d}/b.glb')
            return stats, before, after, js

    def test_lifts_the_surface_that_lies_on_another(self):
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1), quad(0.2, 0.2, 0.4, 0.8), quad(0, 0, 1, 1, z=1.0)])
        self.assertEqual(stats['lifted'], 2); self.assertEqual(stats['surfaces'], 1); self.assertEqual(stats['dropped'], 0)
        self.assertEqual(len(after), len(before))
        z = sorted({round(p[2], 6) for t, _ in after for p in t})
        self.assertEqual(z, [0.0, 0.003, 1.0])
        lifted = [t for t, _ in after if all(abs(p[2] - 0.003) < 1e-6 for p in t)]
        self.assertEqual(len(lifted), 2)
        self.assertTrue(all(0.2 - 1e-6 <= p[0] <= 0.4 + 1e-6 for t in lifted for p in t))
        self.assertEqual(sorted(map(str, (u for _, u in after))), sorted(map(str, (u for _, u in before))))
        pos = js['accessors'][js['meshes'][0]['primitives'][0]['attributes']['POSITION']]
        self.assertAlmostEqual(pos['max'][2], 1.0, places=6)

    def test_lifts_along_the_front_of_a_face_that_points_down(self):
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1, up=False), quad(0.2, 0.2, 0.4, 0.8, up=False)])
        self.assertEqual(sorted({round(p[2], 6) for t, _ in after for p in t}), [-0.003, 0.0])

    def test_drops_one_of_two_identical_faces_and_keeps_the_later(self):
        stats, before, after, js = self.run_on([quad(2, 0, 3, 1), quad(2, 0, 3, 1)])
        self.assertEqual(stats['dropped'], 2); self.assertEqual(stats['lifted'], 0)
        self.assertEqual(len(after), 2)
        self.assertEqual(sorted(map(str, (u for _, u in after))), sorted(map(str, (u for _, u in before[2:]))))

    def test_drops_one_of_two_identical_thin_poles_instead_of_opening_the_kept_one_into_slats(self):
        stats, before, after, js = self.run_on(pole(-6.6, -0.6) + pole(-6.6, -0.6), cam=(0, 1.6, 5))
        self.assertEqual((stats['lifted'], stats['dropped']), (0, 80))
        self.assertEqual(after, before[80:])

    def test_cuts_the_face_beneath_a_surface_on_the_edge_of_a_thing_instead_of_moving_it_past_the_edge(self):
        side = ([(1, 0, 0), (1, 1, 0), (1, 1, -1), (1, 0, -1)], [0, 2, 1, 0, 3, 2], (1, 0, 0))
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1), quad(0.5, 0, 1, 1), side])
        self.assertEqual((stats['held'], stats['lifted']), (1, 0))
        self.assertEqual(sorted({round(p[2], 6) for t, _ in after for p in t}), [-1.0, 0.0])
        front = [t for t, _ in after if all(abs(p[2]) < 1e-9 for p in t)]
        area = lambda t: abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1])) / 2
        self.assertAlmostEqual(sum(map(area, front)), 1.0, places=6)
        uv = [(round(u[0] - p[0] * 0.1, 6), round(u[1] - p[1] * 0.1, 6)) for t, us in after if all(abs(p[2]) < 1e-9 for p in t) for p, u in zip(t, us)]
        self.assertEqual(sorted(set(uv)), [(0.0, 0.0), (0.06, 0.0)])
        with tempfile.TemporaryDirectory() as d:
            build(f'{d}/a.glb', [quad(0, 0, 1, 1), quad(0.5, 0, 1, 1), side])
            pack.separate(f'{d}/a.glb', f'{d}/b.glb'); again = pack.separate(f'{d}/b.glb', f'{d}/c.glb')
        self.assertEqual((again['lifted'], again['dropped'], again['held'], again['cut']), (0, 0, 0, 0))

    def test_leaves_mere_neighbours_alone(self):
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1), quad(1, 0, 2, 1), quad(0, 1, 1, 2, up=False)])
        self.assertEqual(stats, {'lifted': 0, 'dropped': 0, 'surfaces': 0, 'levels': 0, 'deepest_mm': 0.0, 'backs': 0, 'loose': 0, 'floor': 0, 'held': 0, 'cut': 0, 'area': 0, 'passes': 1})
        self.assertEqual(after, before)

    def test_drops_the_underside_of_a_thing_standing_on_the_floor_instead_of_moving_it_under_the_floor_mirror(self):
        stats, before, after, js = self.run_on([flat(quad(0, 0, 1, 1)), flat(quad(0.2, 0.2, 0.6, 0.6, up=False))], cam=(0.5, 5, -0.5))
        self.assertEqual((stats['backs'], stats['floor'], stats['dropped']), (0, 1, 2))
        self.assertEqual(after, before[:2])
        stats, before, after, js = self.run_on([flat(quad(0.2, 0.2, 0.6, 0.6)), flat(quad(0, 0, 1, 1, up=False))], cam=(0.5, 5, -0.5))
        self.assertEqual((stats['floor'], stats['dropped']), (0, 0))
        self.assertEqual(after, before)

    def test_drops_the_underside_of_a_thing_under_a_table_top_the_view_sees_past(self):
        stats, before, after, js = self.run_on([flat(quad(0, 0, 1, 1)), flat(quad(0.2, 0.2, 0.6, 0.6, up=False)), flat(quad(0, 0, 1, 1), 0.7)], cam=(0.5, 5, -0.5))
        self.assertEqual((stats['floor'], stats['dropped']), (1, 2))

    def test_keeps_the_underside_of_an_inlay_whose_own_top_hides_it_from_above(self):
        stats, before, after, js = self.run_on([flat(quad(0, 0, 1, 1)), flat(quad(0.2, 0.2, 0.6, 0.6, up=False)), flat(quad(0.2, 0.2, 0.6, 0.6), 0.004)], cam=(0.5, 5, -0.5))
        self.assertEqual((stats['floor'], stats['dropped']), (0, 0))
        self.assertEqual(after, before)
        stats, before, after, js = self.run_on([flat(quad(0, 0, 1, 1), 1.0), flat(quad(0.2, 0.2, 0.6, 0.6, up=False), 1.0)], cam=(0.5, 5, -0.5))
        self.assertEqual(stats['backs'], 1)
        self.assertEqual(sorted(round(p[1], 6) for t, _ in after[2:] for p in t), [0.997] * 6)

    def test_leaves_undersides_lying_on_each_other_in_the_floor_plane(self):
        stats, before, after, js = self.run_on([flat(quad(0, 0, 1, 1, up=False)), flat(quad(0.2, 0.2, 0.6, 0.6, up=False)), flat(quad(0.3, 0.3, 0.5, 0.5, up=False), 1.0), flat(quad(0, 0, 1, 1, up=False), 1.0)])
        self.assertEqual(after[:4], before[:4])
        self.assertEqual(sorted({round(p[1], 6) for t, _ in after[4:6] for p in t}), [0.997])

    def test_leaves_a_back_face_that_reaches_past_the_face_it_lies_on(self):
        stats, before, after, js = self.run_on([quad(0.2, 0.2, 0.6, 0.6), quad(0, 0, 1, 1, up=False)], cam=(0.5, 0.5, 5))
        self.assertEqual((stats['backs'], stats['loose']), (0, 1))
        self.assertEqual(after, before)

    def test_moves_the_back_of_two_faces_that_face_each_other_away_from_the_camera(self):
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1), quad(0.2, 0.2, 0.6, 0.6, up=False)], cam=(0.5, 0.5, 5))
        self.assertEqual(stats['backs'], 1); self.assertEqual(stats['surfaces'], 0)
        z = {tuple(u[0]): round(t[0][2], 6) for t, u in after}
        self.assertEqual(sorted(set(z.values())), [-0.003, 0.0])
        self.assertEqual(sorted(round(p[2], 6) for t, _ in after[:2] for p in t), [0.0] * 6)
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1, up=False), quad(0.2, 0.2, 0.6, 0.6)], cam=(0.5, 0.5, -5))
        self.assertEqual(sorted(round(p[2], 6) for t, _ in after[:2] for p in t), [0.0] * 6)
        self.assertEqual(sorted(round(p[2], 6) for t, _ in after[2:] for p in t), [0.003] * 6)

    def test_lifts_a_surface_a_hair_behind_to_the_same_height(self):
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1), quad(0.2, 0.2, 0.4, 0.8, z=-0.0002)])
        self.assertEqual(sorted({round(p[2], 6) for t, _ in after for p in t}), [0.0, 0.003])

    def test_keeps_the_front_one_of_two_nearly_identical_faces(self):
        stats, before, after, js = self.run_on([quad(2, 0, 3, 1, z=0.0001), quad(2, 0, 3, 1)])
        self.assertEqual(stats['dropped'], 2)
        self.assertEqual({round(p[2], 6) for t, _ in after for p in t}, {0.0001})

    def test_stacks_a_third_layer_above_the_second(self):
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1), quad(0.1, 0.1, 0.9, 0.9), quad(0.3, 0.3, 0.5, 0.5)])
        self.assertEqual(sorted({round(p[2], 6) for t, _ in after for p in t}), [0.0, 0.003, 0.006])
        self.assertEqual((stats['levels'], stats['deepest_mm']), (2, 6.0))

    def test_stacks_a_surface_on_a_back_face_that_moved_away_on_top_of_its_move(self):
        parts = [quad(0, 0, 1, 1), quad(0.1, 0.1, 0.9, 0.9, up=False), quad(0.3, 0.3, 0.5, 0.5, up=False), quad(0.8, 0.1, 1.2, 0.3, up=False)]
        stats, before, after, js = self.run_on(parts, cam=(0.5, 0.5, 5))
        z = [sorted({round(p[2], 6) for t, _ in after[k:k + 2] for p in t}) for k in (0, 2, 4, 6)]
        self.assertEqual(z, [[0.0], [-0.003], [-0.006], [-0.006]])

    def test_changes_nothing_when_run_again_on_its_own_output(self):
        parts = [quad(0, 0, 1, 1), quad(0.1, 0.1, 0.9, 0.9), quad(0.3, 0.3, 0.5, 0.5), quad(2, 0, 3, 1), quad(2, 0, 3, 1),
                 quad(4, 0, 5, 1), quad(4.1, 0.1, 4.9, 0.9, up=False), quad(4.3, 0.3, 4.5, 0.5, up=False), quad(4.8, 0.1, 5.2, 0.3, up=False)]
        with tempfile.TemporaryDirectory() as d:
            build(f'{d}/a.glb', parts, cam=(2.5, 0.5, 5))
            first = pack.separate(f'{d}/a.glb', f'{d}/b.glb')
            second = pack.separate(f'{d}/b.glb', f'{d}/c.glb')
            self.assertGreater(first['lifted'], 0)
            self.assertEqual((second['lifted'], second['dropped'], second['surfaces'], second['backs'], second['passes']), (0, 0, 0, 0, 1))
            self.assertEqual(triangles(f'{d}/c.glb')[0], triangles(f'{d}/b.glb')[0])

    def test_lifts_3_mm_in_the_room_through_a_rotated_scaled_and_moved_node(self):
        node = {'translation': [5.0, 1.0, 2.0], 'rotation': [0.5 ** 0.5, 0.0, 0.0, 0.5 ** 0.5], 'scale': [2.0, 2.0, 2.0]}
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1), quad(0.2, 0.2, 0.4, 0.8)], node=node)
        M = pack.node_matrix(js['nodes'][0])
        world = lambda p: [sum(M[r][c] * p[c] for c in range(3)) + M[r][3] for r in range(3)]
        ys = sorted({round(world(p)[1], 6) for t, _ in after for p in t})
        self.assertEqual(ys, [0.997, 1.0])
        self.assertEqual(sorted({round(p[2], 6) for t, _ in after for p in t}), [0.0, 0.0015])

    def test_writes_the_same_bytes_every_time(self):
        parts = [quad(0, 0, 1, 1), quad(0.1, 0.1, 0.9, 0.9), quad(0.3, 0.3, 0.5, 0.5), quad(2, 0, 3, 1), quad(2, 0, 3, 1), quad(4, 0, 5, 1), quad(4.1, 0.1, 4.9, 0.9, up=False)]
        with tempfile.TemporaryDirectory() as d:
            build(f'{d}/a.glb', parts, cam=(2.5, 0.5, 5))
            pack.separate(f'{d}/a.glb', f'{d}/b.glb'); pack.separate(f'{d}/a.glb', f'{d}/c.glb')
            with open(f'{d}/b.glb', 'rb') as b, open(f'{d}/c.glb', 'rb') as c: self.assertEqual(b.read(), c.read())


class Plan(unittest.TestCase):
    IMAGES = ['archC', 'archC_a', 'archC_f', 'archC_c0', 'archC_c1', 'archC_c2', 'archC_s0', 'archC_s1', 'archC_s2',
              'backdrop', 'probe_c0', 'probe_c1', 'probe_c10', 'probe_c2', 'probe_c3', 'probe_c4', 'probe_c5', 'probe_c6',
              'probe_c7', 'probe_c8', 'probe_c9']

    def test_each_sky_and_orrery_layer_is_a_file_named_as_its_image(self):
        jobs, layers = pack.plan('lobby', self.IMAGES)
        for name in ('archC_c0', 'archC_c1', 'archC_c2', 'archC_s0', 'archC_s1', 'archC_s2'):
            self.assertEqual(jobs[name], ('base', [name]))
        self.assertNotIn('archC_c', jobs)
        self.assertNotIn('archC_s', jobs)
        self.assertEqual(layers, {'archC_c': 3, 'archC_s': 3})

    def test_the_probe_stays_one_array_in_layer_order(self):
        jobs, layers = pack.plan('lobby', self.IMAGES)
        self.assertEqual(jobs['probe_c'], ('layers', [f'probe_c{i}' for i in range(11)]))
        self.assertNotIn('probe_c', layers)

    def test_the_other_kinds_are_unchanged(self):
        jobs, _ = pack.plan('lobby', self.IMAGES)
        self.assertEqual(jobs['archC'], ('base', ['archC']))
        self.assertEqual(jobs['archC_a'], ('albedo', ['archC_a']))
        self.assertEqual(jobs['archC_f'], ('albedo', ['archC_f']))
        self.assertEqual(jobs['backdrop'], ('backdrop', ['backdrop']))

    def test_the_plan_does_not_depend_on_the_order_of_the_images(self):
        self.assertEqual(pack.plan('lobby', self.IMAGES), pack.plan('lobby', list(reversed(self.IMAGES))))

    def test_a_missing_layer_stops_the_pack(self):
        with self.assertRaises(SystemExit):
            pack.plan('lobby', ['archC_s0', 'archC_s2'])

    def test_a_room_without_layers_has_none(self):
        self.assertEqual(pack.plan('projects', ['props', 'props_f', 'probe_c0'])[1], {})


class Split(unittest.TestCase):
    def make(self, d):
        import struct
        head = bytearray(80 + 24 * 3); head[:12] = b'\xabKTX 20\xbb\r\n\x1a\n'
        struct.pack_into('<I', head, 40, 3)
        offs = [(400, 300), (300, 100), (200, 100)]
        for i, (o, n) in enumerate(offs): struct.pack_into('<QQQ', head, 80 + 24 * i, o, n, n)
        data = bytes(head) + bytes(200 - len(head)) + bytes(range(256)) * 2
        data = data[:700]
        path = os.path.join(d, 'x.ktx2')
        with open(path, 'wb') as f: f.write(data)
        return path, data

    def test_the_head_ends_where_the_two_largest_levels_start_and_head_plus_tail_is_the_file(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path, data = self.make(d)
            self.assertEqual(pack.small_bytes(path, 2), 300)
            self.assertIsNone(pack.small_bytes(path, 3))
            pack.split(path, 300)
            self.assertFalse(os.path.exists(path))
            with open(os.path.join(d, 'x.head.ktx2'), 'rb') as f: head = f.read()
            with open(os.path.join(d, 'x.tail.ktx2'), 'rb') as f: tail = f.read()
            self.assertEqual(len(head), 300)
            self.assertEqual(head + tail, data)

    def test_not_a_ktx2_file_is_not_cut(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, 'y.ktx2')
            with open(path, 'wb') as f: f.write(b'not a texture' * 20)
            self.assertIsNone(pack.small_bytes(path))


class SmallKTX2(unittest.TestCase):
    JS = r'''
import { smallKTX2 } from 'FILE';
const make = (scheme) => {
  const n = 3, sgdLen = scheme === 1 ? 20 + n * 20 + 8 : 0, levels = [[300, 40], [260, 20], [240, 10]];
  const buf = new Uint8Array(400), dv = new DataView(buf.buffer);
  buf.set([0xAB,0x4B,0x54,0x58,0x20,0x32,0x30,0xBB,0x0D,0x0A,0x1A,0x0A]);
  dv.setUint32(20, 64, true); dv.setUint32(24, 32, true); dv.setUint32(36, 1, true); dv.setUint32(40, n, true); dv.setUint32(44, scheme, true);
  dv.setUint32(48, 152, true); dv.setUint32(52, 8, true); dv.setUint32(56, 160, true); dv.setUint32(60, 4, true);
  if (sgdLen) { dv.setBigUint64(64, 168n, true); dv.setBigUint64(72, BigInt(sgdLen), true); for (let i = 0; i < n; i++) buf.fill(10 + i, 168 + 20 + i * 20, 168 + 40 + i * 20); }
  levels.forEach(([o, l], i) => { dv.setBigUint64(80 + 24 * i, BigInt(o), true); dv.setBigUint64(88 + 24 * i, BigInt(l), true); buf.fill(100 + i, o, o + l); });
  return buf;
};
const out = [];
for (const scheme of [2, 1]) {
  const full = make(scheme), small = new Uint8Array(smallKTX2(full.slice(0, 300).buffer, 2)), dv = new DataView(small.buffer);
  const lo = Number(dv.getBigUint64(80, true)), ln = Number(dv.getBigUint64(88, true)), sg = Number(dv.getBigUint64(64, true)), sl = Number(dv.getBigUint64(72, true));
  out.push({ scheme, w: dv.getUint32(20, true), h: dv.getUint32(24, true), levels: dv.getUint32(40, true), level: [...small.subarray(lo, lo + ln)].every((x) => x === 102) && ln === 10,
    sgd: sl ? [sl, small[sg + 20]] : null });
}
console.log(JSON.stringify(out));
'''
    def test_rewrite(self):
        import json, shutil, subprocess
        if not shutil.which('node'): self.skipTest('no node')
        js = os.path.join(TOOLS, '..', 'public', 'js', 'ktx2small.js')
        r = subprocess.run(['node', '--input-type=module', '-e', self.JS.replace('FILE', 'file://' + os.path.abspath(js))], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        zstd, basis = json.loads(r.stdout)
        self.assertEqual((zstd['w'], zstd['h'], zstd['levels'], zstd['level'], zstd['sgd']), (16, 8, 1, True, None))
        self.assertEqual((basis['levels'], basis['level'], basis['sgd']), (1, True, [48, 12]))


class SmallKTX2RealFiles(unittest.TestCase):
    JS = "\nimport { smallKTX2 } from '@SMALL@';\nimport { readFileSync } from 'node:fs';\nimport { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\nconst code = readFileSync('@BASIS@/basis_transcoder.js', 'utf8');\nconst BASIS = new Function('module', 'exports', 'require', '__dirname', code + ';return BASIS;')({}, {}, require, '@BASIS@');\nconst B = await BASIS({ wasmBinary: readFileSync('@BASIS@/basis_transcoder.wasm') }); B.initializeBasis();\nconst head = (b) => { const v = new DataView(b.buffer, b.byteOffset, b.byteLength), u32 = (o) => v.getUint32(o, true), u64 = (o) => Number(v.getBigUint64(o, true));\n  return { scheme: u32(44), n: u32(40), dfd: [u32(48), u32(52)], kvd: [u32(56), u32(60)], sgd: [u64(64), u64(72)], lv: [...Array(u32(40)).keys()].map((i) => [u64(80 + 24 * i), u64(88 + 24 * i)]) }; };\nconst out = {};\nfor (const [name, cut] of JSON.parse(process.argv.at(-1))) {\n  const full = new Uint8Array(readFileSync('@FIX@/' + name)), drop = 2, small = new Uint8Array(smallKTX2(full.slice(0, cut).buffer, drop)), F = head(full), S = head(small);\n  const same = (a, b, n) => n === 0 || Buffer.compare(Buffer.from(full.subarray(a, a + n)), Buffer.from(small.subarray(b, b + n))) === 0;\n  const r = { levels: S.n === F.n - drop, dfd: S.dfd[1] === F.dfd[1] && same(F.dfd[0], S.dfd[0], F.dfd[1]), kvd: S.kvd[1] === F.kvd[1] && same(F.kvd[0], S.kvd[0], F.kvd[1]),\n    end: small.length === Math.max(...S.lv.map(([o, l]) => o + l)), aligned: S.lv.every(([o]) => o % 16 === 0) };\n  if (F.scheme === 1) { const per = 20, tail = F.sgd[1] - 20 - F.n * per; r.sgdTail = S.sgd[1] === 20 + S.n * per + tail && same(F.sgd[0] + 20 + F.n * per, S.sgd[0] + 20 + S.n * per, tail) && same(F.sgd[0] + 20 + drop * per, S.sgd[0] + 20, S.n * per); }\n  const k = new B.KTX2File(small), kf = new B.KTX2File(full); k.startTranscoding(); kf.startTranscoding();\n  r.transcoded = k.isValid() && S.lv.every((_, lv) => { const a = new Uint8Array(k.getImageTranscodedSizeInBytes(lv, 0, 0, 13)), b = new Uint8Array(kf.getImageTranscodedSizeInBytes(lv + drop, 0, 0, 13));\n    k.transcodeImage(a, lv, 0, 0, 13, 0, -1, -1); kf.transcodeImage(b, lv + drop, 0, 0, 13, 0, -1, -1); return a.length === b.length && a.every((x, i) => x === b[i]); });\n  k.close(); k.delete(); kf.close(); kf.delete();\n  out[name] = r;\n}\nconsole.log(JSON.stringify(out));\n"

    def test_heads_of_real_files(self):
        import json, shutil, subprocess
        if not shutil.which('node'): self.skipTest('no node')
        root = os.path.abspath(os.path.join(TOOLS, '..'))
        fix = os.path.join(TOOLS, 'testdata', 'ktx2')
        cuts = [[n, pack.small_bytes(os.path.join(fix, n))] for n in ('uastc.ktx2', 'uastc-zstd.ktx2', 'etc1s.ktx2')]
        js = self.JS.replace('@SMALL@', 'file://' + os.path.join(root, 'public', 'js', 'ktx2small.js')).replace('@BASIS@', os.path.join(root, 'public', 'vendor', 'jsm', 'libs', 'basis')).replace('@FIX@', fix)
        r = subprocess.run(['node', '--input-type=module', '-e', js, json.dumps(cuts)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        out = json.loads(r.stdout)
        for name, res in out.items():
            for key in ('levels', 'dfd', 'kvd', 'end', 'transcoded'): self.assertTrue(res[key], (name, key))
        self.assertTrue(out['uastc.ktx2']['aligned'])
        self.assertTrue(out['etc1s.ktx2']['sgdTail'])


if __name__ == '__main__':
    unittest.main()