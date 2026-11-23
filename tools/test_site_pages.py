"""Tests for the pages tools/site.py writes from the projects and the profile (docs/v1-contracts.md §8), on the fixtures in
tools/testdata/site/ (every field, every awkward character, and a profile with only what is required), and a
faithfulness check of the real data/ that reads the generated HTML with html.parser, not with the generator's code.
    python3 -m unittest tools/test_site_pages.py          (from the repository root; -v lists each test)
Needs cwebp under ~/.local/opt/webp like site.py itself; the images are encoded once and copied between runs.

The fixture profile points at real things in data/ (content.py checks a profile's references there): the post
my-homelab (tools/testdata/site/posts/ has a stand-in of that name), the projects homelab and robot-scene-memory (the
fixture projects have those names), and real images and files."""
import contextlib, hashlib, importlib.util, io, json, os, re, shutil, tempfile, unittest
from html.parser import HTMLParser

TOOLS = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sitegen', os.path.join(TOOLS, 'site.py'))   # `import site` is Python's
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
FIX = os.path.join(TOOLS, 'testdata', 'site')
POSTS, PROJECTS, PROFILE = os.path.join(FIX, 'posts'), os.path.join(FIX, 'projects'), os.path.join(FIX, 'profile.json')
MINIMAL = os.path.join(FIX, 'profile-minimal.json')
PAGES = ('about/index.html', 'portfolio/index.html', 'experience/index.html', 'contact/index.html')
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def text(self):
        return ''.join(c if isinstance(c, str) else c.text() for c in self.children)

    def cls(self):
        return self.attrs.get('class', '').split()

    def all(self, tag=None, cls=None):
        for c in self.children:
            if isinstance(c, Node):
                if (tag is None or c.tag == tag) and (cls is None or cls in c.cls()):
                    yield c
                yield from c.all(tag, cls)

    def one(self, tag=None, cls=None):
        found = list(self.all(tag, cls))
        assert len(found) == 1, f'{len(found)} <{tag} class={cls}>'
        return found[0]

    def kids(self, tag=None):
        return [c for c in self.children if isinstance(c, Node) and (tag is None or c.tag == tag)]


class Tree(HTMLParser):
    """A DOM from html.parser that records every unbalanced tag and every id."""
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


def generate(out, posts=POSTS, projects=PROJECTS, profile=PROFILE):
    """Run site.py's main(); return what it printed."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
        s.main(['--posts', posts, '--projects', projects, '--profile', profile, '--out', out])
    return buf.getvalue()


def snapshot(folder):
    return {os.path.relpath(os.path.join(d, f), folder): os.stat(os.path.join(d, f)).st_mtime_ns
            for d, _, fs in os.walk(folder) for f in fs}


def read(out, rel):
    with open(os.path.join(out, rel), encoding='utf-8') as f:
        return f.read()


def squash(t):
    return ' '.join(t.split())


URL = r'\((?:[^()\s]|\([^()\s]*\))*\)'                  # a link's (destination), parentheses in it balanced


def md_text(t):
    """Inline Markdown as a reader sees it, worked out here without the generator: [text](url) is its text, and the
    marks and escapes go."""
    t = re.sub(r'\[((?:[^\]\\]|\\.)*)\]' + URL, r'\1', t)
    return squash(re.sub(r'\\(.)', r'\1', t.replace('**', '').replace('`', '').replace('*', '')))


def words(t):
    return re.findall(r'[A-Za-z0-9]+', t)


def body_words(md):
    """The words of a Markdown body a reader reads: link targets, image lines, fence lines and markup aside. Code is
    shown as it is."""
    md = re.sub(r'^!\[.*$', ' ', md, flags=re.M)
    md = re.sub(r'^```.*$', ' ', md, flags=re.M)         # a fence line: its language is not shown
    md = re.sub(r'\]' + URL, ']', md)
    return words(md)


class Pages(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix='test-pages-')
        cls.out = os.path.join(cls.tmp, 'out')
        cls.log = generate(cls.out)
        cls.min_projects = os.path.join(cls.tmp, 'one-project')
        os.makedirs(cls.min_projects)
        shutil.copy(os.path.join(PROJECTS, 'robot-scene-memory.md'), cls.min_projects)
        cls.min_posts = os.path.join(cls.tmp, 'no-posts')
        os.makedirs(cls.min_posts)
        cls.minimal = os.path.join(cls.tmp, 'minimal')
        generate(cls.minimal, cls.min_posts, cls.min_projects, MINIMAL)
        cls.real = os.path.join(cls.tmp, 'real')               # the real data, for the faithfulness check
        generate(cls.real, os.path.join(s.DATA, 'posts'), os.path.join(s.DATA, 'projects'), os.path.join(s.DATA, 'profile.json'))
        cls.profile = s.load_profile(PROFILE)
        cls.projects = {p['slug']: p for p in s.load_projects(PROJECTS)}
        with open(s.SHELL, encoding='utf-8') as f:
            cls.shell = f.read()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def tree(self, rel, out=None):
        return Tree(read(out or self.out, rel)).root

    def main(self, rel, out=None):
        return self.tree(rel, out).one('main')

    def fresh(self):
        out = tempfile.mkdtemp(dir=self.tmp)
        shutil.copytree(self.out, out, dirs_exist_ok=True)
        return out

    def all_pages(self, out=None):
        out = out or self.out
        return [os.path.relpath(os.path.join(d, f), out) for d, _, fs in os.walk(out) for f in fs
                if f == 'index.html' and not os.path.relpath(d, out).startswith('blog')]

    def ld(self, rel, out=None):
        return json.loads(next(n for n in self.tree(rel, out).all('script') if n.attrs.get('type') == 'application/ld+json').text())

    # ------------------------------------------------------------ every page

    def test_the_pages(self):
        self.assertEqual(sorted(self.all_pages()), sorted(list(PAGES) + [f'portfolio/{p}/index.html' for p in self.projects]))

    def test_shell_unchanged_outside_the_three_replacements(self):
        a, b = self.shell.index('<title>') + 7, self.shell.index('</title>')
        pieces = [self.shell[:a], self.shell[b:self.shell.index('<!--site:head-->')],
                  self.shell[self.shell.index('<!--site:head-->') + 16:self.shell.index('<!--site:page-->')],
                  self.shell[self.shell.index('<!--site:page-->') + 16:]]
        pattern = re.compile('(?s)' + '(.*?)'.join(re.escape(p) for p in pieces))
        for out in (self.out, self.minimal, self.real):
            for rel in self.all_pages(out):
                m = pattern.fullmatch(read(out, rel))
                self.assertTrue(m, rel)
                self.assertNotIn('<', m[1], rel)           # the title is text
                self.assertTrue(m[3].startswith('<main id="page">\n') and m[3].endswith('\n</main>'), rel)

    def test_well_formed_unique_ids_and_no_scripts(self):
        shell_ids = set(Tree(self.shell).ids)
        for out in (self.out, self.minimal, self.real):
            for rel in self.all_pages(out):
                t = Tree(read(out, rel))
                self.assertEqual(t.errors, [], rel)
                self.assertEqual(len(t.ids), len(set(t.ids)), rel)
                main_ids = [n.attrs['id'] for n in t.root.one('main').all() if 'id' in n.attrs]
                self.assertFalse(set(main_ids) & (shell_ids | set(s.RUNTIME_IDS)), rel)
                scripts = sorted(n.attrs.get('type') or '' for n in t.root.all('script'))
                self.assertEqual(scripts, ['', 'application/ld+json', 'importmap', 'module'], rel)   # the shell's three, and JSON-LD
                self.assertFalse(list(t.root.one('main').all('script')), rel)
                for tag in ('form', 'input', 'textarea', 'button', 'iframe', 'style'):
                    self.assertFalse(list(t.root.one('main').all(tag)), (rel, tag))

    def test_head(self):
        name = self.profile['name']
        want = {'about/index.html': ('About', 'profile', 'ProfilePage', self.profile['seo_description'], '/about/'),
                'portfolio/index.html': ('Projects', 'website', 'CollectionPage', self.profile['projects_intro'], '/portfolio/'),
                'experience/index.html': ('Experience', 'website', 'WebPage', self.profile['work_summary'], '/experience/'),
                'contact/index.html': ('Contact', 'website', 'ContactPage', self.profile['contact_invitation'], '/contact/')}
        want.update({f'portfolio/{p["slug"]}/index.html': (p['title'], 'website', 'CreativeWork', p['summary'], f'/portfolio/{p["slug"]}/')
                     for p in self.projects.values()})
        for rel, (what, og, kind, desc, path) in want.items():
            t = self.tree(rel)
            head = t.one('head')
            metas = {m.attrs.get('property') or m.attrs.get('name'): m.attrs['content'] for m in head.all('meta') if 'content' in m.attrs}
            self.assertEqual(head.one('title').text(), f'{what} — {name}', rel)
            self.assertEqual((metas['description'], metas['og:description'], metas['og:type']), (desc, desc, og), rel)
            self.assertEqual(metas['og:url'], s.SITE + path)
            self.assertEqual([l.attrs['href'] for l in head.all('link') if l.attrs.get('rel') == 'canonical'], [s.SITE + path])
            self.assertEqual(metas['og:site_name'], name)
            ld = self.ld(rel)
            self.assertEqual((ld['@context'], ld['@type'], ld['url']), ('https://schema.org', kind, s.SITE + path), rel)
            raw = read(self.out, rel)
            inner = raw[raw.index('<script type="application/ld+json">') + 35:]
            self.assertNotIn('<', inner[:inner.index('</script>')], rel)   # no text can close the element
        ld = self.ld('portfolio/index.html')
        self.assertEqual([i['url'] for i in ld['mainEntity']['itemListElement']],
                         [f'{s.SITE}/portfolio/{p["slug"]}/' for p in sum(s.listing(self.projects.values()), [])])
        ld = self.ld('portfolio/homelab/index.html')
        self.assertEqual((ld['name'], ld['alternateName'], ld['creator']['name']), (self.projects['homelab']['title'], self.projects['homelab']['name'], name))
        self.assertEqual(ld['sameAs'], ['https://example.org/repo?x=1&y="2"'])
        self.assertTrue(ld['image'].startswith(f'{s.SITE}/media/') and ld['image'].endswith('.webp'))
        about = self.ld('about/index.html')['mainEntity']
        self.assertEqual((about['@type'], about['name'], about['description']), ('Person', name, self.profile['seo_description']))
        self.assertEqual(about['homeLocation']['address'], {'@type': 'PostalAddress', 'addressLocality': 'Santa Cruz', 'addressRegion': 'California'})
        self.assertEqual(about['jobTitle'], 'Engineer <lead> (promoted & more)')
        self.assertEqual([c['name'] for c in about['hasCredential']], [c['title'] for c in self.profile['credentials']])
        self.assertEqual(about['sameAs'], [l['url'] for l in self.profile['social_links']])
        self.assertEqual(self.ld('contact/index.html')['about']['sameAs'], [l['url'] for l in self.profile['social_links']])
        metas = {m.attrs.get('property') or m.attrs.get('name'): m.attrs['content'] for m in self.tree('portfolio/homelab/index.html').all('meta') if 'content' in m.attrs}
        self.assertEqual((metas['og:title'], metas['og:image:alt'], metas['twitter:card']),
                         (self.projects['homelab']['title'], self.projects['homelab']['cover_alt'], 'summary_large_image'))
        w, h, _ = s.image_info(os.path.join(self.out, metas['og:image'][len(s.SITE) + 1:]))
        self.assertEqual((metas['og:image:width'], metas['og:image:height']), (str(w), str(h)))
        metas = {m.attrs.get('property') or m.attrs.get('name'): m.attrs['content'] for m in self.tree('portfolio/quiet-featured/index.html').all('meta') if 'content' in m.attrs}
        self.assertEqual(metas['og:image:alt'], 'Quiet, though featured')   # a decorative cover: the title says what it shows
        self.assertNotIn('og:image', {m.attrs.get('property') for m in self.tree('portfolio/robot-scene-memory/index.html').all('meta')})

    def test_escaping(self):
        """Every awkward string arrives intact as text, as an attribute and in JSON-LD, and no markup is made from it."""
        p, prof = self.projects['homelab'], self.profile
        t = self.tree('portfolio/homelab/index.html')
        self.assertEqual(t.one('h1').text(), p['title'])
        self.assertEqual(t.one('p', 'post-lede').text(), p['summary'])
        self.assertEqual(t.one('img', 'post-cover-image').attrs['alt'], p['cover_alt'])
        self.assertEqual(t.one('figcaption').text() if len(list(t.all('figcaption'))) == 1 else
                         t.one('figure', 'post-cover').one('figcaption').text(), p['cover_caption'])
        self.assertEqual([li.text() for li in t.one('ul', 'post-tags').kids('li')], p['technologies'])
        self.assertEqual(self.ld('portfolio/homelab/index.html')['name'], p['title'])
        self.assertFalse(list(t.one('main').all('b', None)) and [b for b in t.one('main').all('b') if b.text() == 'not bold'])
        raw = read(self.out, 'portfolio/homelab/index.html')
        main = raw[raw.index('<main id="page">'):raw.index('</main>')]
        self.assertNotIn('</script>', main)
        self.assertNotIn('<!--', main)
        self.assertNotIn('javascript:', main.lower())
        t = self.tree('about/index.html')
        self.assertEqual(t.one('h1').text(), prof['name'])
        self.assertEqual(t.one('p', 'post-lede').text(), prof['tagline'])     # long, and whole
        self.assertEqual(t.one('head').one('title').text(), f'About — {prof["name"]}')
        self.assertEqual(self.ld('about/index.html')['description'], prof['seo_description'])
        for rel in PAGES:
            raw = read(self.out, rel)
            main = raw[raw.index('<main id="page">'):raw.index('</main>')]
            self.assertNotIn('</script>', main, rel)
            self.assertNotIn('<b>not bold', main, rel)
            self.assertNotIn('<script>', main, rel)

    # ------------------------------------------------------------ a project

    def test_project_every_part(self):
        p = self.projects['homelab']
        main = self.main('portfolio/homelab/index.html')
        art = main.one('article')
        self.assertEqual((art.cls(), art.attrs['data-slug']), (['post', 'project'], 'homelab'))
        self.assertEqual([c.tag + '.' + '.'.join(c.cls()) for c in art.kids()],
                         ['header.', 'figure.post-cover', 'div.post-body', 'footer.'])
        head = art.one('header')
        self.assertEqual([c.tag + '.' + '.'.join(c.cls()) for c in head.kids()],
                         ['p.post-meta', 'h1.', 'p.post-lede', 'p.post-role', 'p.post-status-note', 'ul.post-tags'])
        self.assertEqual(squash(head.one('p', 'post-meta').text()), 'Complete · c. Dec 2022 – Mar 2023 · Infrastructure, Hardware')
        self.assertEqual(head.one('span', 'post-status').text(), 'Complete')
        self.assertEqual(head.one('p', 'post-role').text(), 'Role ' + p['role'])
        self.assertEqual(head.one('p', 'post-status-note').text(), p['status_note'])
        fig = art.one('figure', 'post-cover')
        img = fig.one('img')
        w, h, _ = s.image_info(os.path.join(self.out, img.attrs['src'].lstrip('/')))
        self.assertEqual((img.attrs['width'], img.attrs['height']), (str(w), str(h)))
        self.assertRegex(img.attrs['src'], r'^/media/12840419b409b9b20e54683e668a4d2a76e26f67-1536x864\.[0-9a-f]{8}\.webp$')
        body = art.one('div', 'post-body')
        self.assertEqual([h.attrs['id'] for h in body.all('h2')],
                         ['problem', 'approach', 'outcome', 'problem-2', 'links-2', 'page-2', 'highlights', 'results',
                          'parameters', 'lessons', 'next-steps', 'links', 'related-writing'])
        h2 = {h.attrs['id']: h for h in body.kids('h2')}
        after = lambda hid: body.kids()[body.kids().index(h2[hid]) + 1]
        self.assertEqual(after('problem').text(), p['problem'])
        self.assertEqual(after('outcome').text(), p['outcome'])
        res = after('results')
        self.assertEqual(('dl', res.cls()), (res.tag, ['post-facts']))
        self.assertEqual([(c.tag, c.text()) for c in res.kids()],
                         [('dt', 'Rebuild time <cold>'), ('dd', '42 min & change'), ('dd', 'Measured "once", by hand.'), ('dt', 'Nodes'), ('dd', '7')])
        self.assertEqual(res.kids()[2].cls(), ['post-note'])
        self.assertEqual([(c.tag, c.text()) for c in after('parameters').kids()],
                         [('dt', 'Racks <U>'), ('dd', '1 & a half'), ('dt', 'Power'), ('dd', '195.1 W')])
        links = after('links')
        self.assertEqual(links.cls(), ['post-links'])
        self.assertEqual([(li.attrs.get('data-kind'), li.one('a').attrs['href'], li.text()) for li in links.kids('li')], [
            ('repo', 'https://example.org/repo?x=1&y="2"', 'Repository <code> & "more"'), ('article', '/blog/my-homelab/', 'The write-up'),
            ('other', '/portfolio/robot-scene-memory/', 'A related project'), ('dataset', '/blog/files/gui-lxd-profile.yaml', 'A file, as uploaded')])
        self.assertEqual((links.kids('li')[0].one('a').attrs['target'], links.kids('li')[0].one('a').attrs['rel']), ('_blank', 'noopener'))
        self.assertEqual([a.attrs['href'] for a in after('related-writing').all('a')], ['/blog/my-homelab/'])
        hl = after('highlights')
        self.assertEqual([md_text(li.text()) for li in hl.kids('li')], [md_text(x) for x in p['highlights']])
        self.assertEqual([a.attrs['href'] for a in hl.all('a')],
                         ['https://example.org/?a=1&b=2', '/blog/my-homelab/', '/portfolio/robot-scene-memory/', '/blog/files/gui-lxd-profile.yaml'])
        self.assertEqual([n.tag for n in hl.kids('li')[0].kids()], ['strong', 'code', 'a'])
        nxt = art.one('footer').one('p', 'post-next')
        order = sum(s.listing(self.projects.values()), [])
        i = [q['slug'] for q in order].index('homelab')
        self.assertEqual(nxt.one('a').attrs['href'], f'/portfolio/{order[i + 1]["slug"]}/')
        self.assertEqual(nxt.one('a').text(), 'Next ' + order[i + 1]['title'])
        self.assertEqual(read(os.path.join(s.DATA, 'assets', 'files'), '8b46b93f83223a11d762796f2775bb697b0a94ce.yaml'),
                         read(self.out, 'blog/files/gui-lxd-profile.yaml'))

    def test_project_with_only_what_is_required(self):
        art = self.main('portfolio/robot-scene-memory/index.html').one('article')
        self.assertEqual([c.tag for c in art.kids()], ['header', 'footer'])  # no cover, no body
        self.assertEqual([c.tag + '.' + '.'.join(c.cls()) for c in art.one('header').kids()], ['p.post-meta', 'h1.', 'p.post-lede'])
        self.assertEqual(squash(art.one('p', 'post-meta').text()), 'Active · Hardware')   # no dates: no period
        art = self.main('portfolio/robot-scene-memory/index.html', self.minimal).one('article')
        self.assertEqual([c.tag for c in art.kids()], ['header'])   # the only project: no next
        art = self.main('portfolio/quiet-featured/index.html').one('article')
        self.assertEqual(art.one('img').attrs['alt'], '')           # no cover_alt: decorative
        self.assertFalse(list(art.all('figcaption')))
        self.assertEqual([h.attrs['id'] for h in art.all('h2')], ['problem', 'approach'])   # no outcome
        self.assertEqual(squash(art.one('p', 'post-meta').text()), 'Active · 2024 – now · Infrastructure, Software')
        self.assertEqual(squash(self.main('portfolio/featured-two/index.html').one('p', 'post-meta').text()), 'Complete · 2026 · Research, Software')

    def test_periods(self):
        P = lambda **k: s.project_period(dict({'started': None, 'ended': None, 'date_precision': None, 'status': 'completed', 'dates_approximate': None}, **k))
        self.assertEqual(P(started='2022-12-01', ended='2026-10-03', date_precision='month'), 'Dec 2022 – Oct 2026')
        self.assertEqual(P(started='2026-01-01', ended='2026-01-01', date_precision='year'), '2026')
        self.assertEqual(P(started='2022-01-01', date_precision='year', status='active'), '2022 – now')
        self.assertEqual(P(started='2024-01-01', ended='2025-12-31', date_precision='year', dates_approximate=True), 'c. 2024 – 2025')
        self.assertEqual(P(started='2024-03-01', date_precision='month'), 'Mar 2024')       # completed, no end: the start
        self.assertIsNone(P(status='active'))

    # ------------------------------------------------------------ /portfolio/

    def test_portfolio_list(self):
        sec = self.main('portfolio/index.html').one('section', 'post-list')
        self.assertEqual([c.tag for c in sec.kids()], ['h1', 'p', 'h2', 'ol', 'h2', 'ol'])
        self.assertEqual((sec.one('h1').text(), sec.one('p', 'post-lede').text()), ('Projects', self.profile['projects_intro']))
        self.assertEqual([(h.attrs['id'], h.text()) for h in sec.kids('h2')], [('selected', 'Selected projects'), ('more', 'Experiments & systems')])
        groups = [[li.kids('a')[0].attrs['href'].split('/')[2] for li in ol.kids('li')] for ol in sec.kids('ol')]
        # featured by rank, then by order; the quiet one (featured 3) is never selected
        self.assertEqual(groups, [['homelab', 'featured-two', 'robot-scene-memory'], ['quiet-featured', 'unranked']])
        lis = {li.kids('a')[0].attrs['href'].split('/')[2]: li for ol in sec.kids('ol') for li in ol.kids('li')}
        self.assertEqual([k for k, li in lis.items() if 'quiet' in li.cls()], ['quiet-featured'])
        for slug, li in lis.items():
            p = self.projects[slug]
            self.assertEqual([c.tag for c in li.kids()], ['a', 'p', 'p'])
            self.assertEqual((li.kids('a')[0].text(), li.kids('p')[0].text()), (p['title'], p['summary']))
            per = s.project_period(p)
            self.assertEqual(squash(li.one('p', 'post-meta').text()),
                             ' · '.join([s.STATUS[p['status']]] + ([per] if per else []) + [', '.join(s.TYPES[t] for t in p['types'])]))
        one = self.main('portfolio/index.html', self.minimal).one('section', 'post-list')
        self.assertEqual([c.tag for c in one.kids()], ['h1', 'p', 'h2', 'ol'])

    def test_listing_when_all_are_quiet(self):
        mk = lambda slug, order, **k: dict({'slug': slug, 'order': order, 'featured': None, 'quiet': True}, **k)
        sel, more = s.listing([mk('a', 1), mk('b', 2, featured=1), mk('c', 3)])
        self.assertEqual(([p['slug'] for p in sel], [p['slug'] for p in more]), (['b', 'a', 'c'], []))
        self.assertEqual(s.listing([]), ([], []))

    # ------------------------------------------------------------ /about/

    def test_about(self):
        prof = self.profile
        art = self.main('about/index.html').one('article')
        self.assertEqual((art.cls(), art.attrs['data-slug']), (['post', 'page'], 'about'))
        head = art.one('header')
        self.assertEqual([c.tag + '.' + '.'.join(c.cls()) for c in head.kids()], ['p.post-meta', 'h1.', 'p.post-lede'])
        self.assertEqual(head.one('p', 'post-meta').text(), f'{prof["headline"]} · {prof["location"]}')
        body = art.one('div', 'post-body')
        self.assertEqual([h.attrs['id'] for h in body.all('h2')], ['story', 'focus', 'curiosities', 'availability', 'featured-writing', 'elsewhere'])
        paras = [p.text() for p in body.kids('p')]
        self.assertEqual(paras[0], prof['introduction'])
        for para in prof['bio'].split('\n\n'):
            self.assertIn(para, paras)
        self.assertEqual([li.text() for li in body.kids('ul')[0].kids('li')], prof['focus_areas'])
        cur = body.one('ul', 'post-curiosities').kids('li')
        self.assertEqual([li.one('strong').text() for li in cur], [c['title'] for c in prof['current_curiosities']])
        self.assertEqual(cur[0].one('a').attrs['href'], '/portfolio/homelab/')
        self.assertEqual(cur[0].one('a').text(), self.projects['homelab']['name'])
        self.assertEqual([len(list(li.all('p'))) for li in cur], [2, 0, 1])
        self.assertEqual(body.kids('p')[[p.cls() for p in body.kids('p')].index(['post-meta'])].one('time').attrs['datetime'], '2026-10-26')
        av = body.one('p', 'post-availability')
        self.assertEqual((av.attrs['data-status'], av.one('b').text(), av.one('time').attrs['datetime']), ('selective', 'Selective', '2026-09-29'))
        cta = body.one('p', 'post-cta').one('a')
        self.assertEqual((cta.attrs['href'], cta.text()), ('/contact/#hiring', prof['availability']['cta']))
        feat = body.one('p', 'post-featured').one('a')
        self.assertEqual((feat.attrs['href'], feat.text()), ('/blog/my-homelab/', s.load_posts(POSTS)[0]['title']))
        links = body.kids('ul')[-1]
        self.assertEqual(links.cls(), ['post-links'])
        self.assertEqual([(a.attrs['href'], a.text()) for a in links.all('a')],
                         [(l['url'], l['label']) for l in prof['social_links']] + [('/resume/Adithya-Rajendran-Research-CV.pdf', 'Résumé (PDF)')])

    def test_about_with_only_what_is_required(self):
        body = self.main('about/index.html', self.minimal).one('div', 'post-body')
        self.assertEqual([h.attrs['id'] for h in body.all('h2')], ['story', 'availability', 'elsewhere'])
        self.assertEqual(body.one('p', 'post-availability').text(), 'Closed')   # no date, nothing sought
        self.assertEqual(body.one('p', 'post-cta').one('a').attrs['href'], '/contact/')   # no hiring route
        contact = self.main('contact/index.html', self.minimal)
        self.assertEqual(list(contact.all('p', 'post-cta')), [])                 # on the contact page that link would lead to itself
        self.assertEqual([a.attrs['href'] for a in body.one('ul', 'post-links').all('a')], ['https://github.com/example'])   # no résumé
        self.assertFalse(os.path.exists(os.path.join(self.minimal, 'resume')))

    # ------------------------------------------------------------ /experience/

    def test_experience(self):
        prof = self.profile
        art = self.main('experience/index.html').one('article')
        self.assertEqual((art.cls(), art.attrs['data-slug']), (['post', 'page'], 'experience'))
        self.assertEqual(art.one('p', 'post-lede').text(), prof['work_summary'])
        body = art.one('div', 'post-body')
        entries = body.kids('section')
        self.assertEqual([(e.cls(), e.attrs['id'], e.attrs['data-kind']) for e in entries], [(['entry'], t['id'], t['kind']) for t in prof['timeline']])
        self.assertEqual([[c.tag for c in e.kids()] for e in entries], [['img', 'h2', 'p', 'p', 'ul'], ['img', 'h2', 'p'], ['h2', 'p']])
        self.assertEqual([e.one('h2').text() for e in entries], [t['title'] for t in prof['timeline']])
        self.assertEqual([e.one('p', 'post-meta').text() for e in entries], [
            'Org <&> "Co" · Aug 2026 – now (expected 2028) · Remote & <home> · Full-time',
            'Acme · May 2024 – Jul 2025',                  # "Internship" goes unsaid beside "Intern"
            'A University · 2019 – 2023'])
        self.assertEqual([e.one('img').attrs['alt'] for e in entries[:2]], ['A logo <alt>', ''])
        self.assertEqual([li.text() for li in entries[0].one('ul').kids('li')], prof['timeline'][0]['highlights'])
        # the timeline id "skills" is the entry's: the section heading of that name takes the next
        self.assertEqual([(h.tag, h.attrs['id']) for h in body.kids() if h.tag in ('h2', 'h3')],
                         [('h2', 'skills-2'), ('h3', 'programming-languages'), ('h3', 'skills-3'), ('h2', 'credentials'),
                          ('h2', 'talks-and-papers'), ('h2', 'resume')])
        self.assertEqual([[li.text() for li in ul.kids('li')] for ul in body.kids('ul') if 'post-tags' in ul.cls()],
                         [g['skills'] for g in prof['skill_groups']])
        creds = body.one('ul', 'post-credentials').kids('li')
        self.assertEqual([squash(li.text()) for li in creds], [
            'Cert <one> & "full" Issuer & Co · Sep 2023 – Sep 2026', 'Lifetime cert Lifelong · May 2018', 'AWS Certified Minimal Jan 2020'])
        self.assertEqual([[i.attrs['alt'] for i in li.all('img')] for li in creds], [['A badge <alt> & "text"'], [''], []])
        self.assertEqual([[a.attrs['href'] for a in li.all('a')] for li in creds], [['https://example.org/verify?id=1&x="y"'], [], []])
        talks = body.one('ul', 'post-talks').kids('li')
        self.assertEqual([li.one('strong').text() for li in talks], [t['title'] for t in prof['talks_and_papers']])
        self.assertEqual(talks[0].one('p', 'post-meta').text(), 'Report · Oct 2026 · A venue <somewhere> · Ada & Bob')
        self.assertEqual(talks[1].one('p', 'post-meta').text(), 'Talk · Mar 2024')
        self.assertEqual([(a.attrs['href'], a.text()) for a in talks[0].one('ul', 'post-links').all('a')], [
            ('/blog/files/Driving-Detection-Course-Report.pdf', 'Read <it> (PDF)'), ('https://example.org/source', 'Source'),
            ('/blog/my-homelab/', 'The post'), ('/portfolio/robot-scene-memory/', 'The project'),
            ('/portfolio/homelab/', 'Project: ' + self.projects['homelab']['name'])])
        self.assertEqual([a.attrs['href'] for a in body.kids('ul')[-1].all('a')], ['/resume/Adithya-Rajendran-Research-CV.pdf'])
        body = self.main('experience/index.html', self.minimal).one('div', 'post-body')
        self.assertEqual([h.attrs['id'] for h in body.all() if h.tag in ('h2', 'h3') and 'id' in h.attrs], ['skills', 'tools'])
        self.assertEqual(body.one('section', 'entry').one('p', 'post-meta').text(), 'School · Sep 2020')

    # ------------------------------------------------------------ /contact/

    def test_contact(self):
        prof = self.profile
        art = self.main('contact/index.html').one('article')
        self.assertEqual((art.cls(), art.attrs['data-slug']), (['post', 'page'], 'contact'))
        self.assertEqual((art.one('h1').text(), art.one('p', 'post-lede').text()), ('Contact', prof['contact_intro']))
        body = art.one('div', 'post-body')
        self.assertEqual(body.kids('p')[0].text(), prof['contact_invitation'])
        routes = body.kids('section')
        self.assertEqual([(r.cls(), r.attrs['id'], r.one('h3').text(), r.one('p').text()) for r in routes],
                         [(['route'], k, v['title'], v['prompt']) for k, v in prof['contact_routes'].items()])
        self.assertEqual([h.attrs['id'] for h in body.kids('h2')], ['what-to-write-about', 'elsewhere', 'availability-2'])
        self.assertEqual([a.attrs['href'] for a in body.one('ul', 'post-links').all('a')],
                         [l['url'] for l in prof['social_links']] + ['/resume/Adithya-Rajendran-Research-CV.pdf'])
        self.assertNotIn('mailto:', read(self.out, 'contact/index.html'))
        body = self.main('contact/index.html', self.minimal).one('div', 'post-body')
        self.assertEqual([r.attrs['id'] for r in body.kids('section')], ['hello'])

    # ------------------------------------------------------------ links

    def test_every_link_is_allowed_and_leads_somewhere(self):
        for out in (self.out, self.minimal, self.real):
            pages = {}
            for rel in self.all_pages(out) + ['blog/index.html']:
                for a in self.main(rel, out).all():
                    for attr in ('href', 'src'):
                        if attr not in a.attrs:
                            continue
                        u = a.attrs[attr]
                        if u.startswith(('http://', 'https://')):
                            if attr == 'href':
                                self.assertEqual((a.attrs.get('target'), a.attrs.get('rel')), ('_blank', 'noopener'), u)
                            continue
                        self.assertTrue(u.startswith('/') and not u.startswith('//'), (rel, u))
                        path, _, frag = u.partition('#')
                        self.assertNotIn('?', path, (rel, u))   # §8 pages link the projects' pages, not ?room=
                        target = os.path.join(out, path.lstrip('/'), 'index.html' if path.endswith('/') else '')
                        self.assertTrue(os.path.isfile(target.rstrip('/')), (rel, u))
                        if frag:
                            pages.setdefault(target, Tree(read(out, os.path.relpath(target, out))).ids)
                            self.assertIn(frag, pages[target], (rel, u))

    def test_link_policy_on_these_pages(self):
        d = s.Doc('t', 1, projects={'homelab'}, media='/media')
        self.assertEqual(s.render_inline('[x](/portfolio/homelab/) [y](/portfolio/) [z](/portfolio/nope/)', d),
                         '<a href="/portfolio/homelab/">x</a> <a href="/portfolio/">y</a> <a href="/portfolio/nope/">z</a>')
        self.assertEqual(len(d.warnings), 1)
        self.assertIn('no project nope', d.warnings[0])
        post = s.Doc('t', 1)                               # and in a post
        self.assertEqual(s.render_inline('[x](/portfolio/homelab/)', post), '<a href="/portfolio/homelab/">x</a>')

    # ------------------------------------------------------------ the JSON

    def check_shape(self, value, shape, where):
        """shape: a type, a tuple of types, [shape] for a list of them, or {key: shape} for a record with exactly these
        keys in this order."""
        if isinstance(shape, dict):
            self.assertIsInstance(value, dict, where)
            self.assertEqual(list(value), list(shape), where)
            for k, sh in shape.items():
                self.check_shape(value[k], sh, f'{where}.{k}')
        elif isinstance(shape, list):
            self.assertIsInstance(value, list, where)
            for i, v in enumerate(value):
                self.check_shape(v, shape[0], f'{where}[{i}]')
        else:
            self.assertIsInstance(value, shape, where)
            if shape is int or shape == (int, type(None)):
                self.assertNotIsInstance(value, bool, where)

    def version(self, doc):
        rest = dict(doc); del rest['v']
        value = rest['projects'] if list(rest) == ['projects'] else rest
        return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:8]

    PROJECT = {'slug': str, 'url': str, 'name': str, 'title': str, 'summary': str, 'status': str, 'status_label': str,
               'period': (str, type(None)), 'year': (str, type(None)), 'types': [str], 'role': (str, type(None)),
               'technologies': [str], 'featured': (int, type(None)), 'quiet': bool}
    OPT = (str, type(None))
    PROFILE = {'v': str, 'name': str, 'headline': str, 'tagline': str, 'location': str, 'introduction': str, 'focus': [str],
               'availability': {'status': str, 'label': str, 'seeking': [str]},
               'curiosities': [{'kind': OPT, 'title': str, 'note': OPT, 'url': OPT}],
               'timeline': [{'id': str, 'url': str, 'kind': str, 'title': str, 'organization': str, 'org_short': str, 'period': str,
                             'year': str, 'current': bool, 'location': OPT, 'employment': OPT, 'summary': OPT}],
               'links': [{'label': str, 'url': str}],
               'contact': {'intro': str, 'invitation': str, 'email': type(None), 'routes': [{'id': str, 'title': str, 'prompt': str}]},
               'resume': OPT}

    def test_portfolio_json(self):
        for out, folder in ((self.out, PROJECTS), (self.minimal, self.min_projects), (self.real, None)):
            doc = json.loads(read(out, 'portfolio/index.json'))
            self.check_shape(doc, {'v': str, 'projects': [self.PROJECT]}, 'portfolio/index.json')
            self.assertRegex(doc['v'], r'^[0-9a-f]{8}$')
            self.assertEqual(doc['v'], self.version(doc))
            src = s.load_projects(folder)
            self.assertEqual([p['slug'] for p in doc['projects']], [p['slug'] for p in src])   # the projects' own order
            for j, p in zip(doc['projects'], src):
                self.assertEqual((j['url'], j['name'], j['title'], j['summary'], j['status'], j['types'], j['role'], j['technologies'], j['featured'], j['quiet']),
                                 (f'/portfolio/{p["slug"]}/', p['name'], p['title'], p['summary'], p['status'], p['types'], p['role'], p['technologies'], p['featured'], bool(p['quiet'])))
                self.assertEqual(j['year'], p['started'][:4] if p['started'] else None)
                self.assertIn(j['status_label'], ('Active', 'Complete'))
                self.assertTrue(os.path.isfile(os.path.join(out, j['url'].lstrip('/'), 'index.html')))
        j = {p['slug']: p for p in json.loads(read(self.out, 'portfolio/index.json'))['projects']}
        self.assertEqual((j['homelab']['period'], j['robot-scene-memory']['period'], j['quiet-featured']['period']),
                         ('c. Dec 2022 – Mar 2023', None, '2024 – now'))
        real = {p['slug']: p for p in json.loads(read(self.real, 'portfolio/index.json'))['projects']}
        self.assertEqual((real['gmail-spam-filter']['period'], real['driving-detection-evaluation']['period'], real['homelab']['period']),
                         ('Dec 2022 – Oct 2026', '2026', '2022 – now'))           # the contract's examples

    def test_profile_json(self):
        for out, path in ((self.out, PROFILE), (self.minimal, MINIMAL), (self.real, None)):
            doc = json.loads(read(out, 'profile.json'))
            self.check_shape(doc, self.PROFILE, 'profile.json')
            self.assertEqual(doc['v'], self.version(doc))
            prof = s.load_profile(path)
            self.assertEqual([doc[k] for k in ('name', 'headline', 'tagline', 'location', 'introduction', 'focus')],
                             [prof[k] for k in ('name', 'headline', 'tagline', 'location', 'introduction', 'focus_areas')])
            a = prof['availability']
            self.assertEqual(doc['availability'], {'status': a['status'], 'label': a['cta'], 'seeking': a['seeking']})
            self.assertEqual([(c['title'], c['note'], c['url']) for c in doc['curiosities']],
                             [(c['title'], c['note'], c['project'] and f'/portfolio/{c["project"]}/') for c in prof['current_curiosities']])
            self.assertEqual([t['id'] for t in doc['timeline']], [t['id'] for t in prof['timeline']])
            for t, e in zip(doc['timeline'], prof['timeline']):
                self.assertEqual((t['url'], t['title'], t['organization'], t['org_short'], t['kind'], t['year'], t['current'], t['location'], t['employment'], t['summary']),
                                 (f'/experience/#{e["id"]}', e['title'], e['organization'], e['org_short'], e['kind'], e['start_date'][:4],
                                  bool(e['is_current']), e['location'], e['employment'], e['summary']))
            self.assertEqual(doc['links'], [{'label': l['label'], 'url': l['url']} for l in prof['social_links']])
            self.assertEqual(doc['contact'], {'intro': prof['contact_intro'], 'invitation': prof['contact_invitation'], 'email': None,
                                              'routes': [{'id': k, **v} for k, v in prof['contact_routes'].items()]})
            if doc['resume']:
                self.assertTrue(os.path.isfile(os.path.join(out, doc['resume'].lstrip('/'))))
        doc = json.loads(read(self.out, 'profile.json'))
        self.assertEqual([c['kind'] for c in doc['curiosities']], ['question', 'question', None])
        self.assertEqual([t['period'] for t in doc['timeline']], ['Aug 2026 – now', 'May 2024 – Jul 2025', '2019 – 2023'])
        self.assertEqual(doc['resume'], '/resume/Adithya-Rajendran-Research-CV.pdf')
        self.assertIsNone(json.loads(read(self.minimal, 'profile.json'))['resume'])
        real = json.loads(read(self.real, 'profile.json'))
        self.assertEqual({t['id']: t['period'] for t in real['timeline']}['canonical-2024'], 'May 2024 – Jul 2026')   # the contract's example

    # ------------------------------------------------------------ faithfulness, read from the HTML alone

    def test_faithful_to_the_data(self):
        """Every project's and the profile's words appear in the text of their pages: the real data and the fixtures."""
        for out, posts, projects, profile in ((self.real, None, None, None), (self.out, POSTS, PROJECTS, PROFILE)):
            for p in s.load_projects(projects):
                t = self.main(f'portfolio/{p["slug"]}/index.html', out)
                text = squash(t.text())
                for k in ('title', 'summary', 'problem', 'approach', 'outcome', 'role', 'status_note', 'cover_caption'):
                    if p[k]:
                        self.assertIn(squash(p[k]), text, (p['slug'], k))
                for k in ('highlights', 'lessons', 'next_steps'):
                    for x in p[k]:
                        self.assertIn(md_text(x), text, (p['slug'], k))
                for r in p['results']:
                    for x in (r['metric'], r['value'], r['note']):
                        if x:
                            self.assertIn(squash(x), text, (p['slug'], 'results'))
                for r in p['parameters']:
                    self.assertIn(squash(r['label']), text)
                    self.assertIn(squash(r['value']), text)
                for l in p['links']:
                    self.assertIn(squash(l['label']), text, (p['slug'], 'links'))
                for x in p['technologies']:
                    self.assertIn(x, text)
                missing = set(body_words(p['body'])) - set(words(text))
                self.assertEqual(missing, set(), p['slug'])
                if p['cover']:
                    self.assertTrue(list(t.all('figure', 'post-cover')))
            prof = s.load_profile(profile)
            about = squash(self.main('about/index.html', out).text())
            for x in [prof[k] for k in ('name', 'tagline', 'headline', 'location', 'introduction')] + prof['bio'].split('\n\n') \
                    + prof['focus_areas'] + [l['label'] for l in prof['social_links']] + prof['availability']['seeking'] + [prof['availability']['cta']] \
                    + [y for c in prof['current_curiosities'] for y in (c['title'], c['note']) if y]:
                self.assertIn(squash(x), about)
            exp = self.main('experience/index.html', out)
            text = squash(exp.text())
            self.assertIn(prof['work_summary'], text)
            for e in prof['timeline']:
                sec = next(n for n in exp.all('section', 'entry') if n.attrs['id'] == e['id'])
                st = squash(sec.text())
                for x in [e['title'], e['organization']] + e['highlights'] + [e['summary'], e['location']]:
                    if x:
                        self.assertIn(squash(x), st, e['id'])
            for g in prof['skill_groups']:
                self.assertIn(g['title'], text)
                for x in g['skills']:
                    self.assertIn(x, text)
            for c in prof['credentials']:
                self.assertIn(c['title'], text)
            for x in prof['talks_and_papers']:
                for y in [x['title'], x['venue'], x['authors'], x['abstract']] + [l['label'] for l in x['links']]:
                    if y:
                        self.assertIn(squash(y), text)
            contact = squash(self.main('contact/index.html', out).text())
            for x in [prof['contact_intro'], prof['contact_invitation']] + [y for r in prof['contact_routes'].values() for y in r.values()]:
                self.assertIn(squash(x), contact)
            listing = squash(self.main('portfolio/index.html', out).text())
            for p in s.load_projects(projects):
                self.assertIn(squash(p['title']), listing)
                self.assertIn(squash(p['summary']), listing)

    # ------------------------------------------------------------ writing

    def test_second_run_writes_nothing(self):
        out = self.fresh()
        before = snapshot(out)
        log = generate(out)
        self.assertRegex(log, r'^0 written, \d+ unchanged, 0 removed\n$')
        self.assertEqual(snapshot(out), before)

    def test_nothing_outside_out(self):
        base = tempfile.mkdtemp(dir=self.tmp)
        out = os.path.join(base, 'out')
        generate(out)
        self.assertEqual(os.listdir(base), ['out'])
        made = {os.path.relpath(os.path.join(d, f), out).split(os.sep)[0] for d, _, fs in os.walk(out) for f in fs}
        self.assertEqual(made, {'.generated-files', 'about', 'blog', 'contact', 'experience', 'media', 'portfolio', 'profile.json',
                                'resume', 'feed.xml', 'sitemap.xml', 'llms.txt', '_redirects'})

    def test_a_removed_project_is_removed_and_nothing_else(self):
        projects = tempfile.mkdtemp(dir=self.tmp)
        for f in os.listdir(PROJECTS):
            if f != 'quiet-featured.md':
                shutil.copy(os.path.join(PROJECTS, f), projects)
        out = self.fresh()
        cover = [m for m in os.listdir(os.path.join(out, 'media')) if m.startswith('0f0e342e')]
        self.assertEqual(len(cover), 1)
        mine = {'index.html', 'js/hand-written.js', 'media/hand-placed.webp', 'portfolio/notes.txt', 'about/extra.txt'}
        for rel in mine:                                   # files nobody generated, in and beside the generated folders
            os.makedirs(os.path.dirname(os.path.join(out, rel)), exist_ok=True)
            with open(os.path.join(out, rel), 'w') as f:
                f.write('kept')
        with open(os.path.join(out, s.RECORD), 'a') as f:  # a record edited to name things that are not the generator's
            f.write('index.html\njs/hand-written.js\n../outside.txt\n/etc/passwd\n'
                    'blog/../index.html\nmedia/../js/hand-written.js\nportfolio/../index.html\nprofile.jsonx\nabout/./../index.html\n')   # ... or that climb out of its folders
        log = generate(out, projects=projects)
        self.assertEqual(sorted(l for l in log.splitlines() if l.startswith('removed')),
                         ['removed media/' + cover[0], 'removed portfolio/quiet-featured/index.html'])
        self.assertFalse(os.path.exists(os.path.join(out, 'portfolio', 'quiet-featured')))
        for rel in mine:
            self.assertTrue(os.path.isfile(os.path.join(out, rel)), rel)
        self.assertNotIn('index.html', read(out, s.RECORD).splitlines())
        self.assertRegex(generate(out, projects=projects), r'^0 written, \d+ unchanged, 0 removed\n$')

    def test_an_error_anywhere_writes_nothing(self):
        bad_profile = os.path.join(self.tmp, 'bad-profile.json')
        prof = json.loads(read(FIX, 'profile.json'))
        prof['contact_routes']['scene'] = {'title': 'Scene', 'prompt': 'Its id is the shell\'s canvas.'}
        with open(bad_profile, 'w', encoding='utf-8') as f:
            json.dump(prof, f)
        bad_projects = tempfile.mkdtemp(dir=self.tmp)
        for f in os.listdir(PROJECTS):
            shutil.copy(os.path.join(PROJECTS, f), bad_projects)
        with open(os.path.join(bad_projects, 'unranked.md'), 'a', encoding='utf-8') as f:
            f.write('\n#### Too deep\n')
        timeline = json.loads(read(FIX, 'profile.json'))
        timeline['timeline'][0]['id'] = 'loader'
        bad_timeline = os.path.join(self.tmp, 'bad-timeline.json')
        with open(bad_timeline, 'w', encoding='utf-8') as f:
            json.dump(timeline, f)
        broken = os.path.join(self.tmp, 'broken.json')
        with open(broken, 'w') as f:
            f.write('{"name": ')
        for kw, words in [({'profile': bad_profile}, 'contact route id scene is already an id of the page'),
                          ({'projects': bad_projects}, 'unranked.md, line 12: headings are ## and ###'),
                          ({'profile': bad_timeline}, 'timeline id loader is already an id of the page'),
                          ({'profile': broken}, 'not valid JSON')]:
            for out in (tempfile.mkdtemp(dir=self.tmp), self.fresh()):
                before = snapshot(out)
                with self.assertRaises(SystemExit, msg=words) as e:
                    generate(out, **kw)
                self.assertIn(words, str(e.exception.code))
                self.assertIn('nothing was written', str(e.exception.code))
                self.assertEqual(snapshot(out), before)


if __name__ == '__main__':
    unittest.main()
