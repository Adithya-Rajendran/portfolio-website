#!/usr/bin/env python3
"""The site's written content, read from data/.  Everything that builds pages (tools/site.py, the feed, the tests)
gets posts through load_posts(), so the files' format is defined in one place: docs/v1-contracts.md.

    python3 tools/content.py            # list the posts and projects, say the profile is valid, or what is wrong

A post is data/posts/<slug>.md and a project data/projects/<slug>.md: a header between two '---' lines, then the
text in Markdown. The profile is data/profile.json. Formats: docs/v1-contracts.md §2, §6 and §7.
"""
import datetime, json, math, os, re, stat, sys, urllib.parse

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DATA = os.path.join(ROOT, 'data')
IMAGES = os.path.join(DATA, 'assets', 'images')
FILES = os.path.join(DATA, 'assets', 'files')
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


def _plain_file(folder, name):
    """folder/<name>, or None unless name is a bare file name (no folder, so nothing outside can be reached) of a
    regular file there (not a symbolic link, which could point anywhere)."""
    if not isinstance(name, str) or not name or '/' in name or '\\' in name or name in ('.', '..'):
        return None
    path = os.path.join(folder, name)
    try:
        return path if stat.S_ISREG(os.lstat(path).st_mode) else None
    except (OSError, ValueError):                         # ValueError: a NUL in the name
        return None


def image_file(name):
    """data/assets/images/<name>, or None (see _plain_file)."""
    return _plain_file(IMAGES, name)


def asset_file(name):
    """data/assets/files/<name>, or None (see _plain_file)."""
    return _plain_file(FILES, name)


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
        if not SLUG.match(p) or not os.path.isfile(os.path.join(DATA, 'projects', f'{p}.md')):
            raise ContentError(f'{name}: `projects`: there is no data/projects/{p}.md')
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


# ---------- values checked by a small table-driven reader, shared by projects (§6) and the profile (§7)

class _Bad(ValueError):
    """A value that is wrong; `path` names the field it is in, outermost first."""
    def __init__(self, msg, path=()):
        super().__init__(msg)
        self.msg, self.path = msg, path


def _where(path):
    return ''.join(f'[{p}]' if isinstance(p, int) else (f'.{p}' if i else p) for i, p in enumerate(path))


def _at(seg, fn, v):
    try:
        return fn(v)
    except _Bad as e:
        raise _Bad(e.msg, (seg,) + e.path)
    except ValueError as e:
        raise _Bad(str(e), (seg,))


def _line(v):
    if not isinstance(v, str) or not v.strip():
        raise ValueError('must be a string, and not empty')
    if v != v.strip() or re.search(r'[\x00-\x1f\x7f]', v):
        raise ValueError('must be one line with no space at its ends')
    return v


def _text(v):
    """Paragraphs of plain text, one blank line between them."""
    if not isinstance(v, str) or not v.strip():
        raise ValueError('must be a string, and not empty')
    if v != v.strip() or '\r' in v or re.search(r'\n\n\n|[\x00-\x09\x0b-\x1f\x7f]', v) or any(l != l.strip() for l in v.split('\n')):
        raise ValueError('must be plain paragraphs separated by one blank line, with no space at the ends of a line')
    return v


def _date(v):
    if not isinstance(v, str) or not _is_date(v):
        raise ValueError('must be a date like 2026-03-30')
    return v


def _word(v):
    if not isinstance(v, str) or not SLUG.match(v):
        raise ValueError('must be lower-case words joined by hyphens')
    return v


def _id(v):
    if not isinstance(v, str) or not re.fullmatch(r'[a-z][a-z0-9-]*', v):
        raise ValueError('must be a valid HTML id: lower-case letters, digits and hyphens, starting with a letter')
    return v


def _enum(*values):
    def check(v):
        if v not in values:
            raise ValueError('must be one of ' + ', '.join(values))
        return v
    return check


def _count(v):
    """A whole number from 1: an int (the profile's JSON) or its digits (a header, which reads everything as text)."""
    if isinstance(v, str) and re.fullmatch(r'[1-9]\d{0,8}', v):
        return int(v)
    if isinstance(v, int) and not isinstance(v, bool) and v >= 1:
        return v
    raise ValueError('must be a whole number from 1')


def _bool(v):
    if v in ('true', 'false'):                               # a header's bare words
        return v == 'true'
    if isinstance(v, bool):
        return v
    raise ValueError('must be true or false')


def _year(v):
    if not isinstance(v, int) or isinstance(v, bool) or not 1900 <= v <= 2200:
        raise ValueError('must be a year like 2028')
    return v


def _flag(v):
    """true or false as JSON writes them (a header's bare words are _bool)."""
    if not isinstance(v, bool):
        raise ValueError('must be true or false')
    return v


def _http(v):
    _line(v)
    u = urllib.parse.urlsplit(v)
    if u.scheme not in ('http', 'https') or not u.netloc or re.search(r'\s', v):
        raise ValueError('must be an http or https address')
    return v


def _image(v):
    if not image_file(v):
        raise ValueError(f'must be the name of a file in data/assets/images/, with no folder: {v}')
    return v


def _file(v):
    if not asset_file(v):
        raise ValueError(f'must be the name of a file in data/assets/files/, with no folder: {v}')
    return v


def _post(v):
    if not isinstance(v, str) or not SLUG.match(v) or not os.path.isfile(os.path.join(DATA, 'posts', v + '.md')):
        raise ValueError(f'there is no data/posts/{v}.md')
    return v


def _lst(fn, *, nonempty=False):
    def check(v):
        if not isinstance(v, list):
            raise ValueError('must be a list')
        if nonempty and not v:
            raise ValueError('must not be empty')
        return [_at(i, fn, x) for i, x in enumerate(v)]
    check.default = list
    return check


def _rec(fields, rule=None):
    """A record with exactly these fields: {name: (check, required)}. Absent optional ones come back as None, or []
    for a list. `rule(record)` then checks what must agree, raising ValueError."""
    def check(v):
        if not isinstance(v, dict):
            raise ValueError('must be a record of fields')
        for k in v:
            if k not in fields:
                raise _Bad(f'unknown field `{k}`')
        out = {}
        for k, (fn, required) in fields.items():
            if k in v:
                out[k] = _at(k, fn, v[k])
            elif required:
                raise _Bad(f'`{k}` is required')
            else:
                out[k] = getattr(fn, 'default', lambda: None)()
        if rule:
            rule(out)
        return out
    return check


def _req(fn):
    return fn, True


def _opt(fn):
    return fn, False


def _project(exists):
    """A project's slug; `exists(slug)` says whether there is such a project."""
    def check(v):
        if not isinstance(v, str) or not SLUG.match(v) or not exists(v):
            raise ValueError(f'there is no project {v}')
        return v
    return check


def _link(exists):
    """label, kind, and exactly one place it goes: url (http or https), post, project or file (a slug or file name)."""
    def rule(r):
        if sum(r[k] is not None for k in ('url', 'post', 'project', 'file')) != 1:
            raise ValueError('a link needs exactly one of `url`, `post`, `project` and `file`')
    return _rec({'label': _req(_line), 'kind': _req(_enum(*LINK_KINDS)), 'url': _opt(_http), 'post': _opt(_post),
                 'project': _opt(_project(exists)), 'file': _opt(_file)}, rule)


def _need(r, a, *others):
    """`a` is set only when every one of `others` is."""
    if r[a] is not None and not all(r[o] is not None for o in others):
        raise ValueError(f'`{a}` needs ' + ' and '.join(f'`{o}`' for o in others))


# ---------- projects: data/projects/<slug>.md (docs/v1-contracts.md §6)

LINK_KINDS = ('article', 'repo', 'paper', 'dataset', 'other')
PROJECT_STATUS = ('active', 'completed')
PROJECT_TYPES = ('software', 'infrastructure', 'research', 'hardware')
PRECISIONS = ('year', 'month')


def _project_rule(r):
    for a, b in (('cover_alt', 'cover'), ('cover_caption', 'cover'), ('date_precision', 'started'), ('dates_approximate', 'started'),
                 ('ended', 'started'), ('approach', 'problem'), ('problem', 'approach'), ('outcome', 'problem')):
        _need(r, a, b)
    if r['started'] and not r['date_precision']:
        raise ValueError('`started` needs `date_precision`')
    if r['ended'] and r['ended'] < r['started']:
        raise ValueError(f'`ended` ({r["ended"]}) is earlier than `started` ({r["started"]})')
    if r['ended'] and r['status'] == 'active':
        raise ValueError('an `active` project has no `ended`')


def _project_fields(project_exists):
    return {'title': _req(_line), 'name': _req(_line), 'summary': _req(_line), 'order': _req(_count), 'status': _req(_enum(*PROJECT_STATUS)),
            'status_note': _opt(_line), 'types': _req(_lst(_enum(*PROJECT_TYPES), nonempty=True)), 'technologies': _opt(_lst(_line)),
            'role': _opt(_line), 'started': _opt(_date), 'ended': _opt(_date), 'date_precision': _opt(_enum(*PRECISIONS)),
            'dates_approximate': _opt(_bool), 'featured': _opt(_count), 'quiet': _opt(_bool),
            'cover': _opt(_image), 'cover_alt': _opt(_line), 'cover_caption': _opt(_line),
            'problem': _opt(_line), 'approach': _opt(_line), 'outcome': _opt(_line),
            'highlights': _opt(_lst(_line)), 'lessons': _opt(_lst(_line)), 'next_steps': _opt(_lst(_line)),
            'parameters': _opt(_lst(_rec({'label': _req(_line), 'value': _req(_line)}))),
            'results': _opt(_lst(_rec({'metric': _req(_line), 'value': _req(_line), 'note': _opt(_line)}))),
            'links': _opt(_lst(_link(project_exists)))}


PROJECT_KNOWN = tuple(_project_fields(None))


def load_project(path, slugs):
    """One project file -> its dict. `slugs` are the projects that exist, for links to a project."""
    slug = os.path.basename(path)[:-3]
    name = f'data/projects/{slug}.md'
    if not SLUG.match(slug):
        raise ContentError(f'{name}: the file name must be lower-case words joined by hyphens')
    try:
        with open(path, encoding='utf-8') as f:
            head, body = split(f.read(), name)
    except UnicodeDecodeError as e:
        raise ContentError(f'{name}: not UTF-8 text ({e.reason} at byte {e.start})')
    try:
        rec = _rec(_project_fields(slugs.__contains__), _project_rule)(head)
    except _Bad as e:
        raise ContentError(f'{name}: {"`" + _where(e.path) + "`: " if e.path else ""}{e.msg}')
    except ValueError as e:                                 # the rule, or a header that is not a record
        raise ContentError(f'{name}: {e}')
    text = re.sub(r'^```.*?^```[ \t]*$', ' ', body, flags=re.S | re.M)   # what the body points at must exist
    for target in re.findall(r'\]\(([^)\s]+)', text):
        m = re.fullmatch(r'/(blog|portfolio)/([^/?#]*)/?(?:[?#].*)?', target)
        if m and m[1] == 'blog' and not (SLUG.match(m[2]) and os.path.isfile(os.path.join(DATA, 'posts', m[2] + '.md'))):
            raise ContentError(f'{name}: the body links to {target}, which is not a post')
        if m and m[1] == 'portfolio' and m[2] not in slugs:
            raise ContentError(f'{name}: the body links to {target}, which is not a project')
        if target.startswith('../assets/files/') and not asset_file(target.split('/')[-1]):
            raise ContentError(f'{name}: the body links to {target}, which is not in data/assets/files/')
        if target.startswith('../assets/images/') and not image_file(target.split('/')[-1]):
            raise ContentError(f'{name}: the body shows {target}, which is not in data/assets/images/')
    return dict(rec, slug=slug, body=body, words=prose_words(body))


def load_projects(folder=None):
    """Every project, in `order`. Each is a dict: slug, every header field (absent ones None, lists []), body (Markdown)
    and words. `order` and `featured` are each unique among the projects."""
    folder = folder or os.path.join(DATA, 'projects')
    files = sorted(f for f in os.listdir(folder) if f.endswith('.md'))
    slugs = {f[:-3] for f in files}
    projects = [load_project(os.path.join(folder, f), slugs) for f in files]
    for k in ('order', 'featured'):
        seen = {}
        for p in projects:
            if p[k] is not None and seen.setdefault(p[k], p['slug']) != p['slug']:
                raise ContentError(f'data/projects/{p["slug"]}.md: `{k}` {p[k]} is also used by {seen[p[k]]}')
    return sorted(projects, key=lambda p: p['order'])


# ---------- the profile: data/profile.json (docs/v1-contracts.md §7)

def _credential_rule(r):
    _need(r, 'badge_alt', 'badge')
    if r['expires_on'] and r['expires_on'] < r['issued_on']:
        raise ValueError(f'`expires_on` ({r["expires_on"]}) is earlier than `issued_on` ({r["issued_on"]})')
    if r['expires_on'] and r['lifetime']:
        raise ValueError('a `lifetime` credential has no `expires_on`')


def _entry_rule(r):
    _need(r, 'logo_alt', 'logo')
    _need(r, 'start_precision', 'start_date')
    _need(r, 'end_precision', 'end_date')
    if r['end_date'] and r['end_date'] < r['start_date']:
        raise ValueError(f'`end_date` ({r["end_date"]}) is earlier than `start_date` ({r["start_date"]})')
    if r['is_current'] and r['end_date']:
        raise ValueError('a current entry has no `end_date`')
    if r['expected_end_year'] and r['expected_end_year'] < int(r['start_date'][:4]):
        raise ValueError('`expected_end_year` is before the year of `start_date`')


def _profile_check():
    exists = lambda p: os.path.isfile(os.path.join(DATA, 'projects', p + '.md'))
    link, project, prec = _link(exists), _project(exists), _enum(*PRECISIONS)
    return _rec({
        'name': _req(_line), 'headline': _req(_line), 'tagline': _req(_line), 'introduction': _req(_line), 'bio': _req(_text),
        'work_summary': _req(_line), 'location': _req(_line), 'seo_description': _req(_line), 'writing_description': _req(_line),
        'projects_intro': _req(_line), 'contact_intro': _req(_line), 'contact_invitation': _req(_line),
        'focus_areas': _opt(_lst(_line)), 'featured_post': _opt(_post), 'resume': _opt(_file),
        'availability': _req(_rec({'status': _req(_word), 'cta': _req(_line), 'seeking': _opt(_lst(_line)), 'updated_at': _opt(_date)})),
        'contact_routes': _req(_routes),
        'credentials': _opt(_lst(_rec({'title': _req(_line), 'issuer': _req(_line), 'issued_on': _req(_date), 'expires_on': _opt(_date),
                                       'lifetime': _opt(_flag), 'verification_url': _opt(_http), 'badge': _opt(_image), 'badge_alt': _opt(_line)},
                                      _credential_rule))),
        'skill_groups': _req(_lst(_rec({'title': _req(_line), 'skills': _req(_lst(_line, nonempty=True))}), nonempty=True)),
        'social_links': _req(_lst(_rec({'label': _req(_line), 'url': _req(_http)}), nonempty=True)),
        'current_curiosities': _opt(_lst(_rec({'title': _req(_line), 'note': _opt(_line), 'project': _opt(project)}))),
        'curiosities_updated_at': _opt(_date),
        'talks_and_papers': _opt(_lst(_rec({'title': _req(_line), 'kind': _req(_line), 'date': _req(_date), 'authors': _opt(_line),
                                            'venue': _opt(_line), 'abstract': _opt(_line), 'project': _opt(project),
                                            'links': _opt(_lst(link))}))),
        'timeline': _req(_lst(_rec({'id': _req(_id), 'kind': _req(_enum('work', 'education')), 'organization': _req(_line),
                                    'org_short': _req(_line), 'title': _req(_line), 'employment': _opt(_line), 'location': _opt(_line),
                                    'summary': _opt(_line), 'start_date': _req(_date), 'start_precision': _opt(prec), 'end_date': _opt(_date),
                                    'end_precision': _opt(prec), 'expected_end_year': _opt(_year), 'is_current': _opt(_flag),
                                    'highlights': _opt(_lst(_line)), 'logo': _opt(_image), 'logo_alt': _opt(_line)}, _entry_rule),
                           nonempty=True)),
    })


def _routes(v):
    """contact_routes: {route id: {title, prompt}}."""
    if not isinstance(v, dict) or not v:
        raise ValueError('must be a record of routes, and not empty')
    route = _rec({'title': _req(_line), 'prompt': _req(_line)})
    return {_at(k, _id, k): _at(k, route, r) for k, r in v.items()}


def _no_duplicates(pairs):
    out = {}
    for k, v in pairs:
        if k in out:
            raise ValueError(f'`{k}` appears twice in the same record')
        out[k] = v
    return out


def load_profile(path=None):
    """data/profile.json -> its dict, validated: every field of §7 is there (absent optional ones None, lists []).
    Anything wrong is a ContentError naming the field, never a traceback."""
    path = path or os.path.join(DATA, 'profile.json')
    name = 'data/profile.json'
    try:
        with open(path, encoding='utf-8') as f:
            doc = json.load(f, object_pairs_hook=_no_duplicates,
                            parse_constant=lambda c: (_ for _ in ()).throw(ValueError(f'{c} is not allowed')))
    except OSError as e:
        raise ContentError(f'{name}: cannot be read ({e.strerror})')
    except UnicodeDecodeError as e:
        raise ContentError(f'{name}: not UTF-8 text ({e.reason} at byte {e.start})')
    except ValueError as e:
        raise ContentError(f'{name}: not valid JSON: {e}')
    except RecursionError:
        raise ContentError(f'{name}: not valid JSON: nested too deeply')
    try:
        profile = _profile_check()(doc)
        ids = [e['id'] for e in profile['timeline']]
        if len(set(ids)) != len(ids):
            raise _Bad(f'the id {next(i for i in ids if ids.count(i) > 1)} is used twice', ('timeline',))
        starts = [e['start_date'] for e in profile['timeline']]
        if starts != sorted(starts, reverse=True):
            raise _Bad('must be newest first by `start_date`', ('timeline',))
    except _Bad as e:
        raise ContentError(f'{name}: {"`" + _where(e.path) + "`: " if e.path else ""}{e.msg}')
    except ValueError as e:                                 # the top level is not a record, or a record's rule
        raise ContentError(f'{name}: {e}')
    return profile


if __name__ == '__main__':
    try:
        posts, projects, profile = load_posts(), load_projects(), load_profile()
    except ContentError as e:
        sys.exit(str(e))
    for p in posts:
        print(f"{p['published']}  {p['minutes']:2} min  {p['words']:5} words  {p['slug']}")
    print(f'{len(posts)} posts')
    for p in projects:
        print(f"{p['order']:2}  {p['status']:9}  {p['words']:5} words  {p['slug']}")
    print(f'{len(projects)} projects')
    print(f"profile: valid ({profile['name']}; {len(profile['timeline'])} timeline entries, {len(profile['credentials'])} credentials, "
          f"{len(profile['skill_groups'])} skill groups)")
