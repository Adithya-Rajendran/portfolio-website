"""Tests for tools/pack.py's separation of coplanar surfaces: python3 -m unittest tools/test_pack.py"""
import importlib.util, json, os, struct, tempfile, unittest

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

    def test_leaves_mere_neighbours_alone(self):
        stats, before, after, js = self.run_on([quad(0, 0, 1, 1), quad(1, 0, 2, 1), quad(0, 1, 1, 2, up=False)])
        self.assertEqual(stats, {'lifted': 0, 'dropped': 0, 'surfaces': 0, 'levels': 0, 'deepest_mm': 0.0, 'backs': 0, 'loose': 0, 'floor': 0, 'area': 0, 'passes': 1})
        self.assertEqual(after, before)

    def test_drops_the_underside_of_a_thing_standing_on_the_floor_instead_of_moving_it_under_the_floor_mirror(self):
        stats, before, after, js = self.run_on([flat(quad(0, 0, 1, 1)), flat(quad(0.2, 0.2, 0.6, 0.6, up=False))], cam=(0.5, 5, -0.5))
        self.assertEqual((stats['backs'], stats['floor'], stats['dropped']), (0, 1, 2))
        self.assertEqual(after, before[:2])
        stats, before, after, js = self.run_on([flat(quad(0.2, 0.2, 0.6, 0.6)), flat(quad(0, 0, 1, 1, up=False))], cam=(0.5, 5, -0.5))
        self.assertEqual((stats['floor'], stats['dropped']), (0, 0))
        self.assertEqual(after, before)

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


if __name__ == '__main__':
    unittest.main()