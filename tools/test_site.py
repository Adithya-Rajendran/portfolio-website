# Tests for the posts that tools/site.py writes
import contextlib, importlib.util, io, json, os, random, re, shutil, tempfile, time, unittest
from html.parser import HTMLParser

TOOLS = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sitegen', os.path.join(TOOLS, 'site.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
FIXTURE = os.path.join(TOOLS, 'testdata', 'posts')
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
RACK = '05754647a9226f0938def18645edaef5169c8aec-3000x4000.jpg'
CARD = '5eeba53d61f7407b70834e8c7526f2a7d8b960a1-1200x630.png'


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def text(self):
        return ''.join(c if isinstance(c, str) else c.text() for c in self.children)

    def all(self, tag=None, cls=None):
        for c in self.children:
            if isinstance(c, Node):
                if (tag is None or c.tag == tag) and (cls is None or cls in c.attrs.get('class', '').split()):
                    yield c
                yield from c.all(tag, cls)

    def one(self, tag=None, cls=None):
        found = list(self.all(tag, cls))
        assert len(found) == 1, f'{len(found)} <{tag} class={cls}>'
        return found[0]

    def kids(self, tag=None):
        return [c for c in self.children if isinstance(c, Node) and (tag is None or c.tag == tag)]


class Tree(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = self.cur = Node('#root', {})
        self.errors, self.ids = [], []
        self.feed(text); self.close()
        if self.cur is not self.root:
            self.errors.append(f'not closed: <{self.cur.tag}>')

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.cur)
        self.cur.children.append(node)
        if 'id' in node.attrs:
            self.ids.append(node.attrs['id'])
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.cur = self.cur.parent

    def handle_endtag(self, tag):
        if tag in VOID or self.cur.tag != tag:
            self.errors.append(f'</{tag}> closes <{self.cur.tag}> at {self.getpos()}')
        else:
            self.cur = self.cur.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def generate(posts, out):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
        s.main(['--posts', posts, '--out', out])
    return buf.getvalue()


def snapshot(folder):
    return {os.path.relpath(os.path.join(d, f), folder): os.stat(os.path.join(d, f)).st_mtime_ns
            for d, _, fs in os.walk(folder) for f in fs}


def media_url(file):
    return '/blog/media/' + s.media_name(os.path.join(s.DATA, 'assets', 'images', file))


class Shell(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='test-shell-')
        self.addCleanup(shutil.rmtree, self.tmp)
        with open(s.SHELL, encoding='utf-8') as f:
            self.source = f.read()

    def run_with(self, text):
        shell, out = os.path.join(self.tmp, 'index.html'), os.path.join(self.tmp, 'out')
        with open(shell, 'w', encoding='utf-8') as f:
            f.write(text)
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            s.main(['--posts', FIXTURE, '--shell', shell, '--out', out])
        return out

    def test_default_shell_is_the_source_shell(self):
        self.assertEqual(s.SHELL, os.path.join(s.ROOT, 'index.html'))
        self.assertIn('<script type="module" src="/src/main.js"></script>', self.source)

    def test_pages_come_from_the_given_shell(self):
        built = self.source.replace('<script type="module" src="/src/main.js"></script>',
                                    '<script type="module" crossorigin src="/app/index-test.js"></script>')
        self.assertNotEqual(built, self.source)
        out = self.run_with(built)
        with open(os.path.join(out, 'blog', 'every-construct', 'index.html'), encoding='utf-8') as f:
            page = f.read()
        self.assertIn('<script type="module" crossorigin src="/app/index-test.js"></script>', page)
        self.assertNotIn('/src/main.js', page)

    def test_a_shell_without_a_mark_writes_nothing(self):
        with self.assertRaises(SystemExit) as e:
            self.run_with(self.source.replace('<!--site:page-->', ''))
        self.assertIn('<!--site:page-->', str(e.exception.code))
        self.assertFalse(os.path.exists(os.path.join(self.tmp, 'out')))


class Site(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='test-site-')
        cls.out = os.path.join(cls.tmp, 'out')
        cls.log = generate(FIXTURE, cls.out)
        with open(os.path.join(cls.out, 'blog', 'every-construct', 'index.html'), encoding='utf-8') as f:
            cls.html = f.read()
        with open(s.SHELL, encoding='utf-8') as f:
            cls.shell = f.read()
        cls.tree = Tree(cls.html).root

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def fresh_out(self):
        out = tempfile.mkdtemp(dir=self.tmp)
        shutil.copytree(self.out, out, dirs_exist_ok=True)
        return out

    def posts_dir(self, **extra):
        d = tempfile.mkdtemp(dir=self.tmp)
        shutil.copy(os.path.join(FIXTURE, 'every-construct.md'), d)
        for slug, text in extra.items():
            with open(os.path.join(d, f'{slug}.md'), 'w', encoding='utf-8') as f:
                f.write(text)
        return d

    def test_every_construct(self):
        main = self.html[self.html.index('<main id="page">'):self.html.index('</main>') + 7]
        self.assertEqual(main, EXPECTED_MAIN.replace('RACK', media_url(RACK)).replace('CARDWEBP', media_url(CARD)))

    def test_head(self):
        head = self.html[self.html.index('<title>'):self.html.index('<link rel="stylesheet"')]
        title = 'Every construct: a post that uses all of the Markdown the site accepts'
        url = 'https://adithya-rajendran.com/blog/every-construct/'
        self.assertIn(f'<title>{title} — Adithya Rajendran</title>', head)
        for tag in ['<meta name="description" content="A fixture for the renderer&#x27;s tests. It has a colon: here, &quot;quotes&quot;, '
                    'an &lt;angle&gt; and an &amp; ampersand, which must all arrive intact.">',
                    f'<link rel="canonical" href="{url}">', '<meta property="og:type" content="article">',
                    f'<meta property="og:title" content="{title}">', f'<meta property="og:url" content="{url}">',
                    f'<meta property="og:image" content="https://adithya-rajendran.com/blog/media/{CARD}">',
                    '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
                    '<meta property="og:image:alt" content="A card with the post&#x27;s title.">',
                    '<meta property="article:published_time" content="2026-01-15">',
                    '<meta property="article:modified_time" content="2026-02-01">',
                    '<meta name="twitter:card" content="summary_large_image">',
                    '<link rel="alternate" type="application/rss+xml" title="Adithya Rajendran — Writing" href="/feed.xml">']:
            self.assertIn(tag, head)
        ld = json.loads(next(n for n in self.tree.all('script') if n.attrs.get('type') == 'application/ld+json').text())
        self.assertEqual(ld['@type'], 'BlogPosting')
        self.assertEqual((ld['headline'], ld['datePublished'], ld['dateModified'], ld['author']['name'], ld['wordCount']),
                         (title, '2026-01-15', '2026-02-01', 'Adithya Rajendran', 124))
        self.assertEqual((ld['mainEntityOfPage']['@id'], ld['image'], ld['keywords']),
                         (url, f'https://adithya-rajendran.com/blog/media/{CARD}', 'fixtures, markdown'))
        self.assertIn('an <angle>', ld['description'])

    def test_shell_unchanged_outside_the_three_replacements(self):
        a, b = self.shell.index('<title>') + 7, self.shell.index('</title>')
        pieces = [self.shell[:a], self.shell[b:self.shell.index('<!--site:head-->')],
                  self.shell[self.shell.index('<!--site:head-->') + 16:self.shell.index('<!--site:page-->')],
                  self.shell[self.shell.index('<!--site:page-->') + 16:]]
        pattern = re.compile('(?s)' + '(.*?)'.join(re.escape(p) for p in pieces))
        for page in ('every-construct/index.html', 'index.html'):
            with open(os.path.join(self.out, 'blog', page), encoding='utf-8') as f:
                m = pattern.fullmatch(f.read())
            self.assertTrue(m, page)
            self.assertNotIn('<', m[1])
            self.assertTrue(m[3].startswith('<main id="page">') and m[3].endswith('</main>'))

    def test_well_formed_and_unique_ids(self):
        for d, _, files in os.walk(os.path.join(self.out, 'blog')):
            for f in files:
                if f.endswith('.html'):
                    with open(os.path.join(d, f), encoding='utf-8') as fh:
                        t = Tree(fh.read())
                    self.assertEqual(t.errors, [], f)
                    self.assertEqual(len(t.ids), len(set(t.ids)), f)
                    scripts = [n.attrs.get('type') or '' for n in t.root.all('script')]
                    self.assertEqual(sorted(scripts), ['', 'application/ld+json', 'module'], f)

    def test_heading_ids(self):
        body = self.tree.one('div', 'post-body')
        ids = [(h.tag, h.attrs['id']) for h in body.all() if h.tag in ('h2', 'h3')]
        self.assertEqual(ids, [('h2', 'lists'), ('h3', 'a-third-level-heading-with-code-in-it'), ('h2', 'code'), ('h2', 'lists-2')])
        doc = s.Doc('t.md', 1, taken={'next', 'page'})
        html, doc = s.render_markdown('## Next\n\n## Lists 2\n\n## Lists\n\n## Lists\n\n## Lists 2\n\n## It\'s a *B*: `C`!', doc=doc)
        self.assertEqual([x['id'] for x in doc.sections], ['next-2', 'lists-2', 'lists', 'lists-3', 'lists-2-2', 'its-a-b-c'])
        self.assertEqual(doc.sections[-1], {'id': 'its-a-b-c', 'title': "It's a B: C!", 'level': 2})

    def test_heading_ids_avoid_the_pages_ids(self):
        post = ('---\ntitle: "Ids"\ndescription: "Headings named like parts of the page."\npublished: 2026-03-01\n---\n\n'
                '## Reader\n\n## Step in\n\n## Stepin\n\n## Page\n\n## Reader\n')
        out = self.fresh_out()
        generate(self.posts_dir(ids=post), out)
        with open(os.path.join(out, 'blog', 'index.json'), encoding='utf-8') as f:
            sections = next(p['sections'] for p in json.load(f)['posts'] if p['slug'] == 'ids')
        self.assertEqual([x['id'] for x in sections], ['reader-2', 'step-in', 'stepin-2', 'page-2', 'reader-3'])
        with open(os.path.join(out, 'blog', 'ids', 'index.html'), encoding='utf-8') as f:
            t = Tree(f.read())
        self.assertEqual(len(t.ids), len(set(t.ids)))
        self.assertFalse(set(t.ids) & set(s.RUNTIME_IDS))
        made = set()
        for js in [os.path.join(d, f) for d, _, fs in os.walk(os.path.join(s.ROOT, 'src')) for f in fs if f.endswith('.js')]:
            with open(js, encoding='utf-8') as f:
                js_text = f.read()
                made |= set(re.findall(r"(?:createElement|cloneNode)\([^)]*\), \{ id: '([^']+)'", js_text)) | set(re.findall(r'`<\w+ id="([a-z-]+)"', js_text))
        self.assertEqual(made, set(s.RUNTIME_IDS))

    def test_nested_lists(self):
        body = self.tree.one('div', 'post-body')
        ul, ol = body.kids('ul')[0], body.kids('ol')[0]
        self.assertEqual([li.children[0] for li in ul.kids('li')], ['A bullet.', 'A bullet with ', 'A last bullet.'])
        self.assertEqual([li.text() for li in ul.kids('li')[1].kids('ul')[0].kids('li')], ['A nested bullet.', 'Another nested bullet.'])
        self.assertEqual([li.text() for li in ol.kids('li')[1].kids('ol')[0].kids('li')], ['A nested step.'])
        self.assertEqual(len(ol.kids('li')), 3)
        html = s.render_markdown('- a\n    1. b\n    2. c\n- d')[0]
        self.assertEqual(html, '<ul>\n<li>a<ol>\n<li>b</li>\n<li>c</li>\n</ol></li>\n<li>d</li>\n</ul>')

    def test_code_byte_for_byte(self):
        with open(os.path.join(FIXTURE, 'every-construct.md'), encoding='utf-8') as f:
            src = f.read()
        fences = [(m[1], m[2]) for m in re.finditer(r'(?ms)^```(\w+)\n(.*?)\n```$', src)]
        got = [(pre.attrs['data-lang'], pre.one('code').text()) for pre in self.tree.all('pre')]
        self.assertEqual(got, fences)
        self.assertEqual(len(got), 3)
        self.assertIn('   # trailing spaces and tabs\tstay', got[0][1])

    def test_images(self):
        imgs = list(self.tree.one('div', 'post-body').all('img'))
        self.assertEqual(len(imgs), 2)
        for img in imgs:
            w, h, _ = s.image_info(os.path.join(self.out, img.attrs['src'].lstrip('/')))
            self.assertEqual((img.attrs['width'], img.attrs['height']), (str(w), str(h)))
            self.assertLessEqual(max(w, h), 1600)
            self.assertTrue(img.attrs['src'].endswith('.webp'))
        self.assertEqual((imgs[0].attrs['width'], imgs[0].attrs['height']), ('1200', '1600'))
        rack = os.path.join(self.out, 'blog', 'media', imgs[0].attrs['src'].rsplit('/', 1)[1])
        with open(rack, 'rb') as f:
            self.assertNotIn(b'EXIF', f.read())
        def pixels(*cmd):
            ppm = os.path.join(self.tmp, 'thumb.ppm')
            s.run(f'{s.WEBP}/dwebp', '-quiet', '-ppm', *cmd, '-o', ppm)
            return ppm
        def read(ppm):
            with open(ppm, 'rb') as f:
                return f.read()[-30 * 40 * 3:]
        def via(w, h, turn):
            webp = os.path.join(self.tmp, 'thumb.webp')
            s.run(f'{s.WEBP}/cwebp', '-quiet', '-lossless', '-resize', w, h, os.path.join(s.DATA, 'assets', 'images', RACK), '-o', webp)
            ppm = pixels(webp)
            if turn:
                s.orient_ppm(ppm, 6)
            return read(ppm)
        out = read(pixels('-scale', 30, 40, rack))
        diff = lambda a, b: sum(abs(x - y) for x, y in zip(a, b)) / len(a)
        self.assertLess(diff(out, via(40, 30, True)) * 3, diff(out, via(30, 40, False)))
        with open(os.path.join(s.DATA, 'assets', 'images', CARD), 'rb') as a, open(os.path.join(self.out, 'blog', 'media', CARD), 'rb') as b:
            self.assertEqual(a.read(), b.read())

    def test_orient(self):
        ppm = os.path.join(self.tmp, 'o.ppm')
        for o, want in {1: (3, 2, [1, 2, 3, 4, 5, 6]), 6: (2, 3, [4, 1, 5, 2, 6, 3]), 8: (2, 3, [3, 6, 2, 5, 1, 4]),
                        3: (3, 2, [6, 5, 4, 3, 2, 1]), 2: (3, 2, [3, 2, 1, 6, 5, 4]), 4: (3, 2, [4, 5, 6, 1, 2, 3]),
                        5: (2, 3, [1, 4, 2, 5, 3, 6]), 7: (2, 3, [6, 3, 5, 2, 4, 1])}.items():
            with open(ppm, 'wb') as f:
                f.write(b'P6\n3 2\n255\n' + bytes(v for i in range(1, 7) for v in (i, i, i)))
            s.orient_ppm(ppm, o)
            with open(ppm, 'rb') as f:
                d = f.read()
            head = f'P6\n{want[0]} {want[1]}\n255\n'.encode()
            self.assertEqual(d, head + bytes(v for i in want[2] for v in (i, i, i)), o)

    def test_escaping(self):
        self.assertEqual(s.escape('< > & " \''), '&lt; &gt; &amp; &quot; &#x27;')
        self.assertEqual(s.render_inline('< > & " \' <script>x</script> `<&>`'),
                         '&lt; &gt; &amp; &quot; &#x27; &lt;script&gt;x&lt;/script&gt; <code>&lt;&amp;&gt;</code>')
        self.assertEqual(s.render_inline('[a](https://x.org/?q="1"&r=\'<b>\')'),
                         '<a href="https://x.org/?q=&quot;1&quot;&amp;r=&#x27;&lt;b&gt;&#x27;" target="_blank" rel="noopener">a</a>')
        self.assertEqual(s.render_markdown('```text\n</code></pre><b>"&\'\n```')[0],
                         '<pre data-lang="text"><code>&lt;/code&gt;&lt;/pre&gt;&lt;b&gt;&quot;&amp;&#x27;</code></pre>')
        fig = s.render_markdown(f'![a "b" <c> & \'d\'](../assets/images/{CARD} "x \\"<y>\\" & \'z\'")')[0]
        self.assertIn('alt="a &quot;b&quot; &lt;c&gt; &amp; &#x27;d&#x27;"', fig)
        self.assertIn('<figcaption>x &quot;&lt;y&gt;&quot; &amp; &#x27;z&#x27;</figcaption>', fig)
        ld = s.json_ld({'description': '</script><!-- <b> & "q" \'s\''})
        inner = ld[len('<script type="application/ld+json">'):-len('</script>')]
        self.assertNotIn('<', inner)
        self.assertEqual(json.loads(inner)['description'], '</script><!-- <b> & "q" \'s\'')

    def test_link_policy(self):
        d = s.Doc('t.md', 1)
        r = lambda md: s.render_inline(md, d, 1)
        for bad in ('javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example',
                    '/\\evil.example', 'relative/path', '#frag', 'ftp://x'):
            self.assertEqual(r(f'[bad]({bad})'), 'bad', bad)
        self.assertEqual(len(d.warnings), 9)
        self.assertEqual(r('[x](https://e.org/a)'), '<a href="https://e.org/a" target="_blank" rel="noopener">x</a>')
        self.assertEqual(r('[x](http://e.org/)'), '<a href="http://e.org/" target="_blank" rel="noopener">x</a>')
        self.assertEqual(r('[x](mailto:a@b.c)'), '<a href="mailto:a@b.c">x</a>')
        self.assertEqual(r('[x](/blog/every-construct/)'), '<a href="/blog/every-construct/">x</a>')
        self.assertEqual(r('[x](/portfolio/homelab/)'), '<a href="/portfolio/homelab/">x</a>')
        self.assertEqual(r('[x](/portfolio/)'), '<a href="/portfolio/">x</a>')
        self.assertEqual(r('[x](../assets/files/8b46b93f83223a11d762796f2775bb697b0a94ce.yaml)'),
                         '<a href="/blog/files/gui-lxd-profile.yaml">x</a>')
        self.assertIn('<a href="/blog/files/gui-lxd-profile.yaml">file link</a>', self.html)
        self.assertIn('a link that must be refused: bad.</p>', self.html)
        with open(os.path.join(s.DATA, 'assets', 'files', '8b46b93f83223a11d762796f2775bb697b0a94ce.yaml'), 'rb') as a, \
             open(os.path.join(self.out, 'blog', 'files', 'gui-lxd-profile.yaml'), 'rb') as b:
            self.assertEqual(a.read(), b.read())
        self.assertNotIn('javascript:', self.html.lower())

    def test_errors_name_post_and_line(self):
        for md, line, words in [('para\n\n# One', 3, 'only h1'), ('#### Four', 1, '## and ###'), ('```js\nx\n```', 1, 'unknown code language'),
                                ('```bash\nx', 1, 'not closed'), ('- a\n        - b', 2, 'one nested level'), ('a\n\n---', 3, 'rules'),
                                ('| a |', 1, 'tables'), ('    x = 1', 1, 'indented code'), ('* a', 1, 'list items'),
                                ('a ![b](../assets/images/x.png)', 1, 'alone'), ('![b](../assets/images/missing.png)', 1, 'not in data'),
                                ('x\n[a](../assets/files/missing.pdf)', 2, 'not in data'), ('[a](/x "t")', 1, 'title')]:
            with self.assertRaises(s.ContentError, msg=md) as e:
                s.render_markdown(md, 'p.md', 20)
            self.assertIn(f'p.md, line {line + 19}:', str(e.exception))
            self.assertIn(words, str(e.exception))

    def test_human_date(self):
        self.assertEqual([s.human_date(d) for d in ('2026-03-30', '2026-02-01', '2025-12-09')],
                         ['30 March 2026', '1 February 2026', '9 December 2025'])

    def test_index_json_and_list(self):
        with open(os.path.join(self.out, 'blog', 'index.json'), encoding='utf-8') as f:
            idx = json.load(f)
        self.assertRegex(idx['v'], r'^[0-9a-f]{8}$')
        p, = idx['posts']
        self.assertEqual(list(p), ['slug', 'url', 'title', 'description', 'published', 'revised', 'date', 'minutes', 'words', 'tags', 'sections'])
        self.assertEqual((p['url'], p['date'], p['revised'], p['minutes'], p['tags']),
                         ('/blog/every-construct/', '15 January 2026', '2026-02-01', 1, ['fixtures', 'markdown']))
        self.assertEqual(p['sections'][1], {'id': 'a-third-level-heading-with-code-in-it', 'title': 'A third-level heading with code in it', 'level': 3})
        with open(os.path.join(self.out, 'blog', 'index.html'), encoding='utf-8') as f:
            html = f.read()
        self.assertIn('<title>Writing — Adithya Rajendran</title>', html)
        self.assertIn('<meta name="description" content="Engineering notes on GPU memory', html)
        self.assertIn('"@type": "Blog"', html)
        self.assertIn('<section class="post-list">\n  <h1>Writing</h1>\n  <p class="post-lede">Engineering notes', html)
        self.assertIn('    <li><a href="/blog/every-construct/">Every construct: a post that uses all of the Markdown the site accepts</a> '
                      '<p>A fixture for the renderer&#x27;s tests.', html)
        self.assertIn('\n        <p class="post-meta"><time datetime="2026-01-15">15 January 2026</time> · 1 min read</p></li>\n  </ol>', html)

    def test_no_posts(self):
        empty, out = tempfile.mkdtemp(dir=self.tmp), tempfile.mkdtemp(dir=self.tmp)
        generate(empty, out)
        self.assertEqual(sorted(set(os.listdir(os.path.join(out, 'blog'))) - {'files'}), ['index.html', 'index.json'])
        with open(os.path.join(out, 'blog', 'index.json'), encoding='utf-8') as f:
            self.assertEqual(json.load(f)['posts'], [])

    def test_second_run_writes_nothing(self):
        n = len(re.findall(r'^wrote (?!feed|sitemap|llms|_redirects|resume/)', self.log, re.M))
        self.assertIn(f'{n} written, 0 unchanged, 0 removed', self.log)
        self.assertGreater(n, 7)
        out = self.fresh_out()
        before = snapshot(out)
        log = generate(FIXTURE, out)
        self.assertEqual(log.strip().splitlines(), [f'0 written, {n} unchanged, 0 removed'])
        self.assertEqual(snapshot(out), before)

    def test_removed_post_is_removed(self):
        other = ('---\ntitle: "Other"\ndescription: "Another post."\npublished: 2026-02-10\n---\n'
                 '![A photo.](../assets/images/b70060c0abca9a0239f186395795e2e8fb2538cb-3000x4000.jpg)\n\n'
                 'A [CV](../assets/files/e70b01e95fdcf9f4e5d8ad06a0e32b28f62060c2.pdf).\n')
        posts, out = self.posts_dir(other=other), self.fresh_out()
        generate(posts, out)
        made = snapshot(out)
        mine = [p for p in made if p not in snapshot(self.out)]
        self.assertEqual(len(mine), 3, mine)
        self.assertIn(os.path.join('blog', 'other', 'index.html'), mine)
        with open(os.path.join(out, 'blog', 'index.json'), encoding='utf-8') as f:
            self.assertEqual([p['slug'] for p in json.load(f)['posts']], ['other', 'every-construct'])
        os.remove(os.path.join(posts, 'other.md'))
        log = generate(posts, out)
        for p in mine:
            self.assertIn('removed ' + p.replace(os.sep, '/'), log)
            self.assertFalse(os.path.exists(os.path.join(out, p)), p)
        self.assertFalse(os.path.exists(os.path.join(out, 'blog', 'other')))
        self.assertEqual(set(snapshot(out)), set(snapshot(self.out)))

    def test_writes_only_inside_out(self):
        base = tempfile.mkdtemp(dir=self.tmp)
        out = os.path.join(base, 'x', 'out')
        bad = ('---\ntitle: "Bad"\ndescription: "Escapes."\npublished: 2026-03-01\n'
               'image: ../../../public/exhibit-review.png\n---\n\nText.\n')
        with self.assertRaises(SystemExit) as e:
            generate(self.posts_dir(bad=bad), out)
        self.assertIn('nothing was written', str(e.exception.code))
        self.assertEqual([d for d, _, files in os.walk(base) if files], [])
        os.makedirs(out)
        os.symlink(base, os.path.join(out, 'up'))
        for rel in ('../x.txt', 'blog/../../x.txt', 'blog/media/../../../x.txt', '/tmp/x.txt', 'up/x.txt', '.', ''):
            with self.assertRaises(s.ContentError, msg=rel):
                s.out_path(out, rel)
        self.assertEqual(s.out_path(out, 'blog/media/a.png'), os.path.join(os.path.realpath(out), 'blog', 'media', 'a.png'))
        with self.assertRaises(s.ContentError):
            s.write_outputs(out, {'blog/index.json': b'{}', 'blog/../../escaped': b'x'})
        self.assertEqual(os.listdir(out), ['up'])

    def test_bad_post_writes_nothing(self):
        bad = '---\ntitle: "Bad"\ndescription: "Broken."\npublished: 2026-03-01\n---\n\nFine.\n\n#### Too deep\n'
        posts = self.posts_dir(bad=bad)
        for out in (tempfile.mkdtemp(dir=self.tmp), self.fresh_out()):
            before = snapshot(out)
            with self.assertRaises(SystemExit) as e:
                generate(posts, out)
            self.assertIn('bad.md, line 9: headings are ## and ###', str(e.exception.code))
            self.assertIn('nothing was written', str(e.exception.code))
            self.assertEqual(snapshot(out), before)


class InlineParser(unittest.TestCase):

    def fast(self, text, want, limit=1.0):
        t = time.perf_counter()
        got = s.render_inline(text, s.Doc('t.md', 1), 1)
        took = time.perf_counter() - t
        self.assertLess(took, limit, f'{text[:30]!r}... took {took:.2f} s')
        if got != want:
            at = next((i for i, (a, b) in enumerate(zip(got, want)) if a != b), min(len(got), len(want)))
            self.fail(f'{text[:30]!r}...: differs at {at}: {got[at - 20:at + 40]!r} instead of {want[at - 20:at + 40]!r}')

    def test_unclosed_stars_are_text(self):
        globs = 'Copy ' + ', '.join(f'*.{e}{i}' for i, e in enumerate(['yaml', 'yml', 'json', 'toml', 'md'] * 100)) + ' files.'
        for text in ('*a ' * 5000, globs, '*' + 'a *' * 5000, '*' * 5000, '* a' * 5000):
            self.fast(text, s.escape(text))

    def test_long_runs(self):
        ticks = ''.join('`' * k + 'a' for k in range(1, 100))
        for text in ('`' * 5000, ticks, '[' * 5000, ']' * 5000, '[]' * 2500, '[' * 2500 + ']' * 2500, '[a](' * 2000,
                     '[a](b ' * 2000, '((' * 2500 + '[a](' + '(' * 5000):
            self.fast(text, s.escape(text))
        self.fast('\\\\' * 2500 + '\\', '\\' * 2501)
        self.fast('\\[' * 2000 + '](x' * 2000, '[' * 2000 + '](x' * 2000)
        self.fast('\\*' * 2500, '*' * 2500)
        self.fast('` ' * 2500, '<code> </code> ' * 1250)
        self.fast('[a](/b)' * 2000, '<a href="/b">a</a>' * 2000)

    def test_emphasis_at_scale(self):
        self.fast('**a *b* c** ' * 2000, '<strong>a <em>b</em> c</strong> ' * 2000)
        self.fast('a*' * 5000, 'a<em>a</em>' * 2500)
        text, want = 'x', 'x'
        for k in range(1000):
            d, tag = ('**', 'strong') if k % 2 else ('*', 'em')
            text, want = f'{d}a {text} b{d}', f'<{tag}>a {want} b</{tag}>'
        self.fast(text, want)

    def test_same_as_the_recursive_parser(self):
        def render(make, text):
            doc = s.Doc('t.md', 1)
            try:
                nodes = make(text, doc)
            except s.ContentError as e:
                return str(e)
            return s.to_html(nodes), sorted(set(doc.warnings))
        rnd = random.Random(20261122)
        for alphabet in ('*_`[]()\\ab ', '*_`[]()\\ab !/"\n'):
            for _ in range(2500):
                text = ''.join(rnd.choice(alphabet) for _ in range(rnd.randint(0, 14)))
                self.assertEqual(render(lambda t, d: s.Inline(t, d, 1).parse(), text),
                                 render(lambda t, d: OldInline(t, d, 1).parse()[0], text), repr(text))


ESCAPABLE = s.ESCAPABLE
class OldInline:
    def __init__(self, text, doc, line=None, links=True):
        self.s, self.doc, self.line, self.links = text, doc, line, links

    def at(self, i):
        return self.line + self.s.count('\n', 0, i) if self.line else None

    def parse(self, i=0, closer=None, end=None):
        s, end = self.s, len(self.s) if end is None else end
        nodes, buf = [], []
        def flush():
            if buf:
                nodes.append(('text', ''.join(buf)))
                buf.clear()
        while i < end:
            c = s[i]
            if c == '\\' and i + 1 < end and s[i + 1] in ESCAPABLE:
                buf.append(s[i + 1]); i += 2
            elif c == '`':
                k = self._run(i, '`', end)
                j = i + k
                while True:
                    j = s.find('`', j, end)
                    if j < 0 or self._run(j, '`', end) == k:
                        break
                    j += self._run(j, '`', end)
                if j < 0:
                    buf.append('`' * k); i += k
                    continue
                code = s[i + k:j].replace('\n', ' ')
                if len(code) > 2 and code[0] == ' ' == code[-1] and code.strip():
                    code = code[1:-1]
                flush(); nodes.append(('code', code)); i = j + k
            elif c == '*':
                k = self._run(i, '*', end)
                prev, nxt = s[i - 1] if i else ' ', s[i + k] if i + k < end else ' '
                can_close, can_open = not prev.isspace(), not nxt.isspace()
                if closer and can_close and (closer == '*' and not (k >= 2 and can_open) or closer == '**' and k >= 2):
                    flush()
                    return nodes, i + len(closer), True
                if can_open:
                    d = '**' if k >= 2 else '*'
                    inner, j, closed = self.parse(i + len(d), d, end)
                    if not closed and closer == '*' and can_close:
                        flush()
                        return nodes, i + 1, True
                    if closed and inner:
                        flush(); nodes.append(('strong' if d == '**' else 'em', inner)); i = j
                        continue
                buf.append(s[i:i + k]); i += k
            elif c == '!' and s.startswith('![', i):
                self.doc.error(self.at(i), 'an image must be alone in its paragraph: ![alt](../assets/images/<file> "caption")')
            elif c == '[' and self.links and (link := self._link(i, end)):
                flush(); nodes.append(link[0]); i = link[1]
            else:
                buf.append(c); i += 1
        flush()
        return nodes, i, closer is None

    def _run(self, i, ch, end):
        j = i
        while j < end and self.s[j] == ch:
            j += 1
        return j - i

    def _link(self, i, end):
        s, depth, j = self.s, 0, i
        while j < end:
            c = s[j]
            if c == '\\':
                j += 2; continue
            if c == '`':
                k = self._run(j, '`', end)
                close = s.find('`' * k, j + k, end)
                j = close + k if close >= 0 else j + k
                continue
            depth += (c == '[') - (c == ']')
            if depth == 0:
                break
            j += 1
        if j >= end or not s.startswith('](', j):
            return None
        k, depth = j + 2, 0
        while k < end and not s[k].isspace():
            depth += (s[k] == '(') - (s[k] == ')')
            if depth < 0:
                break
            k += 1
        url = s[j + 2:k]
        if k < end and s[k].isspace():
            rest = s[k:end].lstrip()
            if rest.startswith(('"', "'", '(')):
                self.doc.error(self.at(i), 'links with a title are not supported: [text](url)')
            return None
        if k >= end or not url:
            return None
        label = OldInline(s[:j], self.doc, self.line, links=False).parse(i + 1, None, j)[0]
        target = self.doc.link(url, self.at(i))
        return ('link', target, label), k + 1


EXPECTED_MAIN = '''<main id="page">
<article class="post" data-slug="every-construct">
  <header>
    <p class="post-meta"><time datetime="2026-01-15">15 January 2026</time> · <span class="post-minutes">1 min read</span> · <span class="post-revised">Revised <time datetime="2026-02-01">1 February 2026</time></span></p>
    <h1>Every construct: a post that uses all of the Markdown the site accepts</h1>
    <p class="post-lede">A fixture for the renderer&#x27;s tests. It has a colon: here, &quot;quotes&quot;, an &lt;angle&gt; and an &amp; ampersand, which must all arrive intact.</p>
    <ul class="post-tags"><li>fixtures</li><li>markdown</li></ul>
  </header>
  <section class="post-takeaways"><h2>Takeaways</h2><ul><li>The first takeaway, with <code>code</code> in it.</li><li>The second: it has a colon and a <a href="https://example.org/a?b=1&amp;c=2" target="_blank" rel="noopener">link</a>.</li></ul></section>
  <div class="post-body">
<p>An opening paragraph with <code>inline code</code>, <strong>strong text</strong>, <em>emphasis</em>, an <a href="https://example.org/path?x=1&amp;y=2#frag" target="_blank" rel="noopener">external link</a> and an <a href="/blog/every-construct/">internal link</a>. Characters that HTML cares about, &lt; &gt; &amp; &quot; &#x27;, must be escaped; a literal * and _ and ` stay as typed.</p>
<p>A second paragraph
that is wrapped over two lines in the source and is still one paragraph.</p>
<h2 id="lists">Lists</h2>
<ul>
<li>A bullet.</li>
<li>A bullet with <code>code</code> and a <a href="/portfolio/homelab/">link</a>.<ul>
<li>A nested bullet.</li>
<li>Another nested bullet.</li>
</ul></li>
<li>A last bullet.</li>
</ul>
<ol>
<li>First step.</li>
<li>Second step.<ol>
<li>A nested step.</li>
</ol></li>
<li>Third step.</li>
</ol>
<h3 id="a-third-level-heading-with-code-in-it">A third-level heading with <code>code</code> in it</h3>
<blockquote><p>A quotation, with <em>emphasis</em>.</p></blockquote>
<h2 id="code">Code</h2>
<pre data-lang="bash"><code># a comment with &lt;angle brackets&gt; &amp; an ampersand
sudo sysctl -w vm.min_free_kbytes=1048576   # trailing spaces and tabs\tstay
echo &quot;a line with **stars** and _underscores_ that are not Markdown&quot;</code></pre>
<pre data-lang="text"><code>NVRM: GPU0 nvCheckOkFailedNoLog: Check failed: Out of memory [NV_ERR_NO_MEMORY]

a blank line above is part of the block</code></pre>
<pre data-lang="yaml"><code>devices:
  x11:
    type: proxy</code></pre>
<h2 id="lists-2">Lists</h2>
<p>A second heading with the same text as an earlier one: its id must differ.</p>
<figure><img src="RACK" width="1200" height="1600" alt="A server rack with three small computers." loading="lazy" decoding="async"><figcaption>Inside the rack. The caption has &quot;quotes&quot; and a <a href="https://example.org" target="_blank" rel="noopener">link</a>.</figcaption></figure>
<figure><img src="CARDWEBP" width="1200" height="630" alt="An image with no caption." loading="lazy" decoding="async"></figure>
<p>A <a href="/blog/files/gui-lxd-profile.yaml">file link</a> to something kept in data/assets/files, and a link that must be refused: bad.</p>
  </div>
  <footer>
    <section class="post-changelog"><h2>Changes</h2><ul><li><time datetime="2026-02-01">1 February 2026</time> <b>Correction</b> Corrected a figure in the second section.</li><li><time datetime="2026-01-20">20 January 2026</time> <b>Update</b> Added the section on lists.</li></ul></section>
    <p class="post-next"><a href="/blog/every-construct/"><span>Next</span> Every construct: a post that uses all of the Markdown the site accepts</a> It is the only fixture, so it points at itself.</p>
  </footer>
</article>
</main>'''

if __name__ == '__main__':
    unittest.main()
