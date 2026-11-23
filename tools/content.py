#!/usr/bin/env python3
"""The site's written content, read from data/.  Everything that builds pages (tools/site.py, the feed, the tests)
gets posts through load_posts(), so the files' format is defined in one place: docs/v1-contracts.md.

    python3 tools/content.py            # list the posts, or say what is wrong with one

A post is data/posts/<slug>.md: a header between two '---' lines, then the article in Markdown.
"""
import datetime, json, math, os, re, stat, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DATA = os.path.join(ROOT, 'data')
IMAGES = os.path.join(DATA, 'assets', 'images')
SITE = 'https://adithya-rajendran.com'                     # canonical origin: links in the feed, the sitemap, og:url
REQUIRED = ('title', 'description', 'published')
LISTS = ('tags', 'takeaways', 'changelog', 'projects')
KNOWN = REQUIRED + LISTS + ('revised', 'image', 'image_alt', 'next', 'next_reason')
STRING_LISTS = ('tags', 'takeaways', 'projects')            # the other list, changelog, holds mappings
CARD = (1200, 630)                                         # the social card's size, in pixels
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
            if key is None:
                raise ContentError(f'{where}: a list item without a `key:` line above it')
            where += f', `{key}`'                           # errors in a value name its field
            if not isinstance(out[key], list):
                raise ContentError(f'{where}: a list item under a field that has a value')
            item = line[4:]
            m = pair.match(item)
            if m and not item.startswith('"'):              # a mapping: this pair, then indented pairs
                entry = {m.group(1): _scalar(m.group(2) or '', where)}
                while i < len(lines) and lines[i].startswith('    ') and not lines[i].startswith('    - '):
                    m2 = pair.match(lines[i][4:])
                    if not m2 or m2.group(1) in entry:
                        raise ContentError(f'{name}, header line {i + 2}, `{key}`: expected a `key: value` not used above')
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
        out[key] = [] if m.group(2) is None else _value(m.group(2), f'{where}, `{key}`')
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


def image_file(name):
    """data/assets/images/<name>, or None unless name is a bare file name (no folder, so nothing outside can be
    reached) of a regular file there (not a symbolic link, which could point anywhere)."""
    if not isinstance(name, str) or not name or '/' in name or '\\' in name or name in ('.', '..'):
        return None
    path = os.path.join(IMAGES, name)
    try:
        return path if stat.S_ISREG(os.lstat(path).st_mode) else None
    except (OSError, ValueError):                         # ValueError: a NUL in the name
        return None


def prose_words(body):
    """Words a reader reads: the body without fenced code, image lines and Markdown punctuation."""
    text = re.sub(r'^```.*?^```[ \t]*$', ' ', body, flags=re.S | re.M)
    text = re.sub(r'^!\[.*$', ' ', text, flags=re.M)
    text = re.sub(r'\]\([^)]*\)', ' ', text)
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'’./:_-]*", text))


def check_header(head, name):
    """Every field's type, then the values that must agree: a malformed header is a ContentError naming the file and
    the field, never a traceback further on. Absent lists become []."""
    for k in head:
        if k not in KNOWN:
            raise ContentError(f'{name}: unknown header field `{k}`')
    for k in REQUIRED:
        if k not in head:
            raise ContentError(f'{name}: `{k}` is required')
    for k in (k for k in KNOWN if k not in LISTS):
        if k in head and not (isinstance(head[k], str) and head[k].strip()):
            raise ContentError(f'{name}: `{k}` must be a string, and not empty')
    for k in LISTS:
        head.setdefault(k, [])
        if not isinstance(head[k], list):
            raise ContentError(f'{name}: `{k}` must be a list')
    for k in STRING_LISTS:
        if not all(isinstance(x, str) and x.strip() for x in head[k]):
            raise ContentError(f'{name}: `{k}` must be a list of strings, none empty')
    for k in ('published', 'revised'):
        if k in head and not _is_date(head[k]):
            raise ContentError(f'{name}: `{k}` must be a date like 2026-03-30')
    if head.get('revised', head['published']) < head['published']:
        raise ContentError(f'{name}: `revised` ({head["revised"]}) is earlier than `published` ({head["published"]})')
    for c in head['changelog']:
        if not isinstance(c, dict) or set(c) != {'date', 'kind', 'note'} or not _is_date(c['date']) \
                or c['kind'] not in ('update', 'correction') or not (isinstance(c['note'], str) and c['note'].strip()):
            raise ContentError(f'{name}: `changelog`: each entry is date, kind (update or correction) and note, and nothing else')
    dates = [c['date'] for c in head['changelog']]
    if dates != sorted(dates, reverse=True):
        raise ContentError(f'{name}: `changelog` must be newest first')
    if dates and dates[-1] < head['published']:
        raise ContentError(f'{name}: `changelog` has an entry ({dates[-1]}) from before `published` ({head["published"]})')
    for p in head['projects']:
        if not SLUG.match(p) or not os.path.isfile(os.path.join(DATA, 'projects', f'{p}.json')):
            raise ContentError(f'{name}: `projects`: there is no data/projects/{p}.json')
    if 'image' in head:
        path = image_file(head['image'])
        if not path:
            raise ContentError(f'{name}: `image` must be the name of a file in data/assets/images/, with no folder: {head["image"]}')
        problem = card_problem(path)
        if problem:
            raise ContentError(f'{name}: `image` {head["image"]}: {problem}')


def card_problem(path):
    """What makes this file unfit to be the social card, or None. It is copied unchanged to the public site for
    og:image, so it must be a PNG or JPEG of exactly CARD pixels (as its own header says, whatever its name says),
    named for what it is, and carry no EXIF (camera, place, time)."""
    with open(path, 'rb') as f:
        d = f.read()
    ext = os.path.splitext(path)[1].lower()
    if d[:8] == b'\x89PNG\r\n\x1a\n' and d[12:16] == b'IHDR':
        kind, exts, size = 'PNG', ('.png',), (int.from_bytes(d[16:20], 'big'), int.from_bytes(d[20:24], 'big'))
        i, exif = 8, False
        while i + 8 <= len(d) and not exif:                # chunks: length, type, data, CRC
            exif = d[i + 4:i + 8] == b'eXIf'
            i += 12 + int.from_bytes(d[i:i + 4], 'big')
    elif d[:3] == b'\xff\xd8\xff':
        kind, exts, size, i = 'JPEG', ('.jpg', '.jpeg'), None, 2
        while size is None and i + 9 <= len(d) and d[i] == 0xff:   # segments up to the frame header, which has the size
            marker = d[i + 1]
            if marker == 0xff:                             # a fill byte
                i += 1
                continue
            if 0xc0 <= marker <= 0xcf and marker not in (0xc4, 0xc8, 0xcc):
                size = int.from_bytes(d[i + 7:i + 9], 'big'), int.from_bytes(d[i + 5:i + 7], 'big')
            i += 2 + int.from_bytes(d[i + 2:i + 4], 'big')
        if size is None:
            return 'a JPEG whose size cannot be read from its header'
        # An APP1 segment that starts with Exif. Inside compressed data 0xff is always followed by 0 or a restart
        # marker, so these bytes can only be the segment itself, wherever it is.
        exif = re.search(rb'\xff\xe1..Exif\0\0', d, re.S) is not None
    else:
        return 'not a PNG or JPEG; the social card must be one of them'
    if size != CARD:
        return f'the social card must be {CARD[0]}x{CARD[1]} pixels; this {kind} is {size[0]}x{size[1]}'
    if ext not in exts:
        return f'this file is a {kind}, so its name must end in {" or ".join(exts)}'
    if exif:
        return f'this {kind} carries EXIF metadata, which would be published with it; it must be stripped first'
    return None


def load_post(path):
    slug = os.path.basename(path)[:-3]
    name = f'data/posts/{slug}.md'
    if not SLUG.match(slug):
        raise ContentError(f'{name}: the file name must be lower-case words joined by hyphens')
    try:
        with open(path, encoding='utf-8') as f:
            head, body = split(f.read(), name)
    except UnicodeDecodeError as e:
        raise ContentError(f'{name}: not UTF-8 text ({e.reason} at byte {e.start})')
    check_header(head, name)
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
