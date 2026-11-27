# Tests for the static endpoints of tools/site_extras.py
import contextlib, importlib.util, io, json, os, re, shutil, tempfile, unittest
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import unquote

TOOLS = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sitegen', os.path.join(TOOLS, 'site.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
import site_extras as x
FIXTURE = os.path.join(TOOLS, 'testdata', 'posts')
PUBLIC = os.path.join(s.ROOT, 'public')
SITE = s.SITE
NS = {'atom': 'http://www.w3.org/2005/Atom', 'content': 'http://purl.org/rss/1.0/modules/content/',
      'dc': 'http://purl.org/dc/elements/1.1/', 'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
OLD = {'/blog/tags/*', '/resume', '/resume/view', '/resume/download'}
PAGES = {'/about', '/about/', '/contact', '/contact/', '/portfolio', '/portfolio/', '/portfolio/*'}
NASTY_TITLE = 'Tom & Jerry: <b>"bold"</b> [brackets] \\ and \'quotes\''
OTHER = ('---\ntitle: %s\ndescription: %s\npublished: 2026-03-01\ntags: ["a-tag", "b & c"]\n---\n'
         'Body with a [post link](/blog/every-construct/), [a project](/portfolio/homelab/) and <i>no html</i> & more.\n'
         % (json.dumps(NASTY_TITLE), json.dumps('Plain <angle> & "quoted"\nover two lines.')))


class Links(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.urls, self.text = [], []
        self.feed(text); self.close()

    def handle_starttag(self, tag, attrs):
        self.urls += [v for k, v in attrs if k in ('href', 'src')]

    def handle_data(self, data):
        self.text.append(data)


def generate(posts, out):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
        s.main(['--posts', posts, '--out', out])
    return buf.getvalue()


def snapshot(folder):
    return {os.path.relpath(os.path.join(d, f), folder): os.stat(os.path.join(d, f)).st_mtime_ns
            for d, _, fs in os.walk(folder) for f in fs}


def read(out, rel, mode='r'):
    with open(os.path.join(out, rel), mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


class Extras(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='test-extras-')
        cls.one = os.path.join(cls.tmp, 'one')
        cls.log = generate(FIXTURE, cls.one)
        cls.posts2 = os.path.join(cls.tmp, 'posts2')
        os.makedirs(cls.posts2)
        shutil.copy(os.path.join(FIXTURE, 'every-construct.md'), cls.posts2)
        with open(os.path.join(cls.posts2, 'other.md'), 'w', encoding='utf-8') as f:
            f.write(OTHER)
        cls.two = os.path.join(cls.tmp, 'two')
        shutil.copytree(cls.one, cls.two)
        generate(cls.posts2, cls.two)
        cls.profile = s.load_profile()
        cls.projects = s.load_projects()
        cls.all_posts = {p['slug']: p for p in s.load_posts(cls.posts2)}

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def fresh(self, src=None):
        out = tempfile.mkdtemp(dir=self.tmp)
        shutil.copytree(src or self.one, out, dirs_exist_ok=True)
        return out

    def feed(self, out):
        return ET.fromstring(read(out, 'feed.xml', 'rb')).find('channel')

    def test_feed_items_in_order(self):
        ch = self.feed(self.two)
        self.assertEqual([i.findtext('title') for i in ch.findall('item')], [NASTY_TITLE, self.all_posts['every-construct']['title']])
        self.assertEqual([i.findtext('link') for i in ch.findall('item')],
                         [f'{SITE}/blog/other/', f'{SITE}/blog/every-construct/'])

    def test_feed_channel_and_item_fields(self):
        ch = self.feed(self.two)
        self.assertEqual(ch.findtext('title'), 'Adithya Rajendran — Writing')
        self.assertEqual(ch.findtext('description'), self.profile['writing_description'])
        self.assertEqual(ch.findtext('link'), f'{SITE}/blog/')
        me = ch.find('atom:link', NS)
        self.assertEqual((me.get('rel'), me.get('href'), me.get('type')), ('self', f'{SITE}/feed.xml', 'application/rss+xml'))
        other, fixture = ch.findall('item')
        self.assertEqual(ch.findtext('lastBuildDate'), 'Sun, 01 Mar 2026 00:00:00 GMT')
        self.assertEqual(other.findtext('pubDate'), 'Sun, 01 Mar 2026 00:00:00 GMT')
        self.assertEqual(fixture.findtext('pubDate'), 'Thu, 15 Jan 2026 00:00:00 GMT')
        for item in (other, fixture):
            g = item.find('guid')
            self.assertEqual((g.get('isPermaLink'), g.text), ('true', item.findtext('link')))
            self.assertEqual(item.findtext('dc:creator', namespaces=NS), 'Adithya Rajendran')
        self.assertEqual([c.text for c in other.findall('category')], ['a-tag', 'b & c'])
        self.assertEqual([c.text for c in fixture.findall('category')], ['fixtures', 'markdown'])
        self.assertEqual(fixture.findtext('description'), self.all_posts['every-construct']['description'])

    def test_last_build_date_is_the_newest_revision(self):
        ch = self.feed(self.one)
        self.assertEqual(ch.findtext('lastBuildDate'), 'Sun, 01 Feb 2026 00:00:00 GMT')
        self.assertEqual(ch.find('item').findtext('pubDate'), 'Thu, 15 Jan 2026 00:00:00 GMT')

    def test_content_encoded_has_the_article_with_absolute_urls(self):
        for item in self.feed(self.two).findall('item'):
            html = item.findtext('content:encoded', namespaces=NS)
            self.assertTrue(html and '<p>' in html)
            links = Links(html)
            self.assertTrue(links.urls)
            for u in links.urls:
                self.assertRegex(u, r'^(https?://|mailto:)', f'relative URL in content:encoded: {u}')
        fixture = self.feed(self.two).findall('item')[1].findtext('content:encoded', namespaces=NS)
        urls = Links(fixture).urls
        self.assertIn(f'{SITE}/blog/every-construct/', urls)
        self.assertIn(f'{SITE}/portfolio/homelab/', urls)
        self.assertIn('https://example.org/path?x=1&y=2#frag', urls)
        self.assertIn(f'{SITE}/blog/files/gui-lxd-profile.yaml', urls)
        self.assertTrue(any(u.startswith(f'{SITE}/blog/media/') and u.endswith('.webp') for u in urls))
        self.assertIn('<h2 id="lists">Lists</h2>', fixture)
        self.assertIn('Corrected a figure in the second section.', fixture)
        self.assertIn('<b>Correction</b>', fixture)

    def test_special_characters_survive(self):
        item = self.feed(self.two).find('item')
        self.assertEqual(item.findtext('title'), NASTY_TITLE)
        self.assertEqual(item.findtext('description'), 'Plain <angle> & "quoted"\nover two lines.')
        links = Links(item.findtext('content:encoded', namespaces=NS))
        self.assertIn('<i>no html</i> & more.', ''.join(links.text))
        fixture = self.feed(self.one).find('item')
        self.assertEqual(fixture.findtext('description'), self.all_posts['every-construct']['description'])
        self.assertIn('< > & " \'', ''.join(Links(fixture.findtext('content:encoded', namespaces=NS)).text))

    def test_xml_forbids_control_characters(self):
        self.assertEqual(x.esc('a\x00b\x0bc\x1fd￾e'), 'abcde')
        self.assertEqual(x.esc('<&>"\''), '&lt;&amp;&gt;&quot;&#x27;')

    def sitemap(self, out):
        return [(u.findtext('sm:loc', namespaces=NS), u.findtext('sm:lastmod', namespaces=NS))
                for u in ET.fromstring(read(out, 'sitemap.xml', 'rb')).findall('sm:url', NS)]

    def test_sitemap_pages_and_dates_in_order(self):
        listed = [p['slug'] for p in sum(s.listing(self.projects), [])]
        self.assertEqual(sorted(listed), sorted(p['slug'] for p in self.projects))
        self.assertEqual(self.sitemap(self.two), [
            (f'{SITE}/', '2026-03-01'), (f'{SITE}/blog/', '2026-03-01'),
            (f'{SITE}/blog/other/', '2026-03-01'), (f'{SITE}/blog/every-construct/', '2026-02-01'),
            (f'{SITE}/about/', None), (f'{SITE}/portfolio/', None)] + [(f'{SITE}/portfolio/{p}/', None) for p in listed]
            + [(f'{SITE}/experience/', None), (f'{SITE}/contact/', None)])

    def test_sitemap_lists_exactly_the_pages_that_exist(self):
        for out in (self.one, self.two):
            pages = {'/' if os.path.dirname(r) == '' else '/' + os.path.dirname(r) + '/'
                     for r in (os.path.relpath(os.path.join(d, f), out) for d, _, fs in os.walk(out) for f in fs)
                     if os.path.basename(r) == 'index.html'}
            pages.add('/')
            self.assertTrue(os.path.isfile(os.path.join(PUBLIC, 'index.html')))
            locs = [loc for loc, _ in self.sitemap(out)]
            self.assertEqual(sorted(locs), sorted(SITE + p for p in pages))
            self.assertEqual(len(locs), len(set(locs)))

    def test_llms_txt(self):
        text = read(self.two, 'llms.txt')
        lines = text.split('\n')
        self.assertEqual(lines[0], '# Adithya Rajendran')
        self.assertEqual(lines[2], '> ' + self.profile['work_summary'])
        self.assertIn('## Writing', lines)
        links = [l for l in lines if l.startswith('- [') and '/blog/' in l and l != f'- [Writing]({SITE}/blog/): the list of posts']
        self.assertEqual(links, [
            '- [Tom & Jerry: <b>"bold"</b> \\[brackets\\] \\\\ and \'quotes\']' f'({SITE}/blog/other/): Plain <angle> & "quoted" over two lines.',
            f'- [{self.all_posts["every-construct"]["title"]}]({SITE}/blog/every-construct/): {self.all_posts["every-construct"]["description"]}'])
        cv = [n for n in os.listdir(os.path.join(self.two, 'resume'))]
        self.assertIn(f'- [Résumé (PDF)]({SITE}/resume/{cv[0]})', lines)
        a, b = lines.index('## Projects'), lines.index('## Site')
        self.assertEqual(lines[a + 1:a + 3], [self.profile['projects_intro'], ''])
        self.assertEqual(lines[a + 3:b - 1], [f'- [{p["title"]}]({SITE}/portfolio/{p["slug"]}/): {p["summary"]}'
                                              for p in sum(s.listing(self.projects), [])])
        for page in ('about/', 'portfolio/', 'experience/', 'blog/', 'contact/'):
            self.assertEqual(sum(l.startswith('- [') and l.split('](')[1].startswith(f'{SITE}/{page})') for l in lines[b:]), 1, page)
        self.assertIn(f'- [RSS feed]({SITE}/feed.xml): every post in full', lines)
        self.assertEqual(text.count('\n\n\n'), 0)
        self.assertTrue(text.endswith('\n') and not text.endswith('\n\n'))

    def test_robots_txt(self):
        text = read(PUBLIC, 'robots.txt')
        rules = [l for l in text.splitlines() if l and not l.startswith('#')]
        self.assertEqual(rules, ['User-agent: *', 'Allow: /', f'Sitemap: {SITE}/sitemap.xml'])
        self.assertEqual(re.findall(r'https?://\S+', text), [f'{SITE}/llms.txt', f'{SITE}/sitemap.xml'])

    def test_resume_is_the_file_the_profile_points_to(self):
        m = re.fullmatch(r'([0-9a-f]{40})\.pdf', self.profile['resume'])
        name = s.file_names()[f'{m[1]}.pdf']
        self.assertEqual(os.listdir(os.path.join(self.one, 'resume')), [name])
        self.assertEqual(read(self.one, f'resume/{name}', 'rb'), read(os.path.join(s.DATA, 'assets', 'files'), f'{m[1]}.pdf', 'rb'))
        self.assertTrue(read(self.one, f'resume/{name}', 'rb').startswith(b'%PDF'))

    def test_stale_resume_is_removed(self):
        out = self.fresh()
        with open(os.path.join(out, 'resume', 'Old-Name.pdf'), 'wb') as f:
            f.write(b'%PDF old')
        self.assertIn('removed resume/Old-Name.pdf', generate(FIXTURE, out))
        self.assertEqual(len(os.listdir(os.path.join(out, 'resume'))), 1)

    def test_no_resume_in_the_profile(self):
        profile = dict(self.profile)
        del profile['resume']
        files = x.build(s.load_posts(FIXTURE), profile)
        self.assertEqual(sorted(files), ['_redirects', 'feed.xml', 'llms.txt', 'sitemap.xml'])
        self.assertNotIn(b'/resume', files['_redirects'])
        self.assertNotIn('Résumé', files['llms.txt'].decode())

    @staticmethod
    def old(source):
        return source if source.endswith('*') else source.rstrip('/')

    def rules(self, out=None):
        lines = [l for l in read(out or self.one, '_redirects').splitlines() if l.strip() and not l.startswith('#')]
        return [l.split(' ') for l in lines]

    def test_redirects_syntax_and_sources(self):
        rules = self.rules()
        self.assertEqual(len(set(r[0] for r in rules)), len(rules))
        for r in rules:
            self.assertEqual(len(r), 3, r)
            self.assertEqual(r[2], '301')
            self.assertTrue(r[0].startswith('/') and r[1].startswith('/'), r)
            self.assertIn(self.old(r[0]), OLD, r)
        self.assertEqual({self.old(r[0]) for r in rules}, OLD)
        self.assertFalse({r[0] for r in rules} & PAGES)
        contract = read(s.ROOT, 'docs/ref_urls.md')
        for old in OLD:
            self.assertIn(f'`{old}`', contract)

    def test_redirect_targets_exist(self):
        rooms = json.loads(read(PUBLIC, 'content.json'))['rooms']
        for src, target, _ in self.rules():
            path = unquote(target)
            self.assertTrue(os.path.isfile(os.path.join(self.one, path.lstrip('/'), 'index.html') if path.endswith('/')
                                           else os.path.join(self.one, path.lstrip('/'))), target)
        self.assertEqual(dict((a, b) for a, b, _ in self.rules())['/resume/view'], '/resume/' + os.listdir(os.path.join(self.one, 'resume'))[0])

    def test_every_url_is_absolute(self):
        for out in (self.one, self.two):
            root = ET.fromstring(read(out, 'feed.xml', 'rb'))
            urls = [e.text for e in root.iter() if e.tag in ('link', 'guid')] + [e.get('href') for e in root.iter(f'{{{NS["atom"]}}}link')]
            urls += [e.text for e in ET.fromstring(read(out, 'sitemap.xml', 'rb')).iter(f'{{{NS["sm"]}}}loc')]
            urls += re.findall(r'\]\(([^)]*)\)', read(out, 'llms.txt')) + re.findall(r'https?://\S+', read(PUBLIC, 'robots.txt'))
            self.assertGreater(len(urls), 10)
            for u in urls:
                self.assertTrue(u.startswith(SITE + '/'), u)

    def header_rules(self):
        rules, cur = [], None
        for line in read(PUBLIC, '_headers').splitlines():
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            if line[0] not in ' \t':
                cur = (re.compile(''.join('[^/]+' if p.startswith(':') else '.*' if p == '*' else re.escape(p)
                                          for p in re.split(r'(:[a-z]+|\*)', line.strip()) if p) + '$'), line.strip(), {})
                rules.append(cur)
            else:
                k, _, v = line.strip().partition(':')
                cur[2][k.strip()] = v.strip()
        return rules

    def cache(self, path):
        return [r[2]['Cache-Control'] for r in self.header_rules() if r[0].match(path) and 'Cache-Control' in r[2]]

    def test_headers(self):
        media = os.listdir(os.path.join(self.one, 'blog', 'media'))
        webp = [m for m in media if m.endswith('.webp')]
        self.assertTrue(webp and len(webp) < len(media))
        for m in webp:
            self.assertRegex(m, r'^.+\.[0-9a-f]{8}\.webp$')
        for m in media:
            want = ['public, max-age=31536000, immutable'] if m.endswith('.webp') else []
            self.assertEqual(self.cache('/blog/media/' + m), want, m)
        self.assertEqual(self.cache('/blog/files/gui-lxd-profile.yaml'), [])
        for page in ('/blog/', '/blog/every-construct/', '/blog/index.json', '/portfolio/', '/portfolio/homelab/',
                     '/portfolio/index.json', '/about/', '/experience/', '/contact/', '/profile.json'):
            self.assertEqual(self.cache(page), ['no-cache'], page)
        self.assertTrue(os.listdir(os.path.join(self.one, 'media')))
        for m in os.listdir(os.path.join(self.one, 'media')):
            self.assertRegex(m, r'^.+\.[0-9a-f]{8}\.webp$')
            self.assertEqual(self.cache('/media/' + m), ['public, max-age=31536000, immutable'], m)
        for path in ('/about', '/portfolio', '/portfolio/homelab', '/media/', '/media/x.png', '/profile.json.bak'):
            self.assertEqual(self.cache(path), [], path)
        for path in ('/feed.xml', '/sitemap.xml', '/llms.txt', '/robots.txt'):
            self.assertEqual(self.cache(path), ['public, max-age=3600'], path)
        self.assertEqual(self.cache('/resume/Adithya-Rajendran-Research-CV.pdf'), ['no-cache'])
        self.assertEqual(self.cache('/assets/lobby/scene.glb'), ['public, max-age=31536000, immutable'])
        for path in ('/blog/media/x.1234abcd.webp', '/blog/media/'):
            self.assertLessEqual(len(self.cache(path)), 1, path)

    def test_second_run_writes_nothing(self):
        out = self.fresh()
        before = snapshot(out)
        self.assertIn('wrote feed.xml', self.log)
        log = generate(FIXTURE, out)
        self.assertRegex(log, r'^0 written, \d+ unchanged, 0 removed\n$')
        self.assertEqual(snapshot(out), before)

    def test_the_same_bytes_wherever_and_whenever(self):
        posts = s.load_posts(FIXTURE)
        a, b = x.build(posts, self.profile, self.projects), x.build(posts, self.profile, self.projects)
        self.assertEqual(a, b)
        for name in ('feed.xml', 'sitemap.xml', 'llms.txt', '_redirects'):
            self.assertEqual(a[name], read(self.one, name, 'rb'))
        self.assertEqual(set(re.findall(r'\d{4}-\d\d-\d\d', a['sitemap.xml'].decode())), {'2026-02-01'})
        self.assertEqual(set(re.findall(r'\d\d \w{3} \d{4} [\d:]+ GMT', a['feed.xml'].decode())),
                         {'15 Jan 2026 00:00:00 GMT', '01 Feb 2026 00:00:00 GMT'})

    def test_no_posts(self):
        files = x.build([], self.profile)
        ch = ET.fromstring(files['feed.xml']).find('channel')
        self.assertEqual((ch.findall('item'), ch.find('lastBuildDate')), ([], None))
        self.assertEqual([u.findtext('sm:lastmod', namespaces=NS) for u in ET.fromstring(files['sitemap.xml']).findall('sm:url', NS)], [None] * 6)
        self.assertIn(b'## Writing', files['llms.txt'])

    def test_bad_data_writes_nothing(self):
        out = tempfile.mkdtemp(dir=self.tmp)
        profile = dict(self.profile, resume='0' * 40 + '.pdf')
        with self.assertRaises(x.ContentError):
            x.build(s.load_posts(FIXTURE), profile)
        self.assertEqual(os.listdir(out), [])


if __name__ == '__main__':
    unittest.main()
