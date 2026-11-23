#!/usr/bin/env python3
"""Does data/posts/<slug>.md say what data/posts/<slug>.json said?   python3 -m unittest tools/test_sanity_to_md.py
It is the proof of the conversion: once a post is edited by hand on purpose, its Faithful tests will say where it differs.

The comparison does not use the converter's code: the Markdown is read by the small parser below (written from the format
in docs/v1-contracts.md §2, not from the converter), the JSON by reading Portable Text directly, and both are reduced to
the same list of blocks to compare. The converter is imported only by the tests of escaping and of overwriting.
"""
import glob, json, os, re, shutil, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content
import sanity_to_md as conv

DATA = content.DATA
SITE_URL, CDN = 'https://adithya-rajendran.com', 'https://cdn.sanity.io/files/ppk2h9tb/production/'
PUNCT = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'


def read(path, mode='r'):
    with open(path, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def jload(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ---------- the Markdown side: text -> [(character, marks, link target)], whitespace left out

def inl(s, link=None):
    out, i = [], 0
    marks = set()
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s) and s[i + 1] in PUNCT:
            out.append((s[i + 1], frozenset(marks), link)); i += 2
        elif c == '`':
            n = len(re.match(r'`+', s[i:]).group())
            m = next((m for m in re.finditer(r'`+', s[i + n:]) if len(m.group()) == n), None)
            if not m:
                out.append((c, frozenset(marks), link)); i += 1; continue
            t = s[i + n:i + n + m.start()]
            if len(t) > 1 and t[0] == t[-1] == ' ' and t.strip():
                t = t[1:-1]
            out += [(x, frozenset(marks | {'code'}), link) for x in t]
            i += n + m.end()
        elif s.startswith('**', i):
            marks ^= {'strong'}; i += 2
        elif c == '*':
            marks ^= {'em'}; i += 1
        elif c == '[':
            j, depth = i + 1, 0                             # the ] that closes this [ , skipping code and escapes
            while j < len(s):
                if s[j] == '\\': j += 2; continue
                if s[j] == '`':
                    n = len(re.match(r'`+', s[j:]).group())
                    k = s.find('`' * n, j + n)
                    j = k + n if k >= 0 else j + n
                    continue
                if s[j] == '[': depth += 1
                if s[j] == ']':
                    if depth == 0: break
                    depth -= 1
                j += 1
            if j >= len(s) or not s.startswith('](', j):
                raise AssertionError(f'a [ with no link after it: {s!r}')
            end = s.index(')', j)
            out += inl(s[i + 1:j], s[j + 2:end])
            i = end + 1
        else:
            out.append((c, frozenset(marks), link)); i += 1
    if marks:
        raise AssertionError(f'unbalanced * in {s!r}')
    return out


def chars(spans):
    return [(c, m, l) for c, m, l in spans if not c.isspace()]


def plain(s):
    return ''.join(c for c, _, _ in inl(s))


def md_blocks(body):
    """Markdown body -> [(kind, ...)] with the same shapes as json_blocks()."""
    out, lines, i = [], body.split('\n'), 0
    para = []

    def flush():
        if para:
            out.append(('p', chars(inl(' '.join(para)))))
            para.clear()
    while i < len(lines):
        ln = lines[i]
        i += 1
        if ln.startswith('```'):
            flush()
            j = i
            while lines[j] != '```':
                j += 1
            out.append(('code', ln[3:], '\n'.join(lines[i:j])))
            i = j + 1
            continue
        m = (re.match(r'^(#{2,3}) (.*)$', ln), re.match(r'^( {4})?(- |(\d+)\. )(.*)$', ln), re.match(r'^> (.*)$', ln),
             re.match(r'^!\[((?:[^\]\\]|\\.)*)\]\(\.\./assets/images/([^ )]+)(?: "((?:[^"\\]|\\.)*)")?\)$', ln))
        if not ln.strip():
            flush()
        elif m[0]:
            flush(); out.append(('h', len(m[0].group(1)), chars(inl(m[0].group(2)))))
        elif m[1]:
            flush()
            out.append(('li', 'bullet' if m[1].group(2) == '- ' else 'number', 2 if m[1].group(1) else 1, chars(inl(m[1].group(4)))))
        elif m[2]:
            flush(); out.append(('quote', chars(inl(m[2].group(1)))))
        elif m[3]:
            flush(); out.append(('image', m[3].group(2), plain(m[3].group(1)), plain(m[3].group(3) or '')))
        else:
            para.append(ln)
    flush()
    return out


# ---------- the JSON side

def expected_target(h):
    for old, new in ((SITE_URL + '/blog/', '/blog/'), (SITE_URL + '/portfolio/', '/portfolio/')):
        if h.startswith(old):
            return new + h[len(old):].rstrip('/') + '/'
    return '../assets/files/' + h[len(CDN):] if h.startswith(CDN) else h


def pt_chars(block):
    defs = {d['_key']: d['href'] for d in block['markDefs']}
    out = []
    for s in block['children']:
        link = next((expected_target(defs[m]) for m in s['marks'] if m in defs), None)
        flags = frozenset(m for m in s['marks'] if m in ('code', 'strong', 'em'))
        out += [(c, flags, link) for c in s['text'] if not c.isspace()]
    return out


def json_blocks(doc):
    out = []
    for b in doc['body']:
        if b['_type'] == 'code':
            out.append(('code', b['language'], b['code']))
        elif b['_type'] == 'image':
            ref = b['asset']['_ref']                        # image-<sha1>-<w>x<h>-<ext>
            stem, ext = ref[len('image-'):].rsplit('-', 1)
            out.append(('image', f'{stem}.{ext}', b['alt'], b['caption']))
        elif b.get('listItem'):
            out.append(('li', b['listItem'], b['level'], pt_chars(b)))
        elif b['style'] in ('h2', 'h3'):
            out.append(('h', int(b['style'][1]), pt_chars(b)))
        else:
            out.append(('quote' if b['style'] == 'blockquote' else 'p', pt_chars(b)))
    return out


def posts():
    for f in sorted(glob.glob(os.path.join(DATA, 'posts', '*.json'))):
        slug = os.path.basename(f)[:-5]
        with open(os.path.join(DATA, 'posts', slug + '.md'), encoding='utf-8') as fh:
            head, body = content.split(fh.read(), slug + '.md')
        yield slug, jload(f), head, body


class Faithful(unittest.TestCase):
    def test_four_posts_and_the_loader_reads_them(self):
        self.assertEqual(len(list(posts())), 4)
        self.assertEqual(len(content.load_posts()), 4)

    def test_blocks_in_order(self):
        """Every block, in order: its kind, level, text, and the code / strong / emphasis / link on every character."""
        for slug, doc, _, body in posts():
            a, b = md_blocks(body), json_blocks(doc)
            self.assertEqual(len(a), len(b), slug)
            for n, (x, y) in enumerate(zip(a, b), 1):
                self.assertEqual(x, y, f'{slug}: block {n}')

    def test_prose_words(self):
        for slug, doc, _, body in posts():
            want = [w for b in doc['body'] if b['_type'] == 'block' for s in b['children'] for w in [s['text']]]
            got = [''.join(c for c, _, _ in k[-1]) for k in md_blocks(body) if k[0] in ('p', 'h', 'li', 'quote')]
            self.assertEqual(''.join(''.join(want).split()), ''.join(got), slug)

    def test_code_blocks(self):
        n = 0
        for slug, doc, _, body in posts():
            want = [(b['language'], b['code']) for b in doc['body'] if b['_type'] == 'code']
            got = [(k[1], k[2]) for k in md_blocks(body) if k[0] == 'code']
            self.assertEqual(got, want, slug)
            n += len(got)
        self.assertEqual(n, 35)

    def test_images(self):
        n = 0
        for slug, doc, _, body in posts():
            want = [k for k in json_blocks(doc) if k[0] == 'image']
            got = [k for k in md_blocks(body) if k[0] == 'image']
            self.assertEqual(got, want, slug)
            for k in got:
                self.assertTrue(os.path.exists(os.path.join(DATA, 'assets', 'images', k[1])), k[1])
            n += len(got)
        self.assertEqual(n, 4)

    def test_links(self):
        def runs(blocks):                                   # [(target, text)] for each linked run of characters
            out = []
            for k in blocks:
                cur = None
                for c, _, link in k[-1] if k[0] in ('p', 'h', 'li', 'quote') else []:
                    if link and not (cur and cur[0] == link):
                        cur = [link, '']; out.append(cur)
                    elif not link:
                        cur = None
                    if link:
                        cur[1] += c
            return out
        n = 0
        for slug, doc, _, body in posts():
            self.assertEqual(runs(md_blocks(body)), runs(json_blocks(doc)), slug)
            n += len(runs(md_blocks(body)))
        self.assertEqual(n, 16)

    def test_every_link_target_exists(self):
        slugs = {s for s, *_ in posts()}
        for slug, _, _, body in posts():
            for k in md_blocks(body):
                for _, _, link in k[-1] if k[0] in ('p', 'h', 'li', 'quote') else []:
                    if link and link.startswith('/blog/'):
                        self.assertIn(link[len('/blog/'):-1], slugs)
                    elif link and link.startswith('../assets/files/'):
                        self.assertTrue(os.path.exists(os.path.join(DATA, 'assets', 'files', link.split('/')[-1])), link)
                    elif link and link.startswith('/portfolio/'):
                        self.assertTrue(os.path.exists(os.path.join(DATA, 'projects', link.split('/')[-2] + '.json')), link)
                    elif link:
                        self.assertTrue(link.startswith('https://'), link)

    def test_headings_and_lists(self):
        for slug, doc, _, body in posts():
            a = [k for k in md_blocks(body) if k[0] in ('h', 'li')]
            b = [k for k in json_blocks(doc) if k[0] in ('h', 'li')]
            self.assertEqual(a, b, slug)
            self.assertTrue(a)

    def test_strong_and_code_survive(self):
        n = 0
        for slug, doc, _, body in posts():
            for x, y in zip(md_blocks(body), json_blocks(doc)):
                if x[0] in ('p', 'h', 'li', 'quote'):
                    for (c, m, _), (d, m2, _) in zip(x[-1], y[-1]):
                        self.assertEqual(m & {'code', 'strong'}, m2 & {'code', 'strong'})
                        n += bool(m2 & {'code', 'strong'})
        self.assertGreater(n, 1000)

    def test_numbered_items_count_up(self):
        for slug, _, _, body in posts():
            run = {}
            for ln in body.split('\n'):
                m = re.match(r'^( {4})?(\d+)\. ', ln)
                if m:
                    lvl = 2 if m.group(1) else 1
                    self.assertEqual(int(m.group(2)), run.get(lvl, 0) + 1, f'{slug}: {ln[:40]}')
                    run[lvl] = int(m.group(2))
                    if lvl == 1: run.pop(2, None)
                elif not ln.startswith(' ') and not ln.startswith('- '):
                    run = {}

    def test_header(self):
        by_id = {d['_id']: os.path.basename(f)[:-5] for f in glob.glob(os.path.join(DATA, 'posts', '*.json')) for d in [jload(f)]}
        proj = {d['_id']: d['slug']['current'] for f in glob.glob(os.path.join(DATA, 'projects', '*.json')) for d in [jload(f)]}
        for slug, doc, head, _ in posts():
            p = next(p for p in content.load_posts() if p['slug'] == slug)
            ref = doc['socialImage']['asset']['_ref'][len('image-'):]
            self.assertEqual(
                (p['title'], p['description'], p['published'], p['revised'], p['tags'], p['image'], p['image_alt']),
                (doc['title'], doc['description'], doc['publishedAt'], doc.get('revisedAt'), doc['tags'],
                 ref.rsplit('-', 1)[0] + '.' + ref.rsplit('-', 1)[1], doc['socialImage']['alt']), slug)
            self.assertEqual([plain(t) for t in p['takeaways']], doc['takeaways'], slug)
            self.assertEqual(p['changelog'], sorted(({k: c[k] for k in ('date', 'kind', 'note')} for c in doc['changelog']),
                                                    key=lambda c: c['date'], reverse=True), slug)
            self.assertEqual(p['next'], by_id[doc['nextPost']['_ref']], slug)
            self.assertEqual(p['next_reason'], doc['nextReadReason'], slug)
            self.assertEqual(p['projects'], [proj[r['_ref']] for r in doc['projects']], slug)
            self.assertEqual(set(head), {'title', 'description', 'published', 'revised', 'tags', 'image', 'image_alt',
                                         'takeaways', 'changelog', 'next', 'next_reason', 'projects'}, slug)


# ---------- the converter's own cases: escaping, errors, the overwrite rule

def span(text, *marks):
    return {'_type': 'span', 'text': text, 'marks': list(marks)}


def block(*children, style='normal', defs=(), **kw):
    return dict({'_type': 'block', '_key': 'k', 'style': style, 'markDefs': list(defs), 'children': list(children)}, **kw)


def convert_body(*blocks):
    return conv.body('t', {'body': list(blocks)}, ({'t', 'other'}, {'homelab'}, {'f.yaml'}), lambda *a: None)


class Escaping(unittest.TestCase):
    def roundtrip(self, *blocks):
        md = convert_body(*blocks)
        want = [b for b in json_blocks({'body': list(blocks)})]
        self.assertEqual(md_blocks(md), want, md)
        return md

    def test_markup_characters_stay_literal(self):
        for t in ['a*b*c', '*', '_x_ and snake_case and _', 'back\\slash \\* \\', 'C:\\dir\\n', '[x] and [y](z)', 'a `tick` b', '![i](u)',
                  '# h', '#h', '> q', '- x', '-x', '+ y', '--', '1. a', '12) b', '2024. was', '~~~', 'a <b> & c', 'end\\']:
            with self.subTest(t):
                for style in ('normal', 'blockquote', 'h2'):
                    self.roundtrip(block(span(t), style=style))
                self.roundtrip(block(span(t), listItem='bullet', level=1), block(span(t), listItem='number', level=2))

    def test_no_more_escaping_than_needed(self):
        md = convert_body(block(span('snake_case, a-b, 1.5, #hash, a > b, x+y, & <b>, 2024. was')))
        self.assertEqual(md, 'snake_case, a-b, 1.5, #hash, a > b, x+y, & <b>, 2024. was\n')

    def test_heading_ending_in_hashes(self):
        for t in ['C #', 'C#', '#', 'a ##']:
            self.roundtrip(block(span(t), style='h3'))

    def test_code_spans(self):
        for t in ['a`b', '`', '``', '`a', 'a`', 'a``b`c', ' x ', ' ', 'x  y', 'plain']:
            with self.subTest(t):
                self.roundtrip(block(span('see '), span(t, 'code'), span(' now')))

    def test_marks_and_links(self):
        d = {'_key': 'L', '_type': 'contentLink', 'href': 'https://adithya-rajendran.com/blog/other'}
        md = self.roundtrip(block(span('a '), span('bold ', 'strong'), span('and code', 'strong', 'code'), span(' x', 'strong'),
                                  span(' ', 'em'), span('em', 'em'), span(' text ', 'L'), span('code', 'L', 'code'), span(' ', 'L'),
                                  span('end', 'L', 'strong'), defs=[d]))
        self.assertIn('[text `code` **end**](/blog/other/)', md.replace('[ text', '[text'))
        self.assertEqual(convert_body(block(span('a'), span(' b ', 'strong'), span('c'))), 'a **b** c\n')

    def test_links_are_rewritten(self):
        for href, want in [('https://adithya-rajendran.com/blog/other', '/blog/other/'),
                           ('https://adithya-rajendran.com/blog/other/', '/blog/other/'),
                           ('https://adithya-rajendran.com/portfolio/homelab', '/portfolio/homelab/'),
                           (CDN + 'f.yaml', '../assets/files/f.yaml'),
                           ('https://example.org/a_(b)?x=1#y', 'https://example.org/a_%28b%29?x=1#y'),
                           ('mailto:a@b.c', 'mailto:a@b.c')]:
            d = {'_key': 'L', '_type': 'contentLink', 'href': href}
            self.assertEqual(convert_body(block(span('x', 'L'), defs=[d])), f'[x]({want})\n')

    def test_lists(self):
        md = convert_body(*[block(span(t), listItem=k, level=l) for t, k, l in
                            [('a', 'bullet', 1), ('b', 'bullet', 2), ('c', 'bullet', 1), ('d', 'number', 1), ('e', 'number', 1),
                             ('f', 'number', 2), ('g', 'number', 2), ('h', 'number', 1)]], block(span('after')))
        self.assertEqual(md, '- a\n    - b\n- c\n\n1. d\n2. e\n    1. f\n    2. g\n3. h\n\nafter\n')

    def test_image_and_code(self):
        im = {'_type': 'image', 'alt': 'A [b] *c*', 'caption': 'Say "hi" \\ [x] a\\"b',
              'asset': {'_ref': 'image-05754647a9226f0938def18645edaef5169c8aec-3000x4000-jpg'}}
        md = self.roundtrip(im, {'_type': 'code', 'language': 'text', 'code': '  a\n\n``x\nb\t '})
        self.assertIn('"Say \\"hi\\" \\ \\[x\\] a\\\\\\"b"', md)

    def test_unknown_things_stop_the_converter(self):
        cases = [({'_type': 'table', '_key': 'z'}, 'table'), (block(span('x'), style='h4'), 'h4'),
                 (block(span('x', 'underline')), 'underline'), (block(span('x'), listItem='bullet', level=3), 'level'),
                 (block(span('x'), listItem='check', level=1), 'check'), (block(span('x'), listItem='bullet', level=2), 'level 2'),
                 ({'_type': 'code', 'language': 'text', 'code': 'a\n```\nb'}, 'fenced'), (block(span('')), 'empty')]
        for b, word in cases:
            with self.subTest(word):
                with self.assertRaises(conv.ConvertError) as cm:
                    convert_body(b)
                self.assertIn('t.json: body block 1', str(cm.exception))
                self.assertIn(word, str(cm.exception))


class Overwrite(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='sanity-md-')
        os.makedirs(os.path.join(self.tmp, 'data', 'posts'))
        for f in glob.glob(os.path.join(DATA, 'posts', '*.json')):
            shutil.copy(f, os.path.join(self.tmp, 'data', 'posts'))
        for d in ('projects', 'assets'):
            os.symlink(os.path.join(DATA, d), os.path.join(self.tmp, 'data', d))
        self.old = conv.DATA, conv.ROOT
        conv.DATA, conv.ROOT = os.path.join(self.tmp, 'data'), self.tmp

    def tearDown(self):
        conv.DATA, conv.ROOT = self.old
        shutil.rmtree(self.tmp)

    def run_main(self, *args):
        from contextlib import redirect_stdout
        import io
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = conv.main(list(args))
        return rc, buf.getvalue()

    def test_overwrite_rules(self):
        posts_dir = os.path.join(self.tmp, 'data', 'posts')
        self.assertEqual(self.run_main()[0], 0)
        written = {f: read(os.path.join(posts_dir, f), 'rb') for f in os.listdir(posts_dir) if f.endswith('.md')}
        self.assertEqual(len(written), 4)
        rc, out = self.run_main()                           # twice in a row: nothing changes
        self.assertEqual((rc, out.count('unchanged')), (0, 4))
        edited = os.path.join(posts_dir, 'my-homelab.md')
        with open(edited, 'a', encoding='utf-8') as f:
            f.write('\nA hand edit.\n')
        rc, out = self.run_main()
        self.assertEqual(rc, 1)
        self.assertIn('DIFFERS', out)
        self.assertIn('A hand edit.', read(edited))
        rc, out = self.run_main('--force')
        self.assertEqual(rc, 0)
        self.assertEqual(read(edited, 'rb'), written['my-homelab.md'])


if __name__ == '__main__':
    unittest.main()
