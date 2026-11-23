#!/usr/bin/env python3
"""Do the hand-edited files say what the Sanity documents said?   python3 -m unittest tools/test_sanity_to_md.py
  data/posts/<slug>.md vs .json, data/projects/<slug>.md vs .json (class Faithful, ProjectsFaithful),
  data/profile.json vs data/profile/profile.json (ProfileFaithful).
It is the proof of the conversion: once a file is edited by hand on purpose, these tests say where it differs.

The comparison does not use the converter's code: the Markdown is read by the small parser below (written from the format
in docs/v1-contracts.md §2, not from the converter), the JSON by reading Portable Text directly, and both are reduced to
the same list of blocks to compare; the header fields and the profile are compared by tables written here. The converter
is imported only by the tests of escaping, of refusing, and of overwriting. The Mutations classes break the output in
memory in many ways and require the comparison to notice each.
"""
import collections, copy, glob, json, os, re, shutil, sys, tempfile, unittest

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


def link_runs(blocks):                                      # [(target, text)] for each linked run of characters
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
        n = 0
        for slug, doc, _, body in posts():
            self.assertEqual(link_runs(md_blocks(body)), link_runs(json_blocks(doc)), slug)
            n += len(link_runs(md_blocks(body)))
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
                        self.assertTrue(os.path.exists(os.path.join(DATA, 'projects', link.split('/')[-2] + '.md')), link)
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


class Refuses(unittest.TestCase):
    """The converter stops, naming the document and the field, on anything it does not know (projects and the profile)."""
    CTX = ({'my-homelab'}, {'homelab', 'other'}, {'f.pdf'})

    def project(self, **kw):
        doc = {'_id': 'x', '_type': 'project', 'slug': {'current': 't'}, 'title': 'T', 'name': 'N', 'summary': 'S', 'designation': 1,
               'status': 'active', 'body': []}
        doc.update(kw)
        return {k: v for k, v in doc.items() if v is not None}

    def convert(self, **kw):
        notes = []
        return conv.project_header('t', self.project(**kw), self.CTX, lambda *a: None, notes), notes

    def refused(self, word, **kw):
        with self.assertRaises(conv.ConvertError, msg=str(kw)) as cm:
            self.convert(**kw)
        self.assertIn('t.json', str(cm.exception))
        self.assertIn(word, str(cm.exception))

    def test_a_minimal_project(self):
        text, notes = self.convert()
        self.assertEqual(text, '---\ntitle: "T"\nname: "N"\nsummary: "S"\norder: 1\nstatus: active\n---\n')
        self.assertEqual(notes, [])

    def test_unknown_and_malformed_fields_are_named(self):
        self.refused('`colour`', colour='red')
        self.refused('`_extra`', _extra=1)
        self.refused('`mood`', brief={'problem': 'p', 'approach': 'a', 'mood': 'x'})
        self.refused('`weight`', links=[{'kind': 'repo', 'label': 'l', 'url': 'https://e.org', 'weight': 1}])
        self.refused('`note2`', results=[{'metric': 'm', 'value': 'v', 'note2': 'x'}])
        self.refused('`unit`', parameters=[{'label': 'l', 'value': 'v', 'unit': 'u'}])
        self.refused('`size`', cover={'alt': 'a', 'asset': {'_ref': 'image-' + 'a' * 40 + '-1x1-png'}, 'size': 1})
        self.refused('slug', slug={'current': 'other'})
        for k, v in (('title', ''), ('title', ' x'), ('title', 'a\nb'), ('title', None), ('designation', 0), ('designation', True),
                     ('designation', '1'), ('startDate', '2026-1-1'), ('endDate', '2026-02-30'), ('quiet', 'yes'), ('featured', 1.5),
                     ('highlights', 'one'), ('highlights', ['']), ('types', [3])):
            with self.subTest((k, v)):
                with self.assertRaises(conv.ConvertError):
                    self.convert(**{k: v})

    def test_brief_needs_problem_and_approach(self):
        self.refused('brief', brief={'problem': 'p'})
        self.refused('brief', brief={})

    def test_links(self):
        text, _ = self.convert(links=[
            {'kind': 'article', 'label': 'A', 'url': 'https://adithya-rajendran.com/blog/my-homelab'},
            {'kind': 'article', 'label': 'B', 'url': 'https://adithya-rajendran.com/portfolio/other/'},
            {'kind': 'paper', 'label': 'C', 'url': CDN + 'f.pdf'},
            {'kind': 'other', 'label': 'D', 'url': 'https://adithya-rajendran.com'}])
        self.assertIn('    post: my-homelab\n', text)
        self.assertIn('    project: other\n', text)
        self.assertIn('    file: "f.pdf"\n', text)
        self.assertIn('    url: "https://adithya-rajendran.com"\n', text)
        for url in ('https://adithya-rajendran.com/blog/no-such', 'https://adithya-rajendran.com/blog/my-homelab#x', CDN + 'no.pdf',
                    'ftp://e.org/x', 'javascript:alert(1)', 'mailto:a@b.c', '/blog/my-homelab/'):
            self.refused('link', links=[{'kind': 'x', 'label': 'l', 'url': url}])

    def test_the_model_is_dropped_with_a_note(self):
        text, notes = self.convert(model={'title': 'The rack'})
        self.assertNotIn('rack', text)
        self.assertEqual(len(notes), 1)
        self.assertIn('t: `model` is not carried', notes[0])

    def test_markdown_in_sentences_is_escaped(self):
        text, _ = self.convert(highlights=['Uses *star* and snake_case and [x](y)'], lessons=['1. first'])
        self.assertIn('  - "Uses \\\\*star\\\\* and snake_case and \\\\[x\\\\](y)"\n', text)      # JSON writes each backslash twice
        self.assertIn('  - "1\\\\. first"\n', text)

    def test_the_profile(self):
        doc = jload(os.path.join(DATA, 'profile', 'profile.json'))
        ids = ({'d25c7eae-cbdf-4fd0-8736-8f87f09b32af': 'my-homelab'}, {'9a1c5b00-0db9-42bd-8c0c-65c5f914db5b': 'robot-scene-memory',
                                                                      '9d255b8d-a514-4ebb-9ae8-bc2edc90b46b': 'driving-detection-evaluation'})
        ctx = ({'my-homelab'}, set(ids[1].values()), {'fc41d42d9b66390887e20ff239a1361e55975238.pdf', 'e70b01e95fdcf9f4e5d8ad06a0e32b28f62060c2.pdf'})

        def run(change):
            d = copy.deepcopy(doc)
            change(d)
            return conv.profile_json(d, ids, ctx, lambda *a: None, [])
        run(lambda d: None)
        cases = {
            '`mood`': lambda d: d.__setitem__('mood', 1),
            '`_secret`': lambda d: d.__setitem__('_secret', 1),
            'timeline[1]': lambda d: d['timeline'][1].__setitem__('salary', 1),
            'credentials[0]': lambda d: d['credentials'][0].__setitem__('score', 1),
            'availability': lambda d: d['availability'].__setitem__('mood', 1),
            'contactRoutes.hello': lambda d: d['contactRoutes']['hello'].__setitem__('mood', 1),
            'skillGroups[0]': lambda d: d['skillGroups'][0].__setitem__('level', 1),
            'talksAndPapers[0]': lambda d: d['talksAndPapers'][0].__setitem__('doi', 1),
            'featuredPost': lambda d: d['featuredPost'].__setitem__('_ref', 'nothing'),
            'resume': lambda d: d['resume']['asset'].__setitem__('_ref', 'file-' + '0' * 40 + '-pdf'),
            'startDate': lambda d: d['timeline'][0].__setitem__('startDate', '2026-13-01'),
            'expectedEndYear': lambda d: d['timeline'][0].__setitem__('expectedEndYear', True),
            'lifetime': lambda d: d['credentials'][0].__setitem__('lifetime', 'no'),
            'curiositiesUpdatedAt': lambda d: d.__setitem__('curiositiesUpdatedAt', '2026-10-26'),
            'socialLinks[0]': lambda d: d['socialLinks'][0].__setitem__('url', 'javascript:alert(1)'),
            'the id': lambda d: d['timeline'][0].__setitem__('orgShort', d['timeline'][1]['orgShort']) or d['timeline'][0].__setitem__('startDate', '2024-01-01'),
            'bio': lambda d: d.__setitem__('bio', 'a\n\n\nb'),
        }
        for word, change in cases.items():
            with self.subTest(word):
                with self.assertRaises(conv.ConvertError) as cm:
                    run(change)
                self.assertIn('profile.json', str(cm.exception))
                self.assertIn(word, str(cm.exception))


class Overwrite(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='sanity-md-')
        os.makedirs(os.path.join(self.tmp, 'data', 'posts'))
        for f in glob.glob(os.path.join(DATA, 'posts', '*.json')):
            shutil.copy(f, os.path.join(self.tmp, 'data', 'posts'))
        for d in ('projects', 'profile'):                    # copies: the converter writes .md files beside the .json ones
            os.makedirs(os.path.join(self.tmp, 'data', d))
            for f in glob.glob(os.path.join(DATA, d, '*.json')):
                shutil.copy(f, os.path.join(self.tmp, 'data', d))
        os.symlink(os.path.join(DATA, 'assets'), os.path.join(self.tmp, 'data', 'assets'))
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
        rc, out = self.run_main()
        self.assertEqual((rc, out.count('wrote')), (0, 15))     # 4 posts, 10 projects, the profile
        written = {f: read(os.path.join(posts_dir, f), 'rb') for f in os.listdir(posts_dir) if f.endswith('.md')}
        self.assertEqual(len(written), 4)
        rc, out = self.run_main()                           # twice in a row: nothing changes
        self.assertEqual((rc, out.count('unchanged')), (0, 15))
        for rel in ('projects/homelab.md', 'profile.json'):  # the copies are what the repository has
            self.assertEqual(read(os.path.join(self.tmp, 'data', rel), 'rb'), read(os.path.join(DATA, rel), 'rb'), rel)
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


    def test_projects_and_profile_are_protected_too(self):
        self.run_main()
        for rel in ('projects/homelab.md', 'profile.json'):
            path = os.path.join(self.tmp, 'data', rel)
            good = read(path, 'rb')
            with open(path, 'a', encoding='utf-8') as f:
                f.write('\n')
            rc, out = self.run_main()
            self.assertEqual(rc, 1, rel)
            self.assertIn('DIFFERS    ' + os.path.join('data', rel), out)
            self.assertNotEqual(read(path, 'rb'), good)         # left alone
            self.assertEqual(self.run_main('--force')[0], 0)
            self.assertEqual(read(path, 'rb'), good, rel)


# ---------- projects: data/projects/<slug>.md against data/projects/<slug>.json

PROJECT_CARRIED = {'title', 'name', 'summary', 'status', 'statusNote', 'myRole', 'startDate', 'endDate', 'datePrecision', 'datesApproximate',
                   'featured', 'quiet', 'designation', 'types', 'technologies', 'highlights', 'lessons', 'next', 'brief', 'cover',
                   'parameters', 'results', 'links', 'body', 'slug'}
PROJECT_DROPPED = {'model', '_id', '_type', '_rev', '_createdAt', '_updatedAt', '_system'}


def image_name(ref):
    stem, ext = ref[len('image-'):].rsplit('-', 1)
    return f'{stem}.{ext}'


def expected_link(l):
    """The link record the file must hold for a Sanity link: its address, or the post, project or file it names."""
    out = {'label': l['label'], 'kind': l['kind'], 'url': None, 'post': None, 'project': None, 'file': None}
    for old, k in ((SITE_URL + '/blog/', 'post'), (SITE_URL + '/portfolio/', 'project')):
        if l['url'].startswith(old):
            return dict(out, **{k: l['url'][len(old):].rstrip('/')})
    if l['url'].startswith(CDN):
        return dict(out, file=l['url'][len(CDN):])
    return dict(out, url=l['url'])


def project_diffs(doc, p):
    """What differs between a Sanity project and the loader's dict for its .md file (a list of sentences; [] = faithful)."""
    d = []

    def eq(what, got, want):
        if got != want:
            d.append(f'{what}: {got!r}, want {want!r}')
    eq('slug', p['slug'], doc['slug']['current'])
    for sk, hk in (('title', 'title'), ('name', 'name'), ('summary', 'summary'), ('status', 'status'), ('statusNote', 'status_note'),
                   ('myRole', 'role'), ('startDate', 'started'), ('endDate', 'ended'), ('datePrecision', 'date_precision'),
                   ('datesApproximate', 'dates_approximate'), ('featured', 'featured'), ('quiet', 'quiet'), ('designation', 'order')):
        eq(hk, p[hk], doc.get(sk))
    for k in ('types', 'technologies'):
        eq(k, p[k], doc.get(k) or [])
    for sk, hk in (('highlights', 'highlights'), ('lessons', 'lessons'), ('next', 'next_steps')):
        eq(hk, [plain(x) for x in p[hk]], doc.get(sk) or [])
    brief = doc.get('brief') or {}
    for k in ('problem', 'approach', 'outcome'):
        eq(k, p[k], brief.get(k))
    cover = doc.get('cover') or {}
    eq('cover', p['cover'], image_name(cover['asset']['_ref']) if cover else None)
    eq('cover_alt', p['cover_alt'], cover.get('alt'))
    eq('cover_caption', p['cover_caption'], cover.get('caption'))
    eq('parameters', p['parameters'], [{'label': x['label'], 'value': x['value']} for x in doc.get('parameters') or []])
    eq('results', p['results'], [{'metric': x['metric'], 'value': x['value'], 'note': x.get('note')} for x in doc.get('results') or []])
    eq('links', p['links'], [expected_link(x) for x in doc.get('links') or []])
    a, b = md_blocks(p['body']), json_blocks(doc)
    if len(a) != len(b):
        d.append(f'body: {len(a)} blocks, want {len(b)}')
    for n, (x, y) in enumerate(zip(a, b), 1):
        eq(f'body block {n}', x, y)
    eq('body links', link_runs(a), link_runs(b))
    want = ''.join(''.join(sp['text'].split()) for blk in doc['body'] for sp in blk['children'])
    got = ''.join(''.join(k[-1][i][0] for i in range(len(k[-1]))) for k in a if k[0] in ('p', 'h', 'li', 'quote'))
    eq('body words', got, want)
    return d


def projects():
    by_slug = {p['slug']: p for p in content.load_projects()}
    for f in sorted(glob.glob(os.path.join(DATA, 'projects', '*.json'))):
        slug = os.path.basename(f)[:-5]
        yield slug, jload(f), by_slug[slug]


class ProjectsFaithful(unittest.TestCase):
    def test_ten_projects(self):
        self.assertEqual(len(list(projects())), 10)

    def test_every_project_says_what_its_document_said(self):
        for slug, doc, p in projects():
            self.assertEqual(project_diffs(doc, p), [], slug)

    def test_every_field_is_carried_or_listed_as_dropped(self):
        seen = {k for _, doc, _ in projects() for k in doc}
        self.assertEqual(seen - PROJECT_CARRIED - PROJECT_DROPPED, set())
        readme = read(os.path.join(DATA, 'README.md'))
        for k in PROJECT_DROPPED - {'_type', '_rev', '_createdAt', '_updatedAt', '_system', '_id'}:
            self.assertIn(f'`{k}`', readme)
        for k in ('_id', '_rev', '_createdAt', '_updatedAt', '_system'):
            self.assertIn(k, readme)
        self.assertEqual(conv.PROJECT_FIELDS, PROJECT_CARRIED | {'model'})

    def test_the_counts_nothing_was_lost(self):
        """Every prose word, highlight, lesson, link, parameter and result is in the loader's data."""
        tot = collections.Counter()
        for slug, doc, p in projects():
            tot['words'] += sum(len(s['text'].split()) for b in doc['body'] for s in b['children'])
            for k, pk in (('highlights', 'highlights'), ('lessons', 'lessons'), ('links', 'links'), ('parameters', 'parameters'),
                          ('results', 'results'), ('next', 'next_steps')):
                self.assertEqual(len(p[pk]), len(doc.get(k) or []), (slug, k))
                tot[k] += len(p[pk])
        self.assertEqual((tot['highlights'], tot['lessons'], tot['links'], tot['parameters'], tot['results'], tot['next']),
                         (29, 4, 15, 25, 7, 3))
        self.assertGreater(tot['words'], 1000)

    def test_the_header_holds_only_known_fields(self):
        for slug, doc, _ in projects():
            with open(os.path.join(DATA, 'projects', slug + '.md'), encoding='utf-8') as f:
                head, _ = content.split(f.read(), slug)
            self.assertLessEqual(set(head), set(content.PROJECT_KNOWN), slug)
            # fields the document has, written under their file names
            self.assertEqual({'title', 'name', 'summary', 'order', 'status'} <= set(head), True)
            self.assertEqual('model' in doc, slug == 'homelab')

    def test_links_to_other_pages_name_them(self):
        n = collections.Counter()
        for _, doc, p in projects():
            for l in p['links']:
                n[tuple(k for k in ('url', 'post', 'project', 'file') if l[k])] += 1
        self.assertEqual(n, {('url',): 11, ('post',): 3, ('file',): 1})


class ProjectsMutations(unittest.TestCase):
    """Break what the loader returns in a way a faulty conversion could, and require project_diffs to notice. A change
    returns True when it applied to that project (some have no links, no results, ...); it must apply to at least one."""

    def mutated(self, change):
        n = 0
        for slug, doc, p in projects():
            q = copy.deepcopy(p)
            if change(q):
                n += 1
                self.assertNotEqual(project_diffs(doc, q), [], f'{slug}: the change was not noticed')
        self.assertGreater(n, 0)

    def test_the_unchanged_passes(self):
        for _, doc, p in projects():
            self.assertEqual(project_diffs(doc, copy.deepcopy(p)), [])

    def test_header_fields(self):
        def text(k):
            def change(q):
                if q[k] is None:
                    return False
                q[k] = '~' + q[k]
                return True
            return change
        for k in ('title', 'name', 'summary', 'status_note', 'role', 'problem', 'approach', 'outcome', 'cover_alt', 'cover_caption',
                  'cover', 'started', 'ended', 'date_precision'):
            with self.subTest(k):
                self.mutated(text(k))

        def put(k, f):
            def change(q):
                if q[k] is None:
                    return False
                q[k] = f(q[k])
                return True
            return change
        self.mutated(put('status', lambda v: 'completed' if v == 'active' else 'active'))
        self.mutated(put('order', lambda v: v + 20))
        self.mutated(put('featured', lambda v: v + 9))
        self.mutated(put('dates_approximate', lambda v: not v))
        self.mutated(put('quiet', lambda v: None))
        self.mutated(put('types', lambda v: v[::-1] if len(v) > 1 else v + ['hardware']))
        self.mutated(put('technologies', lambda v: v[:-1]))

    def test_lists(self):
        def pop_last(k):
            return lambda q: bool(q[k]) and q[k].pop() is not None
        for k in ('highlights', 'lessons', 'next_steps', 'parameters', 'results', 'links'):
            with self.subTest(k):
                self.mutated(pop_last(k))

        def swap(k):                                        # two items trade places
            def change(q):
                if len(q[k]) < 2:
                    return False
                q[k][0], q[k][1] = q[k][1], q[k][0]
                return True
            return change
        for k in ('highlights', 'parameters', 'links'):
            self.mutated(swap(k))

        def first(k, f):
            def change(q):
                if not q[k]:
                    return False
                f(q[k][0])
                return True
            return change
        self.mutated(lambda q: bool(q['highlights']) and q.__setitem__('highlights', ['~' + q['highlights'][0]] + q['highlights'][1:]) is None)
        self.mutated(first('parameters', lambda x: x.__setitem__('value', x['value'] + '.')))
        self.mutated(first('parameters', lambda x: x.__setitem__('label', x['label'] + '.')))
        self.mutated(first('results', lambda x: x.__setitem__('note', None)))
        self.mutated(first('results', lambda x: x.__setitem__('value', x['value'] + '%')))
        self.mutated(first('links', lambda x: x.__setitem__('kind', 'other' if x['kind'] != 'other' else 'repo')))
        self.mutated(first('links', lambda x: x.__setitem__('label', x['label'] + '.')))
        self.mutated(first('links', lambda x: x.update(**{k: x[k] + 'x' for k in ('url', 'post', 'project', 'file') if x[k]})))

    def test_body(self):
        def body(f):
            def change(q):
                new = f(q['body'])
                changed = new != q['body']
                q['body'] = new
                return changed
            return change
        self.mutated(body(lambda b: b.replace(' the ', ' a ', 1)))                               # one word
        self.mutated(body(lambda b: b.split('\n\n', 1)[1]))                                      # the first block is lost
        self.mutated(body(lambda b: b.rsplit('\n\n', 1)[0] + '\n'))                              # the last block is lost
        self.mutated(body(lambda b: b.replace('## ', '### ', 1)))                                # a heading's level
        self.mutated(body(lambda b: re.sub(r'\]\(/(blog|portfolio)/[^)]*\)', '](https://example.org/)', b, count=1)))   # a link's target
        self.mutated(body(lambda b: b + '\nExtra words.\n'))
        self.mutated(body(lambda b: re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', b, count=1)))                # a link lost, its text kept


# ---------- the profile: data/profile.json against data/profile/profile.json

def snake_name(k):
    return re.sub(r'([A-Z])', lambda m: '_' + m.group(1).lower(), k)


def resolve(ref):
    """A Sanity reference's target as the new file names it: an image or file name, or a post's or project's slug."""
    if ref.startswith('image-'):
        return image_name(ref)
    if ref.startswith('file-'):
        stem, ext = ref[len('file-'):].rsplit('-', 1)
        return f'{stem}.{ext}'
    for f in glob.glob(os.path.join(DATA, 'posts', '*.json')) + glob.glob(os.path.join(DATA, 'projects', '*.json')):
        if jload(f)['_id'] == ref:
            return os.path.basename(f)[:-5]
    raise AssertionError(f'a reference to nothing: {ref}')


def sanity_leaves(node, key=None, out=None):
    """Every leaf of a Sanity document, as (type, value), without Sanity's bookkeeping (keys starting with _), with a
    reference replaced by its target and the one timestamp by its date."""
    out = collections.Counter() if out is None else out
    if isinstance(node, dict):
        for k, v in node.items():
            if k == '_ref':
                out[('str', resolve(v))] += 1
            elif not k.startswith('_'):
                sanity_leaves(v, k, out)
    elif isinstance(node, list):
        for v in node:
            sanity_leaves(v, key, out)
    else:
        if key == 'curiositiesUpdatedAt':
            node = node[:10]
        elif key == 'url' and node.startswith(CDN):         # a link to a CDN file names the file instead
            node = node[len(CDN):]
        out[(type(node).__name__, node)] += 1
    return out


def new_leaves(node, out=None):
    out = collections.Counter() if out is None else out
    if isinstance(node, dict):
        for k, v in node.items():
            if k != 'id':                                   # the timeline's ids are new
                new_leaves(v, out)
    elif isinstance(node, list):
        for v in node:
            new_leaves(v, out)
    else:
        out[(type(node).__name__, node)] += 1
    return out


def expected_value(k, v):
    """What the new file holds for the Sanity field k = v, as {new field: value} (references and images flattened)."""
    n = snake_name(k)
    if isinstance(v, dict) and 'asset' in v:                # an image {alt, asset}, or the resume {asset}
        out = {n: resolve(v['asset']['_ref'])}
        if 'alt' in v:
            out[n + '_alt'] = v['alt']
        return out
    if isinstance(v, dict) and '_ref' in v:
        return {n: resolve(v['_ref'])}
    if k == 'curiositiesUpdatedAt':
        return {n: v[:10]}
    if k == 'seeking':
        return {n: [x['label'] for x in v]}
    if k == 'links' and v and isinstance(v[0], dict):
        return {n: [{f: x for f, x in expected_link(l).items() if x is not None} for l in v]}
    if k == 'contactRoutes':
        return {n: {r: {a: b for a, b in rec.items() if not a.startswith('_')} for r, rec in v.items()}}
    if isinstance(v, list) and v and isinstance(v[0], dict):
        return {n: [expected_record(x) for x in v]}
    if isinstance(v, dict):
        return {n: expected_record(v)}
    return {n: v}


def expected_record(rec):
    out = {}
    for k, v in rec.items():
        if not k.startswith('_'):
            out.update(expected_value(k, v))
    return out


def subset(want, got, path='profile'):
    """Differences where `want` (a nested value) is not what `got` holds; fields in got that want lacks are fine (ids)."""
    if isinstance(want, dict):
        if not isinstance(got, dict):
            return [f'{path}: not a record']
        return [d for k, v in want.items() for d in (subset(v, got[k], f'{path}.{k}') if k in got else [f'{path}.{k}: missing'])]
    if isinstance(want, list):
        if not isinstance(got, list) or len(got) != len(want):
            return [f'{path}: {len(got) if isinstance(got, list) else got!r} items, want {len(want)}']
        return [d for i, (a, b) in enumerate(zip(want, got)) for d in subset(a, b, f'{path}[{i}]')]
    return [] if (type(want), want) == (type(got), got) else [f'{path}: {got!r}, want {want!r}']


def profile_diffs(old, new):
    d = subset(expected_record(old), new)
    extra = set(new) - {snake_name(k) for k in old if not k.startswith('_')}
    d += [f'profile: a field the document does not have: {k}' for k in extra]
    a, b = sanity_leaves(old), new_leaves(new)
    d += [f'leaf lost: {k} x{n}' for k, n in (a - b).items()]
    d += [f'leaf invented: {k} x{n}' for k, n in (b - a).items()]
    return d


def bad_keys(node):
    if isinstance(node, dict):
        return [k for k in node if k.startswith('_') or k in ('asset', 'children', 'markDefs')] + [x for v in node.values() for x in bad_keys(v)]
    return [x for v in node for x in bad_keys(v)] if isinstance(node, list) else []


class ProfileFaithful(unittest.TestCase):
    def setUp(self):
        self.old, self.new = jload(os.path.join(DATA, 'profile', 'profile.json')), jload(os.path.join(DATA, 'profile.json'))

    def test_every_leaf_is_in_the_new_file_and_nothing_else(self):
        self.assertEqual(profile_diffs(self.old, self.new), [])
        n = sum(sanity_leaves(self.old).values())
        self.assertEqual(n, sum(new_leaves(self.new).values()))
        self.assertGreater(n, 150)

    def test_leaf_types_survive(self):
        """Numbers stay numbers and booleans stay booleans."""
        types = collections.Counter(t for t, _ in sanity_leaves(self.old).elements())
        self.assertEqual(types, collections.Counter(t for t, _ in new_leaves(self.new).elements()))
        self.assertEqual((types['int'], types['bool']), (1, 5))

    def test_no_sanity_bookkeeping(self):
        self.assertEqual(bad_keys(self.new), [])
        text = read(os.path.join(DATA, 'profile.json'))
        for w in ('cdn.sanity.io', '_ref', '_key', '"image-', '"file-'):
            self.assertNotIn(w, text)

    def test_names_are_snake_case(self):
        def keys(node, path=()):
            if isinstance(node, dict):
                for k, v in node.items():
                    if path[-1:] != ('contact_routes',):    # the route names are data, and happen to be words too
                        yield k
                    yield from keys(v, path + (k,))
            elif isinstance(node, list):
                for v in node:
                    yield from keys(v, path)
        for k in keys(self.new):
            self.assertRegex(k, r'^[a-z][a-z0-9]*(_[a-z0-9]+)*$')

    def test_dates_are_dates_and_ids_derive_from_the_organization(self):
        def walk(node, k=''):
            if isinstance(node, dict):
                for a, b in node.items():
                    yield from walk(b, a)
            elif isinstance(node, list):
                for b in node:
                    yield from walk(b, k)
            elif k.endswith(('_date', '_on', '_at')) or k == 'date':
                yield k, node
        found = list(walk(self.new))
        self.assertGreaterEqual(len(found), 12)
        for k, v in found:
            self.assertRegex(v, r'^\d{4}-\d{2}-\d{2}$', k)
        ids = [e['id'] for e in self.new['timeline']]
        self.assertEqual(ids, [f'{e["org_short"].lower()}-{e["start_date"][:4]}' for e in self.new['timeline']])
        self.assertEqual(ids, ['sjsu-2026', 'canonical-2024', 'tcr-2023', 'ucsc-2019'])
        self.assertEqual(len(set(ids)), len(ids))

    def test_references_are_slugs_and_files_are_names(self):
        n = self.new
        self.assertEqual(n['featured_post'], 'my-homelab')
        self.assertEqual(n['current_curiosities'][0]['project'], 'robot-scene-memory')
        self.assertEqual(n['talks_and_papers'][0]['project'], 'driving-detection-evaluation')
        self.assertEqual(n['talks_and_papers'][0]['links'][0], {'label': 'Read report (PDF)', 'kind': 'paper',
                                                               'file': 'fc41d42d9b66390887e20ff239a1361e55975238.pdf'})
        self.assertEqual(n['resume'], 'e70b01e95fdcf9f4e5d8ad06a0e32b28f62060c2.pdf')
        self.assertEqual(n['timeline'][1]['logo'], 'a005c7a111c8b681ac58093d9102134ac731fcc3-512x512.webp')
        self.assertEqual(n['curiosities_updated_at'], '2026-10-26')

    def test_the_loader_returns_it(self):
        prof = content.load_profile()
        self.assertEqual(prof['name'], self.old['name'])
        def bare(node):                                     # without the None and [] the loader adds for what is absent
            if isinstance(node, dict):
                return {k: bare(v) for k, v in node.items() if v not in (None, [])}
            return [bare(v) for v in node] if isinstance(node, list) else node
        self.assertEqual(bare(prof), self.new)
        self.assertEqual(profile_diffs(self.old, bare(prof)), [])


class ProfileMutations(unittest.TestCase):
    """Break the new file in memory and require profile_diffs to notice: a leaf changed, lost, invented or moved."""

    def setUp(self):
        self.old, self.new = jload(os.path.join(DATA, 'profile', 'profile.json')), jload(os.path.join(DATA, 'profile.json'))

    def noticed(self, what, change):
        new = copy.deepcopy(self.new)
        change(new)
        self.assertNotEqual(profile_diffs(self.old, new), [], what)

    def test_the_unchanged_passes(self):
        self.assertEqual(profile_diffs(self.old, copy.deepcopy(self.new)), [])

    def test_breaks(self):
        t = lambda n: n['timeline'][1]
        cases = {
            'a word in the bio': lambda n: n.__setitem__('bio', n['bio'].replace('Canonical', 'Canonica', 1)),
            'the bio loses a paragraph': lambda n: n.__setitem__('bio', n['bio'].split('\n\n', 1)[1]),
            'a name': lambda n: n.__setitem__('name', 'A. Rajendran'),
            'a leaf dropped (location)': lambda n: n.pop('location'),
            'two fields swapped': lambda n: n.update(headline=n['tagline'], tagline=n['headline']),
            'a number as text': lambda n: n['timeline'][0].__setitem__('expected_end_year', '2028'),
            'a number changed': lambda n: n['timeline'][0].__setitem__('expected_end_year', 2029),
            'a boolean flipped': lambda n: n['credentials'][0].__setitem__('lifetime', True),
            'a boolean as a number': lambda n: n['credentials'][0].__setitem__('lifetime', 0),
            'a highlight lost': lambda n: t(n)['highlights'].pop(),
            'highlights reordered': lambda n: t(n)['highlights'].reverse(),
            'a highlight moved to another entry': lambda n: n['timeline'][2]['highlights'].append(t(n)['highlights'].pop()),
            'an entry lost': lambda n: n['timeline'].pop(),
            'a date': lambda n: t(n).__setitem__('start_date', '2024-06-01'),
            'a date with its time': lambda n: n.__setitem__('curiosities_updated_at', '2026-10-26T01:47:15Z'),
            'a skill lost': lambda n: n['skill_groups'][0]['skills'].pop(),
            'a skill moved': lambda n: n['skill_groups'][1]['skills'].append(n['skill_groups'][0]['skills'].pop()),
            'a link address': lambda n: n['social_links'][0].__setitem__('url', 'https://example.org/'),
            'a link kind': lambda n: n['talks_and_papers'][0]['links'][1].__setitem__('kind', 'repo'),
            'a link target': lambda n: n['talks_and_papers'][0]['links'][0].__setitem__('file', 'e70b01e95fdcf9f4e5d8ad06a0e32b28f62060c2.pdf'),
            'a slug': lambda n: n.__setitem__('featured_post', 'kubernetes-on-the-nvidia-dgx-spark'),
            'a project slug': lambda n: n['current_curiosities'][0].__setitem__('project', 'homelab'),
            'a reference lost': lambda n: n['current_curiosities'][0].pop('project'),
            'the resume': lambda n: n.__setitem__('resume', 'fc41d42d9b66390887e20ff239a1361e55975238.pdf'),
            'a logo': lambda n: t(n).__setitem__('logo', 'ceb88ce338a7bfc4ab9d0c9562fbc2a34c2cc6ae-340x340.png'),
            'alt text lost': lambda n: n['credentials'][0].pop('badge_alt'),
            'a contact route lost': lambda n: n['contact_routes'].pop('hello'),
            'a contact route renamed': lambda n: n['contact_routes'].__setitem__('hi', n['contact_routes'].pop('hello')),
            'an opening lost': lambda n: n['availability']['seeking'].pop(),
            'a field invented': lambda n: n.__setitem__('extra', 'x'),
            'a Sanity key left in': lambda n: n['timeline'][0].__setitem__('_key', 'sjsu-ms-engineering'),
            'a record of nothing': lambda n: n['credentials'].append({}),
        }
        for what, change in cases.items():
            with self.subTest(what):
                self.noticed(what, change)


if __name__ == '__main__':
    unittest.main()
