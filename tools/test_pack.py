# Tests for tools/pack.py: what each room's textures are packed into, and js/ktx2small.js.
import importlib.util, os, unittest

TOOLS = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('pack', os.path.join(TOOLS, 'pack.py'))
pack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack)


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


if __name__ == '__main__':
    unittest.main()
