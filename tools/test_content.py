"""Tests for tools/content.py: what a post's header may hold. Each test writes a post into a temporary folder.
    python3 -m unittest tools/test_content.py          (from the repository root; -v lists each test)"""
import os, shutil, sys, tempfile, unittest
from unittest import mock

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
import content

CARD = '5eeba53d61f7407b70834e8c7526f2a7d8b960a1-1200x630.png'
IMAGES = os.path.join(content.DATA, 'assets', 'images')
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


if __name__ == '__main__':
    unittest.main()
