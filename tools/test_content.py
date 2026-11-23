"""Tests for tools/content.py: what a post's header may hold. Each test writes a post into a temporary folder.
    python3 -m unittest tools/test_content.py          (from the repository root; -v lists each test)"""
import os, shutil, sys, tempfile, unittest, zlib
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


if __name__ == '__main__':
    unittest.main()
