#!/usr/bin/env python3
"""The site's written content, read from data/.  Everything that builds pages (tools/site.py, the feed, the tests)
gets posts through load_posts(), so the files' format is defined in one place: docs/v1-contracts.md.

    python3 tools/content.py            # list the posts, or say what is wrong with one

A post is data/posts/<slug>.md: a header between two '---' lines, then the article in Markdown.
"""
import datetime, json, math, os, re, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DATA = os.path.join(ROOT, 'data')
SITE = 'https://adithya-rajendran.com'                     # canonical origin: links in the feed, the sitemap, og:url
REQUIRED = ('title', 'description', 'published')
LISTS = ('tags', 'takeaways', 'changelog', 'projects')
KNOWN = REQUIRED + LISTS + ('revised', 'image', 'image_alt', 'next', 'next_reason')
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
SLUG = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')


class ContentError(ValueError):
    pass


def _is_date(s):
    """2026-03-30 and a real day: the pattern alone lets 2026-13-45 through, which the page generator cannot print."""
    try:
        return bool(DATE.match(s)) and bool(datetime.date.fromisoformat(s))
    except (TypeError, ValueError):
        return False


def _scalar(v, where):
    """A header value: a JSON string ("...", with JSON escapes), or bare text taken as it stands."""
    v = v.strip()
    if v.startswith('"'):
        try:
            return json.loads(v)
        except ValueError:
            raise ContentError(f'{where}: not a valid quoted string: {v}')
    return v


def _value(v, where):
    v = v.strip()
    if v.startswith('['):                                   # [a, b] or ["a b", "c"]
        if not v.endswith(']'):
            raise ContentError(f'{where}: list is not closed')
        inner = v[1:-1].strip()
        if not inner:
            return []
        if '"' in inner:
            try:
                return json.loads(v)
            except ValueError:
                raise ContentError(f'{where}: not a valid list: {v}')
        return [x.strip() for x in inner.split(',')]
    return _scalar(v, where)


def parse_header(lines, name):
    """The header's lines -> dict. Forms: `key: value`, `key: [a, b]`, and `key:` followed by `  - item` lines,
    where an item is a value or a flat mapping (`  - date: ...` then `    kind: ...`)."""
    out, key, i = {}, None, 0
    pair = re.compile(r'^([a-z_]+):(?: (.*))?$')
    while i < len(lines):
        line, where = lines[i], f'{name}, header line {i + 2}'
        i += 1
        if not line.strip():
            continue
        if line.startswith('  - '):
            if key is None or not isinstance(out[key], list):
                raise ContentError(f'{where}: a list item without a `key:` line above it')
            item = line[4:]
            m = pair.match(item)
            if m and not item.startswith('"'):              # a mapping: this pair, then indented pairs
                entry = {m.group(1): _scalar(m.group(2) or '', where)}
                while i < len(lines) and lines[i].startswith('    ') and not lines[i].startswith('    - '):
                    m2 = pair.match(lines[i][4:])
                    if not m2:
                        raise ContentError(f'{name}, header line {i + 2}: expected `key: value`')
                    entry[m2.group(1)] = _scalar(m2.group(2) or '', where)
                    i += 1
                out[key].append(entry)
            else:
                out[key].append(_scalar(item, where))
            continue
        m = pair.match(line)
        if not m:
            raise ContentError(f'{where}: expected `key: value`')
        key = m.group(1)
        if key in out:
            raise ContentError(f'{where}: `{key}` appears twice')
        out[key] = [] if m.group(2) is None else _value(m.group(2), where)
    return out


def split(text, name='post'):
    """A file's text -> (header dict, Markdown body)."""
    lines = text.replace('\r\n', '\n').split('\n')
    if not lines or lines[0] != '---':
        raise ContentError(f'{name}: the first line must be ---')
    try:
        end = lines.index('---', 1)
    except ValueError:
        raise ContentError(f'{name}: the header is not closed with ---')
    return parse_header(lines[1:end], name), '\n'.join(lines[end + 1:]).strip('\n') + '\n'


def prose_words(body):
    """Words a reader reads: the body without fenced code, image lines and Markdown punctuation."""
    text = re.sub(r'^```.*?^```[ \t]*$', ' ', body, flags=re.S | re.M)
    text = re.sub(r'^!\[.*$', ' ', text, flags=re.M)
    text = re.sub(r'\]\([^)]*\)', ' ', text)
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'’./:_-]*", text))


def load_post(path):
    slug = os.path.basename(path)[:-3]
    name = f'data/posts/{slug}.md'
    if not SLUG.match(slug):
        raise ContentError(f'{name}: the file name must be lower-case words joined by hyphens')
    with open(path, encoding='utf-8') as f:
        head, body = split(f.read(), name)
    for k in head:
        if k not in KNOWN:
            raise ContentError(f'{name}: unknown header field `{k}`')
    for k in REQUIRED:
        if not head.get(k) or not isinstance(head[k], str):
            raise ContentError(f'{name}: `{k}` is required')
    for k in LISTS:
        head.setdefault(k, [])
        if not isinstance(head[k], list):
            raise ContentError(f'{name}: `{k}` must be a list')
    for k in ('published', 'revised'):
        if head.get(k) and not _is_date(head[k]):
            raise ContentError(f'{name}: `{k}` must be a date like 2026-03-30')
    for c in head['changelog']:
        if not isinstance(c, dict) or set(c) - {'date', 'kind', 'note'} or not _is_date(c.get('date', '')) \
                or c.get('kind') not in ('update', 'correction') or not c.get('note'):
            raise ContentError(f'{name}: a changelog entry needs date, kind (update or correction) and note')
    if head.get('image') and not os.path.exists(os.path.join(DATA, 'assets', 'images', head['image'])):
        raise ContentError(f'{name}: image {head["image"]} is not in data/assets/images/')
    words = prose_words(body)
    return dict({k: head.get(k) for k in KNOWN}, slug=slug, body=body, words=words, minutes=max(1, math.ceil(words / 200)))


def load_posts(folder=None):
    """Every post, newest first. Each is a dict: slug, the header fields (absent ones None, lists []), body (Markdown),
    words and minutes (reading time at 200 words a minute, as the previous site counted it)."""
    folder = folder or os.path.join(DATA, 'posts')
    posts = [load_post(os.path.join(folder, f)) for f in sorted(os.listdir(folder)) if f.endswith('.md')]
    slugs = {p['slug'] for p in posts}
    for p in posts:
        if p['next'] and p['next'] not in slugs:
            raise ContentError(f'data/posts/{p["slug"]}.md: `next` names a post that does not exist: {p["next"]}')
    return sorted(posts, key=lambda p: (p['published'], p['slug']), reverse=True)


def load_profile():
    with open(os.path.join(DATA, 'profile', 'profile.json'), encoding='utf-8') as f:
        return json.load(f)


if __name__ == '__main__':
    try:
        posts = load_posts()
    except ContentError as e:
        sys.exit(str(e))
    for p in posts:
        print(f"{p['published']}  {p['minutes']:2} min  {p['words']:5} words  {p['slug']}")
    print(f'{len(posts)} posts')
