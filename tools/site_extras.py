#!/usr/bin/env python3
# Static endpoints that tools/site.py writes beside the pages
import email.utils, datetime, importlib.util, json, os, re, sys
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import ContentError, DATA, SITE

REDIRECTS = [
    ('/blog/tags/*', '/blog/'),
    ('/resume', 'RESUME'), ('/resume/', 'RESUME'),
    ('/resume/view', 'RESUME'), ('/resume/view/', 'RESUME'),
    ('/resume/download', 'RESUME'), ('/resume/download/', 'RESUME'),
]

_sitegen = None


def sitegen():
    global _sitegen
    if _sitegen is None:
        spec = importlib.util.spec_from_file_location('sitegen_for_extras', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site.py'))
        _sitegen = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_sitegen)
    return _sitegen


XML_ILLEGAL = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]')


def esc(s):
    s = XML_ILLEGAL.sub('', str(s))
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#x27;')


def rfc822(iso):
    d = datetime.datetime.fromisoformat(iso).replace(tzinfo=datetime.timezone.utc)
    return email.utils.format_datetime(d, usegmt=True)


def modified(post):
    return post['revised'] or post['published']


def newest(posts):
    return max((modified(p) for p in posts), default=None)


def absolute(html):
    return re.sub(r'\b(href|src)="/(?!/)', lambda m: f'{m[1]}="{SITE}/', html)


def post_url(post):
    return f'{SITE}/blog/{post["slug"]}/'


def project_url(project):
    return f'{SITE}/portfolio/{project["slug"]}/'


def ordered(projects):
    return sum(sitegen().listing(list(projects)), []) if projects else []


def resume(profile):
    key = profile.get('resume')
    if not key:
        return None
    if not re.fullmatch(r'[0-9a-f]{40}\.[a-z0-9]+', key):
        raise ContentError(f'profile.json: resume {key!r} is not <sha1>.<ext>')
    name = sitegen().file_names().get(key)
    path = os.path.join(DATA, 'assets', 'files', key)
    if not name or not os.path.isfile(path):
        raise ContentError(f'profile.json: the résumé {key} is not in data/assets/files/ (and files.json)')
    if '/' in name or '\\' in name or name.startswith('.') or not name.lower().endswith('.pdf'):
        raise ContentError(f'profile.json: the résumé {key} has an unusable original name: {name}')
    with open(path, 'rb') as f:
        return name, f.read()


def article_html(post, slugs):
    sg = sitegen()
    body, _ = sg.render_markdown(post['body'], doc=sg.Doc(f'{post["slug"]}.md', 1, (), slugs))
    parts = [body]
    if post['changelog']:
        doc = sg.Doc(f'{post["slug"]}.md, changes', None, (), slugs)
        lis = ''.join(f'<li><time datetime="{c["date"]}">{sg.human_date(c["date"])}</time> <b>{c["kind"].capitalize()}</b> '
                      f'{sg.render_inline(c["note"], doc)}</li>' for c in post['changelog'])
        parts.append(f'<section><h2>Changes</h2><ul>{lis}</ul></section>')
    return absolute('\n'.join(parts))


def feed_xml(posts, profile):
    name, slugs = profile['name'], {p['slug'] for p in posts}
    title = f'{name} — Writing'
    stamp = newest(posts)
    channel = [f'<title>{esc(title)}</title>', f'<link>{SITE}/blog/</link>',
               f'<description>{esc(profile.get("writing_description") or title)}</description>', '<language>en-us</language>']
    if stamp:
        channel.append(f'<lastBuildDate>{rfc822(stamp)}</lastBuildDate>')
    channel.append(f'<atom:link href="{SITE}/feed.xml" rel="self" type="application/rss+xml"/>')
    for p in posts:
        url = post_url(p)
        channel.append('<item>')
        channel += [f'  <title>{esc(p["title"])}</title>', f'  <link>{url}</link>',
                    f'  <guid isPermaLink="true">{url}</guid>', f'  <pubDate>{rfc822(p["published"])}</pubDate>',
                    f'  <dc:creator>{esc(name)}</dc:creator>']
        channel += [f'  <category>{esc(t)}</category>' for t in p['tags']]
        channel += [f'  <description>{esc(p["description"])}</description>',
                    f'  <content:encoded>{esc(article_html(p, slugs))}</content:encoded>', '</item>']
    body = '\n'.join('    ' + line if line else line for line in channel)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" '
            'xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n'
            f'{body}\n  </channel>\n</rss>\n')


def sitemap_xml(posts, projects=()):
    stamp = newest(posts)
    pages = [(f'{SITE}/', stamp), (f'{SITE}/blog/', stamp)] + [(post_url(p), modified(p)) for p in posts]
    pages += [(f'{SITE}/about/', None), (f'{SITE}/portfolio/', None)] + [(project_url(p), None) for p in ordered(projects)]
    pages += [(f'{SITE}/experience/', None), (f'{SITE}/contact/', None)]
    urls = ''.join(f'  <url>\n    <loc>{esc(u)}</loc>\n' + (f'    <lastmod>{d}</lastmod>\n' if d else '') + '  </url>\n' for u, d in pages)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n'


def md_link_text(s):
    return re.sub(r'([\\\[\]])', r'\\\1', ' '.join(str(s).split()))


def llms_txt(posts, profile, resume_name, projects=()):
    name, one_line = profile['name'], lambda s: ' '.join(str(s).split())
    lines = [f'# {one_line(name)}', '']
    if profile.get('work_summary') or profile.get('headline'):
        lines += [f'> {one_line(profile.get("work_summary") or profile["headline"])}', '']
    lines += [f'This is the personal site of {one_line(name)}'
              + (f' ({one_line(profile["headline"])}, {one_line(profile["location"])}).' if profile.get('headline') and profile.get('location') else '.'),
              'The home page is an interactive 3D scene (it needs JavaScript and WebGL). Each of its rooms is also a plain page '
              'that needs neither: about, projects, experience, writing and contact. Follow the rules in robots.txt.',
              '', '## Writing']
    if profile.get('writing_description'):
        lines += [one_line(profile['writing_description']), '']
    lines += [f'- [{md_link_text(p["title"])}]({post_url(p)}): {one_line(p["description"])}' for p in posts]
    lines += ['', '## Projects']
    if profile.get('projects_intro'):
        lines += [one_line(profile['projects_intro']), '']
    lines += [f'- [{md_link_text(p["title"])}]({project_url(p)}): {one_line(p["summary"])}' for p in ordered(projects)]
    lines += ['', '## Site', f'- [Home]({SITE}/): the 3D atrium', f'- [About]({SITE}/about/): who I am, what I work on, and where',
              f'- [Projects]({SITE}/portfolio/): the list of projects',
              f'- [Experience]({SITE}/experience/): the timeline, skills, credentials, talks and papers',
              f'- [Writing]({SITE}/blog/): the list of posts', f'- [Contact]({SITE}/contact/): where to reach me, and availability']
    if resume_name:
        lines.append(f'- [Résumé (PDF)]({SITE}/resume/{quote(resume_name)})')
    lines += [f'- [RSS feed]({SITE}/feed.xml): every post in full', f'- [Sitemap]({SITE}/sitemap.xml)', f'- [robots.txt]({SITE}/robots.txt)', '']
    return '\n'.join(lines)


def redirects_txt(resume_name):
    pdf = f'/resume/{quote(resume_name)}' if resume_name else None
    rules = [(s, pdf if t == 'RESUME' else t) for s, t in REDIRECTS if t != 'RESUME' or pdf]
    return '# Written by tools/site_extras.py from the table at its top. Old addresses (docs/v1-contracts.md §1).\n' + \
           ''.join(f'{s} {t} 301\n' for s, t in rules)


def build(posts, profile, projects=()):
    files = {'feed.xml': feed_xml(posts, profile), 'sitemap.xml': sitemap_xml(posts, projects)}
    cv = resume(profile)
    files['llms.txt'] = llms_txt(posts, profile, cv and cv[0], projects)
    files['_redirects'] = redirects_txt(cv and cv[0])
    files = {k: v.encode('utf-8') for k, v in files.items()}
    if cv:
        files[f'resume/{cv[0]}'] = cv[1]
    return files


def write(out, files):
    for rel, data in sorted(files.items()):
        path = os.path.join(out, rel)
        try:
            with open(path, 'rb') as f:
                if f.read() == data:
                    continue
        except FileNotFoundError:
            pass
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path + '.tmp', 'wb') as f:
            f.write(data)
        os.replace(path + '.tmp', path)
        print('wrote', rel)
    folder = os.path.join(out, 'resume')
    for f in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
        if f'resume/{f}' not in files:
            os.remove(os.path.join(folder, f))
            print('removed', f'resume/{f}')
    if os.path.isdir(folder) and not os.listdir(folder):
        os.rmdir(folder)
