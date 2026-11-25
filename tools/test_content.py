"""Tests for tools/content.py: what a post's or a project's header may hold, and what the profile may hold. Each test writes
its file into a temporary folder.
    python3 -m unittest tools/test_content.py          (from the repository root; -v lists each test)"""
import copy, json, os, shutil, sys, tempfile, unittest, zlib
from unittest import mock

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
import content

CARD = '5eeba53d61f7407b70834e8c7526f2a7d8b960a1-1200x630.png'
IMAGES = os.path.join(content.DATA, 'assets', 'images')
SHAPES = ['"text"', 'word', '[a, b]', '["a", 1]', '[]', '[a, , b]', '\n  - "x"', '\n  - note: "x"', '\n  - x: 1',
          '\n  - date: 2026-01-20\n    kind: update\n    note: "x"', '[{"a": 1}]', '""', '2026-01-20', '[[1]]', '[null]', '',
          '[{"date": "2026-01-20", "kind": "update", "note": 5}]', '[homelab]', 'homelab', 'a-post', CARD]
HEADER = 'title: "A post"\ndescription: "One sentence."\npublished: 2026-01-15\n'


class Header(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='test-content-')
        self.addCleanup(shutil.rmtree, self.tmp)

    def load(self, extra='', header=HEADER):
        """The post data/posts/a-post.md with this header (the valid minimum, then `extra`) -> load_posts()."""
        folder = tempfile.mkdtemp(dir=self.tmp)
        with open(os.path.join(folder, 'a-post.md'), 'w', encoding='utf-8') as f:
            f.write(f'---\n{header}{extra}---\n\nBody.\n')
        return content.load_posts(folder)

    def refused(self, extra, *words, header=HEADER):
        with self.assertRaises(content.ContentError, msg=extra) as e:
            self.load(extra, header)
        for w in ('data/posts/a-post.md',) + words:
            self.assertIn(w, str(e.exception), extra)
        return str(e.exception)

    # ------------------------------------------------------------ the social card's file name

    def test_image_is_a_file_name_in_the_images_folder(self):
        self.assertEqual(self.load(f'image: {CARD}\n')[0]['image'], CARD)
        for name in ('../../../public/exhibit-review.png', '../images/' + CARD, os.path.join(IMAGES, CARD),
                     '/etc/hostname', '.', '..', '..\\\\images\\\\' + CARD, f'"{CARD}\\u0000"', 'missing.png'):
            self.refused(f'image: {name}\n', '`image`')

    def test_image_is_not_a_symbolic_link(self):
        images = tempfile.mkdtemp(dir=self.tmp)
        shutil.copy(os.path.join(IMAGES, CARD), os.path.join(images, 'card.png'))
        os.symlink(os.path.join(IMAGES, CARD), os.path.join(images, 'link.png'))
        with mock.patch.object(content, 'IMAGES', images):
            self.assertEqual(self.load('image: card.png\n')[0]['image'], 'card.png')
            self.refused('image: link.png\n', '`image`')

    # ------------------------------------------------------------ every field's type

    def test_reported_cases(self):
        self.refused('takeaways:\n  - note: "x"\n', '`takeaways`')         # was KeyError: 0, in site.py
        self.refused(f'image: {CARD}\nimage_alt: [a, b]\n', '`image_alt`')
        self.refused('next: a-post\nnext_reason:\n  - "x"\n', '`next_reason`')
        self.refused('next: [a-post]\n', '`next`')                          # was TypeError: unhashable type
        self.refused('tags: ["a", 1]\n', '`tags`')
        self.refused('projects: [homelab, ""]\n', '`projects`')
        self.refused('changelog: [{"date": "2026-01-20", "kind": "update", "note": 5}]\n', '`changelog`')
        self.refused('changelog:\n  - date: 2026-01-20\n    kind: update\n    note: "x"\n    by: me\n', '`changelog`')
        self.refused('image_alt: ""\n', '`image_alt`')
        self.refused('title: [a]\n', '`title`', header=HEADER.replace('title: "A post"\n', ''))
        self.refused('title: "unclosed\n', '`title`', header=HEADER.replace('title: "A post"\n', ''))
        self.refused('image_alt: "x"\n  - "y"\n', '`image_alt`')
        self.refused('changelog:\n  - date: 2026-01-20\n    date: 2026-01-21\n    kind: update\n    note: "x"\n', '`changelog`')

    def test_every_field_in_every_shape(self):
        """Any value in any field: a ContentError naming the field, or a post whose fields have the right types."""
        for k in content.KNOWN:
            for v in SHAPES:
                line = f'{k}:{v}\n' if v.startswith('\n') or not v else f'{k}: {v}\n'
                header = ''.join(x + '\n' for x in HEADER.splitlines() if not x.startswith(k + ':'))
                try:
                    post, = self.load(line, header)
                except content.ContentError as e:
                    self.assertIn(f'`{k}`', str(e), line)
                    continue
                for f in content.KNOWN:
                    if f == 'changelog':
                        self.assertTrue(all(set(c) == {'date', 'kind', 'note'} and all(isinstance(x, str) for x in c.values())
                                            for c in post[f]), line)
                    elif f in content.LISTS:
                        self.assertTrue(isinstance(post[f], list) and all(isinstance(x, str) for x in post[f]), line)
                    else:
                        self.assertTrue(post[f] is None or isinstance(post[f], str), line)

    # ------------------------------------------------------------ values that must agree

    def test_dates_agree(self):
        entry = lambda d, kind='update': f'  - date: {d}\n    kind: {kind}\n    note: "x"\n'
        self.load('revised: 2026-01-15\nchangelog:\n' + entry('2026-01-15') + entry('2026-01-15'))   # same day: fine
        self.assertIn('earlier than', self.refused('revised: 2026-01-14\n', '`revised`'))
        self.assertIn('newest first', self.refused('changelog:\n' + entry('2026-01-20') + entry('2026-02-01'), '`changelog`'))
        self.assertIn('before', self.refused('changelog:\n' + entry('2026-02-01') + entry('2026-01-14'), '`changelog`'))
        self.refused('revised: 2026-02-30\n', '`revised`')

    def test_projects_exist(self):
        self.assertEqual(self.load('projects: [homelab, gb10-memory-guard]\n')[0]['projects'], ['homelab', 'gb10-memory-guard'])
        for bad in ('no-such-project', '../projects/homelab', 'Homelab'):
            self.refused(f'projects: ["{bad}"]\n', '`projects`', 'data/projects/')

    # ------------------------------------------------------------ the social card

    def test_social_card(self):
        """A PNG or JPEG of exactly 1200x630 by its own header, named for its type, with no EXIF."""
        def chunk(kind, data):
            return len(data).to_bytes(4, 'big') + kind + data + zlib.crc32(kind + data).to_bytes(4, 'big')
        def png(w, h, extra=b''):
            ihdr = chunk(b'IHDR', w.to_bytes(4, 'big') + h.to_bytes(4, 'big') + bytes([8, 2, 0, 0, 0]))
            return b'\x89PNG\r\n\x1a\n' + ihdr + extra + chunk(b'IDAT', zlib.compress(b'')) + chunk(b'IEND', b'')
        def seg(marker, data):
            return bytes([0xff, marker]) + (len(data) + 2).to_bytes(2, 'big') + data
        def jpeg(w, h, exif=False):
            sof = seg(0xc0, bytes([8]) + h.to_bytes(2, 'big') + w.to_bytes(2, 'big') + bytes([1, 1, 0x11, 0]))
            return (b'\xff\xd8' + seg(0xe0, b'JFIF\0\1\1\0\0\1\0\1\0\0') + (seg(0xe1, b'Exif\0\0II*\0\x08\0\0\0\0\0') if exif else b'')
                    + seg(0xdb, bytes(65)) + sof + b'\xff\xda' + b'\0\x08\x01\x01\0\0\x3f\0' + b'\x12\xff\x00\x34' + b'\xff\xd9')
        images = tempfile.mkdtemp(dir=self.tmp)
        shutil.copy(os.path.join(IMAGES, CARD), images)
        with open(os.path.join(IMAGES, '6fe542e74604f9d619cf2856d74d17a377efd37b-1536x1024.webp'), 'rb') as f:
            webp = f.read()
        files = {'card.jpg': jpeg(1200, 630), 'card.jpeg': jpeg(1200, 630), 'made.png': png(1200, 630),
                 'small-1200x630.png': png(1200, 631), 'wide.jpg': jpeg(1201, 630), 'png-named.jpg': png(1200, 630),
                 'jpeg-named.png': jpeg(1200, 630), 'camera.jpg': jpeg(1200, 630, exif=True),
                 'exif.png': png(1200, 630, chunk(b'eXIf', b'II*\0\x08\0\0\0\0\0')), 'card.gif': b'GIF89a\xb0\x04\x76\x02',
                 'card.webp': webp,
                 'empty.png': b''}
        for f, data in files.items():
            with open(os.path.join(images, f), 'wb') as fh:
                fh.write(data)
        with mock.patch.object(content, 'IMAGES', images):
            for good in (CARD, 'card.jpg', 'card.jpeg', 'made.png'):
                self.assertEqual(self.load(f'image: {good}\n')[0]['image'], good)
            for bad, words in [('small-1200x630.png', '1200x631'), ('wide.jpg', '1201x630'), ('png-named.jpg', 'end in .png'),
                               ('jpeg-named.png', 'end in .jpg'), ('camera.jpg', 'stripped'), ('exif.png', 'stripped'),
                               ('card.gif', 'not a PNG or JPEG'), ('card.webp', 'not a PNG or JPEG'), ('empty.png', 'not a PNG or JPEG')]:
                self.refused(f'image: {bad}\n', '`image`', bad, words)

    def test_the_posts_load(self):
        self.assertEqual(len(content.load_posts()), 4)
        for p in content.load_posts():
            self.assertTrue(p['image'] and content.card_problem(content.image_file(p['image'])) is None, p['slug'])


# ---------------------------------------------------------------- projects

PROJECT = 'title: "A project"\nname: "Project"\nsummary: "One sentence."\norder: 1\nstatus: active\ntypes: [software]\n'
PSHAPES = SHAPES + ['true', 'false', '1', '0', '07', 'year', 'active', 'completed', 'repo', '[software, research]',
                    '\n  - label: "a"\n    value: "b"', '\n  - label: "a"\n    kind: repo\n    url: "https://example.org/"',
                    '\n  - label: "a"\n    kind: repo\n    post: my-homelab', '\n  - metric: "a"\n    value: "b"\n    note: "c"',
                    '\n  - label: "a"\n    kind: repo\n    file: "fc41d42d9b66390887e20ff239a1361e55975238.pdf"']
IMG = '24224f397bb32cf609f4c2a7b4520d12ec46eb3c-2160x1440.png'


class Projects(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='test-projects-')
        self.addCleanup(shutil.rmtree, self.tmp)

    def load(self, extra='', header=PROJECT, body='Body.\n', more=()):
        """data/projects/a-project.md with this header (the valid minimum, then `extra`) and body, beside the files in
        `more` {file name: text}; -> load_projects() of that folder."""
        folder = tempfile.mkdtemp(dir=self.tmp)
        for name, text in dict({'a-project.md': f'---\n{header}{extra}---\n{body}'}, **dict(more)).items():
            with open(os.path.join(folder, name), 'w', encoding='utf-8') as f:
                f.write(text)
        return content.load_projects(folder)

    def refused(self, extra, *words, header=PROJECT, body='Body.\n', more=()):
        with self.assertRaises(content.ContentError, msg=extra) as e:
            self.load(extra, header, body, more)
        for w in ('data/projects/a-project.md',) + words:
            self.assertIn(w, str(e.exception), extra)
        return str(e.exception)

    def drop(self, *keys):
        return ''.join(l + '\n' for l in PROJECT.splitlines() if not l.startswith(tuple(k + ':' for k in keys)))

    def test_the_minimum_and_what_absent_fields_are(self):
        p, = self.load()
        self.assertEqual(set(p), set(content.PROJECT_KNOWN) | {'slug', 'body', 'words'})
        self.assertEqual((p['slug'], p['order'], p['status'], p['types'], p['body'], p['words']), ('a-project', 1, 'active', ['software'], 'Body.\n', 1))
        for k in ('technologies', 'highlights', 'lessons', 'next_steps', 'parameters', 'results', 'links'):
            self.assertEqual(p[k], [], k)
        for k in ('status_note', 'role', 'started', 'ended', 'date_precision', 'dates_approximate', 'featured', 'quiet', 'cover', 'cover_alt',
                  'cover_caption', 'problem', 'approach', 'outcome'):
            self.assertIsNone(p[k], k)

    def test_everything(self):
        extra = (f'status_note: "Note."\ntechnologies: ["Python", "C++"]\nrole: "Me"\nstarted: 2026-01-01\nended: 2026-02-01\n'
                 f'date_precision: month\ndates_approximate: true\nfeatured: 2\nquiet: false\ncover: {IMG}\ncover_alt: "Alt."\ncover_caption: "Cap."\n'
                 'problem: "P"\napproach: "A"\noutcome: "O"\nhighlights:\n  - "One"\nlessons:\n  - "Two"\nnext_steps:\n  - "Three"\n'
                 'parameters:\n  - label: "L"\n    value: "V"\nresults:\n  - metric: "M"\n    value: "V"\n'
                 'links:\n  - label: "R"\n    kind: repo\n    url: "https://example.org/x"\n  - label: "P"\n    kind: article\n    post: my-homelab\n'
                 '  - label: "Q"\n    kind: other\n    project: a-project\n  - label: "F"\n    kind: paper\n    file: "fc41d42d9b66390887e20ff239a1361e55975238.pdf"\n')
        p, = self.load(extra, PROJECT.replace('active', 'completed'))
        self.assertEqual((p['started'], p['ended'], p['dates_approximate'], p['quiet'], p['featured'], p['technologies']),
                         ('2026-01-01', '2026-02-01', True, False, 2, ['Python', 'C++']))
        self.assertEqual(p['results'], [{'metric': 'M', 'value': 'V', 'note': None}])
        self.assertEqual(p['links'][1], {'label': 'P', 'kind': 'article', 'url': None, 'post': 'my-homelab', 'project': None, 'file': None})

    def test_required_fields(self):
        for k in ('title', 'name', 'summary', 'order', 'status', 'types'):
            self.assertIn(f'`{k}` is required', self.refused('', f'`{k}`', header=self.drop(k)))

    def test_each_refusal_names_its_field(self):
        cases = [
            ('colour: "red"\n', '`colour`'), ('title: "twice"\n', '`title`'), ('status: paused\n', '`status`'), ('status: Active\n', '`status`'),
            ('order: 0\n', '`order`'), ('order: one\n', '`order`'), ('order: 1.5\n', '`order`'), ('featured: first\n', '`featured`'),
            ('types: [music]\n', '`types`'), ('types: []\n', '`types`'), ('technologies: ["a", ""]\n', '`technologies[1]`'),
            ('started: 2026-02-30\ndate_precision: year\n', '`started`'), ('started: 2026-01-01\n', '`date_precision`'),
            ('started: 2026-01-01\ndate_precision: day\n', '`date_precision`'), ('date_precision: year\n', '`date_precision`'),
            ('ended: 2026-01-01\n', '`ended`'), ('started: 2026-02-01\nended: 2026-01-01\ndate_precision: year\n', 'earlier than'),
            ('started: 2026-01-01\nended: 2026-02-01\ndate_precision: year\n', 'active'),
            ('dates_approximate: true\n', '`dates_approximate`'), ('quiet: yes\n', '`quiet`'), ('quiet: "true"\nquiet: false\n', '`quiet`'),
            (f'cover_alt: "x"\n', '`cover_alt`'), (f'cover_caption: "x"\n', '`cover_caption`'), ('cover: missing.png\n', '`cover`'),
            ('cover: ../images/' + IMG + '\n', '`cover`'), ('problem: "p"\n', '`approach`'), ('approach: "a"\n', '`problem`'),
            ('outcome: "o"\n', '`outcome`'), ('highlights:\n  - note: "x"\n', '`highlights[0]`'), ('lessons: [a, b]\nlessons: [c]\n', '`lessons`'),
            ('next_steps: "one"\n', '`next_steps`'),
            ('parameters:\n  - label: "a"\n', '`parameters[0]`'), ('parameters:\n  - label: "a"\n    value: "b"\n    unit: "c"\n', '`unit`'),
            ('results:\n  - metric: "a"\n    note: "n"\n', '`results[0]`'),
            ('links:\n  - label: "a"\n    kind: repo\n', 'exactly one'),
            ('links:\n  - label: "a"\n    kind: repo\n    url: "https://e.org"\n    post: my-homelab\n', 'exactly one'),
            ('links:\n  - label: "a"\n    kind: repo\n    url: "javascript:alert(1)"\n', '`links[0].url`'),
            ('links:\n  - label: "a"\n    kind: repo\n    url: "mailto:a@b.c"\n', '`links[0].url`'),
            ('links:\n  - label: "a"\n    kind: repo\n    url: "/blog/my-homelab/"\n', '`links[0].url`'),
            ('links:\n  - label: "a"\n    kind: blog\n    url: "https://e.org"\n', '`links[0].kind`'),
            ('links:\n  - label: "a"\n    kind: repo\n    post: no-such-post\n', '`links[0].post`'),
            ('links:\n  - label: "a"\n    kind: repo\n    project: no-such-project\n', '`links[0].project`'),
            ('links:\n  - label: "a"\n    kind: repo\n    file: ../x.pdf\n', '`links[0].file`'),
            ('links:\n  - label: "a"\n    kind: repo\n    file: missing.pdf\n', '`links[0].file`'),
            ('links:\n  - label: "a"\n    url: "https://e.org"\n', '`kind`'),
        ]
        for extra, word in cases:
            with self.subTest(extra):
                self.refused(extra, word)

    def test_dates_and_status_agree(self):
        ok = 'started: 2026-01-01\ndate_precision: month\n'
        self.load(ok + 'ended: 2026-01-01\n', PROJECT.replace('active', 'completed'))
        self.load(ok)
        self.refused(ok + 'ended: 2026-02-01\n', '`ended`')                    # active, but ended

    def test_order_and_featured_are_unique_and_sort(self):
        two = lambda order, feat='': f'---\ntitle: "T"\nname: "N"\nsummary: "S"\norder: {order}\nstatus: active\ntypes: [software]\n{feat}---\n'
        got = self.load(more={'b-project.md': two(0 + 3), 'c-project.md': two(2)}, header=PROJECT.replace('order: 1', 'order: 10'))
        self.assertEqual([p['slug'] for p in got], ['c-project', 'b-project', 'a-project'])
        for extra, more, word in (('', {'b-project.md': two(1)}, '`order` 1'), ('featured: 1\n', {'b-project.md': two(5, 'featured: 1\n')}, '`featured` 1')):
            with self.assertRaises(content.ContentError) as e:
                self.load(extra, more=more)
            self.assertIn(word, str(e.exception))
            self.assertIn('data/projects/', str(e.exception))

    def test_links_between_projects_and_the_body(self):
        self.refused('links:\n  - label: "a"\n    kind: other\n    project: b-project\n', '`links[0].project`')
        self.load('links:\n  - label: "a"\n    kind: other\n    project: b-project\n',
                  more={'b-project.md': PROJECT.join(['---\n', '---\n']).replace('order: 1', 'order: 2')})
        self.load(body='See [a post](/blog/my-homelab/), [another](/portfolio/a-project/#x), [a file](../assets/files/fc41d42d9b66390887e20ff239a1361e55975238.pdf)'
                       f' and [web](https://example.org/).\n\n![alt](../assets/images/{IMG} "cap")\n')
        for body, word in [('[x](/blog/no-such/)\n', '/blog/no-such/'), ('[x](/portfolio/no-such/)\n', '/portfolio/no-such/'),
                           ('[x](../assets/files/no-such.pdf)\n', 'no-such.pdf'), ('![x](../assets/images/no-such.png)\n', 'no-such.png')]:
            self.refused('', word, body=body)
        self.load(body='```text\n[x](/blog/no-such/)\n```\n')                  # in code it is only text

    def test_the_file_itself(self):
        folder = tempfile.mkdtemp(dir=self.tmp)
        for name, data, word in [('Bad_Name.md', b'---\n---\n', 'lower-case'), ('a-project.md', b'no header\n', 'first line'),
                                 ('a-project.md', b'---\ntitle: x\n', 'not closed'), ('a-project.md', b'---\n\xff\xfe\n---\n', 'UTF-8'),
                                 ('a-project.md', b'---\ntitle "x"\n---\n', 'expected `key: value`')]:
            with open(os.path.join(folder, name), 'wb') as f:
                f.write(data)
            with self.assertRaises(content.ContentError) as e:
                content.load_projects(folder)
            self.assertIn(word, str(e.exception))
            os.remove(os.path.join(folder, name))

    def test_every_field_in_every_shape(self):
        """Any value in any field: a ContentError naming a field, or a project whose fields have the right types."""
        for k in content.PROJECT_KNOWN:
            for v in PSHAPES:
                line = f'{k}:{v}\n' if v.startswith('\n') or not v else f'{k}: {v}\n'
                try:
                    p, = self.load(line, self.drop(k))
                except content.ContentError as e:
                    self.assertIn('data/projects/a-project.md', str(e), line)
                    self.assertIn('`', str(e), line)
                    continue
                for f in ('title', 'name', 'summary', 'status', 'cover'):
                    self.assertTrue(p[f] is None or isinstance(p[f], str), line)
                self.assertTrue(isinstance(p['order'], int) and p['order'] >= 1, line)
                for f in ('quiet', 'dates_approximate'):
                    self.assertTrue(p[f] is None or isinstance(p[f], bool), line)
                for f in ('types', 'technologies', 'highlights', 'lessons', 'next_steps'):
                    self.assertTrue(isinstance(p[f], list) and all(isinstance(x, str) for x in p[f]), line)
                for f in ('parameters', 'results', 'links'):
                    self.assertTrue(isinstance(p[f], list) and all(isinstance(x, dict) and all(y is None or isinstance(y, str) for y in x.values())
                                                                   for x in p[f]), line)

    def test_a_posts_projects_are_the_md_files(self):
        folder = tempfile.mkdtemp(dir=self.tmp)
        with open(os.path.join(folder, 'a-post.md'), 'w', encoding='utf-8') as f:
            f.write(f'---\n{HEADER}projects: [homelab]\n---\nBody.\n')
        self.assertEqual(content.load_posts(folder)[0]['projects'], ['homelab'])
        self.assertTrue(os.path.isfile(os.path.join(content.DATA, 'projects', 'homelab.json')))   # the archive is no longer what counts
        for bad in ('no-such-project', 'Homelab'):
            with open(os.path.join(folder, 'a-post.md'), 'w', encoding='utf-8') as f:
                f.write(f'---\n{HEADER}projects: [{bad}]\n---\nBody.\n')
            with self.assertRaises(content.ContentError) as e:
                content.load_posts(folder)
            self.assertIn(f'data/projects/{bad}.md', str(e.exception))

    def test_the_projects_load(self):
        ps = content.load_projects()
        self.assertEqual([p['order'] for p in ps], list(range(1, 11)))
        self.assertEqual(ps[1]['slug'], 'homelab')
        self.assertEqual([p['slug'] for p in sorted((p for p in ps if p['featured']), key=lambda p: p['featured'])],
                         ['driving-detection-evaluation', 'robot-scene-memory', 'local-coding-agent-benchmarks'])
        for p in ps:
            self.assertTrue(p['body'].strip() and p['words'] > 0, p['slug'])
            self.assertEqual(p['cover'] is None, p['cover_alt'] is None, p['slug'])


# ---------------------------------------------------------------- the profile

class Profile(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='test-profile-')
        self.addCleanup(shutil.rmtree, self.tmp)
        with open(os.path.join(content.DATA, 'profile.json'), encoding='utf-8') as f:
            self.good = json.load(f)

    def write(self, doc, raw=None):
        path = os.path.join(self.tmp, 'profile.json')
        with open(path, 'wb') as f:
            f.write(raw if raw is not None else json.dumps(doc).encode())
        return path

    def load(self, change=None):
        doc = copy.deepcopy(self.good)
        if change:
            change(doc)
        return content.load_profile(self.write(doc))

    def refused(self, change, *words):
        with self.assertRaises(content.ContentError) as e:
            self.load(change)
        self.assertTrue(str(e.exception).startswith('data/profile.json: '), str(e.exception))
        for w in words:
            self.assertIn(w, str(e.exception))
        return str(e.exception)

    def test_the_real_file(self):
        p = content.load_profile()
        self.assertEqual(p['name'], 'Adithya Rajendran')
        self.assertEqual([e['id'] for e in p['timeline']], ['sjsu-2026', 'canonical-2024', 'tcr-2023', 'ucsc-2019'])
        self.assertEqual(p['timeline'][0]['end_date'], None)                  # absent: None
        self.assertEqual(p['timeline'][3]['highlights'][0][:9], 'Explored ')
        self.assertEqual(self.load(), p)

    def test_optional_things_may_be_absent(self):
        def bare(d):
            for k in ('focus_areas', 'featured_post', 'resume', 'credentials', 'contact_links', 'current_curiosities', 'curiosities_updated_at', 'talks_and_papers'):
                del d[k]
            for k in ('seeking', 'updated_at'):
                del d['availability'][k]
        p = self.load(bare)
        self.assertEqual((p['resume'], p['featured_post'], p['credentials'], p['contact_links'], p['talks_and_papers'], p['availability']['seeking']),
                         (None, None, [], [], [], []))

    def test_required_fields(self):
        top = ['name', 'headline', 'tagline', 'introduction', 'bio', 'work_summary', 'location', 'seo_description', 'writing_description',
               'projects_intro', 'contact_intro', 'contact_invitation', 'availability', 'contact_routes', 'skill_groups', 'social_links', 'timeline']
        for k in top:
            self.refused(lambda d: d.pop(k), f'`{k}` is required')
        for path in (('availability', 'status'), ('availability', 'cta'), ('timeline', 0, 'id'), ('timeline', 0, 'kind'), ('timeline', 0, 'title'),
                     ('timeline', 0, 'organization'), ('timeline', 0, 'org_short'), ('timeline', 0, 'start_date'), ('credentials', 0, 'title'),
                     ('credentials', 0, 'issuer'), ('credentials', 0, 'issued_on'), ('skill_groups', 1, 'skills'), ('skill_groups', 1, 'title'),
                     ('social_links', 2, 'url'), ('social_links', 2, 'label'), ('talks_and_papers', 0, 'title'), ('talks_and_papers', 0, 'date'),
                     ('talks_and_papers', 0, 'kind'), ('talks_and_papers', 0, 'links', 1, 'label'), ('talks_and_papers', 0, 'links', 1, 'kind'),
                     ('current_curiosities', 2, 'title'), ('contact_routes', 'hello', 'title'), ('contact_routes', 'hello', 'prompt')):
            def drop(d, path=path):
                for p in path[:-1]:
                    d = d[p]
                del d[path[-1]]
            e = self.refused(drop, f'`{path[-1]}` is required')
            self.assertIn(content._where(path[:-1]), e)

    def test_each_refusal_names_its_field(self):
        def put(*path):
            def change(value):
                def f(d):
                    for p in path[:-1]:
                        d = d[p]
                    d[path[-1]] = value
                return f
            return change
        cases = [
            (put('timeline', 1, 'end_date')('2023-01-01'), '`timeline[1]`', 'earlier than'),
            (put('timeline', 1, 'end_date')('2024-02-30'), '`timeline[1].end_date`'),
            (put('timeline', 0, 'is_current')(1), '`timeline[0].is_current`'),
            (put('timeline', 1, 'is_current')(True), 'no `end_date`'),
            (put('timeline', 0, 'expected_end_year')(2025), '`timeline[0]`', 'expected_end_year'),
            (put('timeline', 0, 'expected_end_year')('2028'), '`timeline[0].expected_end_year`'),
            (put('timeline', 0, 'expected_end_year')(True), '`timeline[0].expected_end_year`'),
            (put('timeline', 0, 'kind')('hobby'), '`timeline[0].kind`'),
            (put('timeline', 0, 'id')('SJSU 2026'), '`timeline[0].id`', 'HTML id'),
            (put('timeline', 0, 'id')('2026-sjsu'), '`timeline[0].id`'),
            (put('timeline', 1, 'id')('sjsu-2026'), 'used twice'),
            (lambda d: d['timeline'].reverse(), 'newest first'),
            (put('timeline', 0, 'start_precision')('week'), '`timeline[0].start_precision`'),
            (put('timeline', 1, 'logo')('missing.webp'), '`timeline[1].logo`'),
            (put('timeline', 0, 'logo_alt')('alt without a logo'), '`logo_alt`'),
            (put('timeline', 3, 'highlights')('one'), '`timeline[3].highlights`'),
            (put('timeline', 3, 'highlights')([5]), '`timeline[3].highlights[0]`'),
            (put('timeline', 0, 'salary')(1), '`timeline[0]`', 'salary'),
            (put('timeline')([]), '`timeline`'),
            (put('credentials', 0, 'expires_on')('2020-01-01'), '`credentials[0]`', 'earlier than'),
            (put('credentials', 2, 'expires_on')('2030-01-01'), 'lifetime'),
            (put('credentials', 0, 'verification_url')('ftp://example.org/x'), '`credentials[0].verification_url`'),
            (put('credentials', 0, 'verification_url')('//example.org/x'), '`credentials[0].verification_url`'),
            (put('credentials', 0, 'badge')('../images/' + IMG), '`credentials[0].badge`'),
            (put('credentials', 0, 'badge')(f'/etc/hostname'), '`credentials[0].badge`'),
            (put('credentials', 0, 'lifetime')('false'), '`credentials[0].lifetime`'),
            (put('social_links', 0, 'url')('javascript:alert(1)'), '`social_links[0].url`'),
            (put('social_links', 0, 'url')('mailto:a@b.c'), '`social_links[0].url`'),
            (put('social_links', 0, 'url')('/about'), '`social_links[0].url`'),
            (put('social_links')([]), '`social_links`'),
            (put('contact_links')([]), '`contact_links`'),
            (put('contact_links')('LinkedIn'), '`contact_links`'),
            (put('contact_links')(['']), '`contact_links[0]`'),
            (put('contact_links')(['NoSuchLink']), '`contact_links[0]`'),
            (put('contact_links')(['LinkedIn', 'LinkedIn']), '`contact_links[1]`'),
            (put('featured_post')('no-such-post'), '`featured_post`'),
            (put('featured_post')('../posts/my-homelab'), '`featured_post`'),
            (put('resume')('missing.pdf'), '`resume`'),
            (put('resume')('../files/e70b01e95fdcf9f4e5d8ad06a0e32b28f62060c2.pdf'), '`resume`'),
            (put('current_curiosities', 0, 'project')('no-such-project'), '`current_curiosities[0].project`'),
            (put('talks_and_papers', 0, 'project')('Homelab'), '`talks_and_papers[0].project`'),
            (put('talks_and_papers', 0, 'date')('23/10/2026'), '`talks_and_papers[0].date`'),
            (put('talks_and_papers', 0, 'links', 0, 'url')('https://example.org/x'), 'exactly one'),
            (put('talks_and_papers', 0, 'links', 1, 'url')('file:///etc/passwd'), '`talks_and_papers[0].links[1].url`'),
            (put('talks_and_papers', 0, 'links', 0, 'file')('missing.pdf'), '`talks_and_papers[0].links[0].file`'),
            (put('talks_and_papers', 0, 'links', 0, 'kind')('video'), '`talks_and_papers[0].links[0].kind`'),
            (put('curiosities_updated_at')('2026-10-26T01:47:15Z'), '`curiosities_updated_at`'),
            (put('availability', 'updated_at')('yesterday'), '`availability.updated_at`'),
            (put('availability', 'status')('Open Now'), '`availability.status`'),
            (put('availability', 'seeking')('anything'), '`availability.seeking`'),
            (put('contact_routes', 'Hello There')({'title': 't', 'prompt': 'p'}), 'HTML id'),
            (put('contact_routes', 'hello', 'extra')('x'), '`contact_routes.hello`', 'extra'),
            (put('contact_routes')({}), '`contact_routes`'),
            (put('contact_routes')([]), '`contact_routes`'),
            (put('skill_groups', 0, 'skills')([]), '`skill_groups[0].skills`'),
            (put('skill_groups', 0, 'skills')(['Python', 3]), '`skill_groups[0].skills[1]`'),
            (put('name')(''), '`name`'), (put('name')(' Adithya'), '`name`'), (put('name')(['a']), '`name`'), (put('name')('a\nb'), '`name`'),
            (put('headline')(None), '`headline`'), (put('bio')('a\n\n\nb'), '`bio`'), (put('bio')('a\n\n '), '`bio`'),
            (put('focus_areas')('one'), '`focus_areas`'), (put('mood')('x'), '`mood`'), (put('_id')('profile'), '`_id`'),
            (put('timeline', 0, '_key')('k'), '`_key`'),
        ]
        for change, *words in cases:
            with self.subTest(words):
                self.refused(change, *words)

    def test_the_file_itself(self):
        for raw, word in [(b'', 'not valid JSON'), (b'{', 'not valid JSON'), (b'[]', 'must be a record'), (b'null', 'must be a record'),
                          (b'{"name": "a", "name": "b"}', 'twice'), (b'{"name": NaN}', 'NaN'), (b'\xff\xfe{}', 'UTF-8'),
                          (b'{"name": "\\ud800"}', ''), (b'[' * 5000, ''), (b'[' * 100000 + b']' * 100000, 'too deeply')]:
            with self.subTest(raw[:20]):
                with self.assertRaises(content.ContentError) as e:
                    content.load_profile(self.write(None, raw))
                self.assertIn(word, str(e.exception))
        with self.assertRaises(content.ContentError) as e:
            content.load_profile(os.path.join(self.tmp, 'missing.json'))
        self.assertIn('data/profile.json', str(e.exception))

    def test_every_field_in_every_shape(self):
        """Any value at any place in the file: a ContentError naming the field, or a profile; never another exception."""
        shapes = [None, 1, 0, -1, 1.5, True, False, '', ' ', 'x', 'a\nb', 'x ', '2026-01-01', 'https://example.org/', 'my-homelab', IMG,
                  [], [1], ['x'], [None], {}, {'a': 1}, [{}], [[]], 10 ** 30, float('1e308')]

        def paths(node, path=()):
            yield path
            if isinstance(node, dict):
                for k, v in node.items():
                    yield from paths(v, path + (k,))
            elif isinstance(node, list):
                for i, v in enumerate(node):
                    yield from paths(v, path + (i,))
        n = 0
        for path in list(paths(self.good))[1:]:
            for v in shapes:
                doc = copy.deepcopy(self.good)
                d = doc
                for p in path[:-1]:
                    d = d[p]
                d[path[-1]] = v
                n += 1
                try:
                    content.load_profile(self.write(doc))
                except content.ContentError as e:
                    self.assertTrue(str(e).startswith('data/profile.json: '), str(e))
                    self.assertIn('`', str(e), f'{path} = {v!r}')
        self.assertGreater(n, 5000)


if __name__ == '__main__':
    unittest.main()
