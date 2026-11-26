# Tests for tools/pack.py: what each room's textures are packed into.
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


if __name__ == '__main__':
    unittest.main()
