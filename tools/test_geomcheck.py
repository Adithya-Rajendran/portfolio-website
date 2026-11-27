# Tests for tools/geomcheck.py and the pack step that runs it
import json, os, shutil, struct, sys, tempfile, unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geomcheck, pack


def quad(x0, x1, z0, z1, y=0.0):
    return [(x0, y, z0), (x0, y, z1), (x1, y, z1), (x1, y, z0)], [0, 1, 2, 0, 2, 3]


def write_glb(path, meshes, eye=(0.0, 0.0, 2.0)):
    blob, views, accessors, nodes, js_meshes = b'', [], [], [], []
    for name, (pos, idx) in meshes:
        for data, kind, comp in ((b''.join(struct.pack('<3f', *p) for p in pos), 'VEC3', 5126), (struct.pack(f'<{len(idx)}I', *idx), 'SCALAR', 5125)):
            views.append(dict(buffer=0, byteOffset=len(blob), byteLength=len(data))); blob += data + b'\0' * (-len(data) % 4)
            accessors.append(dict(bufferView=len(views) - 1, componentType=comp, count=len(pos) if kind == 'VEC3' else len(idx), type=kind))
        js_meshes.append(dict(name=name, primitives=[dict(attributes=dict(POSITION=len(accessors) - 2), indices=len(accessors) - 1)]))
        nodes.append(dict(name=name, mesh=len(js_meshes) - 1))
    js = dict(asset=dict(version='2.0'), scene=0, scenes=[dict(nodes=list(range(len(nodes))), extras=dict(lobby=dict(cam=list(eye))))],
              nodes=nodes, meshes=js_meshes, accessors=accessors, bufferViews=views, buffers=[dict(byteLength=len(blob))])
    text = json.dumps(js).encode(); text += b' ' * (-len(text) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(text) + len(blob)) + struct.pack('<I4s', len(text), b'JSON') + text + struct.pack('<I4s', len(blob), b'BIN\0') + blob)


class Check(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='test-geomcheck-')
        self.addCleanup(shutil.rmtree, self.tmp)

    def faults(self, meshes):
        path = os.path.join(self.tmp, 'room.glb'); write_glb(path, meshes)
        return geomcheck.check(path)

    def test_flush_faces_are_found(self):
        found = self.faults([('a', quad(-1, 1, -1, 1)), ('b', quad(0, 2, -1, 1))])
        self.assertGreater(len(found['lying']), 0)
        self.assertEqual(len(found['backs']) + len(found['duplicates']), 0)

    def test_duplicates_are_found(self):
        found = self.faults([('a', quad(-1, 1, -1, 1)), ('b', quad(-1, 1, -1, 1))])
        self.assertEqual(len(found['duplicates']), 2)

    def test_separated_faces_pass(self):
        found = self.faults([('a', quad(-1, 1, -1, 1)), ('b', quad(0, 2, -1, 1, y=0.003))])
        self.assertEqual(geomcheck.faults(found), 0)

    def test_faces_hidden_from_every_eye_pass(self):
        found = self.faults([('a', quad(-1, 1, -1, 1)), ('b', quad(0, 2, -1, 1)), ('lid', quad(-3, 3, -3, 3, y=0.5))])
        self.assertEqual(geomcheck.faults(found), 0)


class Pack(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='test-pack-')
        self.addCleanup(shutil.rmtree, self.tmp)
        src = os.path.join(self.tmp, 'assets-src', 'test'); os.makedirs(src); os.makedirs(os.path.join(self.tmp, 'public', 'assets', 'test'))
        with open(os.path.join(src, 'scene.json'), 'w') as f: json.dump(dict(room='test', groups=[]), f)
        self.glb = os.path.join(src, 'room.glb')

    def test_pack_stops_on_overlapping_faces(self):
        write_glb(self.glb, [('a', quad(-1, 1, -1, 1)), ('b', quad(0, 2, -1, 1))])
        with mock.patch.object(pack, 'ROOT', self.tmp), self.assertRaises(SystemExit) as stop: pack.pack('test')
        self.assertIn('overlapping or duplicate faces', str(stop.exception.code))

    def test_pack_stops_on_duplicate_faces(self):
        write_glb(self.glb, [('a', quad(-1, 1, -1, 1)), ('b', quad(-1, 1, -1, 1))])
        with mock.patch.object(pack, 'ROOT', self.tmp), self.assertRaises(SystemExit) as stop: pack.pack('test')
        self.assertIn('overlapping or duplicate faces', str(stop.exception.code))


if __name__ == '__main__':
    unittest.main()
