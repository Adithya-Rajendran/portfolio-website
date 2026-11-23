#!/usr/bin/env python3
"""Sanity documents -> the files the site reads from now on, which are edited by hand:
    data/posts/<slug>.json     -> data/posts/<slug>.md          (docs/v1-contracts.md §2)
    data/projects/<slug>.json  -> data/projects/<slug>.md       (§6)
    data/profile/profile.json  -> data/profile.json             (§7)
tools/content.py reads them.

    python3 tools/sanity_to_md.py            # write the files that do not exist; list the ones that differ
    python3 tools/sanity_to_md.py --force    # overwrite those too (the new files are edited by hand after the conversion)

Anything in a document that this script does not know (a block type, style, mark, list level, a field) stops it with
an error naming the document and the field or block: nothing is dropped silently. What is deliberately not carried is
a short list (DROPPED below, and data/README.md); each use of it is printed as a `note`. tools/test_sanity_to_md.py
checks the output.
"""
import datetime, glob, json, os, re, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DATA = os.path.join(ROOT, 'data')
SITE = 'https://adithya-rajendran.com'
CDN = 'https://cdn.sanity.io/files/ppk2h9tb/production/'
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
SLUG = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
DOC_FIELDS = {'body', 'changelog', 'description', 'nextPost', 'nextReadReason', 'projects', 'publishedAt', 'revisedAt',
              'slug', 'socialImage', 'tags', 'takeaways', 'title'}
PROJECT_FIELDS = {'body', 'brief', 'cover', 'datePrecision', 'datesApproximate', 'designation', 'endDate', 'featured', 'highlights',
                  'lessons', 'links', 'model', 'myRole', 'name', 'next', 'parameters', 'quiet', 'results', 'slug', 'startDate',
                  'status', 'statusNote', 'summary', 'technologies', 'title', 'types'}
PROFILE_FIELDS = {'availability', 'bio', 'contactIntro', 'contactInvitation', 'contactRoutes', 'credentials', 'curiositiesUpdatedAt',
                  'currentCuriosities', 'featuredPost', 'focusAreas', 'headline', 'introduction', 'location', 'name', 'projectsIntro',
                  'resume', 'seoDescription', 'skillGroups', 'socialLinks', 'tagline', 'talksAndPapers', 'timeline', 'workSummary',
                  'writingDescription'}
TOP_BOOKKEEPING = ('_id', '_type', '_rev', '_createdAt', '_updatedAt', '_system')   # a document's own
BOOKKEEPING = ('_key', '_type', '_weak')                     # inside records: Sanity's own, carried nowhere
STYLES = {'normal': '', 'h2': '## ', 'h3': '### ', 'blockquote': '> '}
DECORATORS = ('strong', 'em', 'code')                       # outermost first, inside any link: [**_x_ `y`**](url)
# a line that starts like this would be read as a heading, quotation, list item, thematic break or code fence
LINE_START = re.compile(r'^(#{1,6}(?=[ \t]|$)|>|[-+](?=[ \t]|$)|-(?=-)|~(?=~~))')
LIST_NUMBER = re.compile(r'^(\d{1,9})([.)])(?=[ \t]|$)')


class ConvertError(Exception):
    pass


def load(folder):
    out = {}
    for f in sorted(glob.glob(os.path.join(DATA, folder, '*.json'))):
        with open(f, encoding='utf-8') as fh:
            out[os.path.basename(f)[:-5]] = json.load(fh)
    return out


# ---------- text -> Markdown source that reads back as the same text

def esc(t):
    """Escape what Markdown would read as markup inside a line. `_` inside a word (snake_case) is not markup;
    a backslash only matters before punctuation."""
    def one(m):
        c, i = m.group(), m.start()
        if c == '_' and 0 < i < len(t) - 1 and t[i - 1].isalnum() and t[i + 1].isalnum():
            return c
        if c == '\\' and i + 1 < len(t) and not re.match(r'[!-/:-@\[-`{-~]', t[i + 1]):
            return c
        return '\\' + c
    return re.sub(r'[\\*`\[\]_]', one, t)


def line_start(line, heading=False):
    """The escapes that depend on the place in the line: its start (a heading's text can start with anything), and the
    end of a heading, where a run of # would be its closing sequence."""
    if heading:
        return re.sub(r'(?:(?<= )|^)#+$', lambda m: '\\' + m.group(), line)
    return LINE_START.sub(r'\\\1', LIST_NUMBER.sub(r'\1\\\2', line))      # 1. -> 1\.   # -> \#


def code_span(t):
    """A delimiter longer than any run of backticks inside; padded by a space when the text touches a backtick or is
    framed by spaces."""
    runs = {len(r) for r in re.findall(r'`+', t)}
    d = '`' * next(n for n in range(1, len(t) + 2) if n not in runs)
    pad = ' ' if t[0] == '`' or t[-1] == '`' or (t[0] == t[-1] == ' ' and t.strip()) else ''
    return d + pad + t + pad + d


def wrap(body, left, right):
    """left + body + right, with the body's edge spaces moved outside: a delimiter next to a space is not a delimiter."""
    core = body.strip()
    if not core:
        return body
    a = len(body) - len(body.lstrip())
    return body[:a] + left + core + right + body[a + len(core):]


def rewrite(href, where, posts, projects, files):
    """Links to the old site and to the Sanity CDN become the site's own forms (contract §2); the rest stays as it is,
    except that characters that cannot sit inside (...) are percent-encoded."""
    for old, new, known in ((SITE + '/blog/', '/blog/%s/', posts), (SITE + '/portfolio/', '/portfolio/%s/', projects)):
        m = href.startswith(old) and re.match(r'^([a-z0-9-]+?)/?([?#].*)?$', href[len(old):])
        if m:
            if m.group(1) not in known:
                raise ConvertError(f'{where}: the link {href} names no post or project of that slug')
            return new % m.group(1) + (m.group(2) or '')
    if href.startswith(CDN):
        if href[len(CDN):] not in files:
            raise ConvertError(f'{where}: the link {href} is a file that is not in data/assets/files/')
        return '../assets/files/' + href[len(CDN):]
    return re.sub(r'[\s()<>\\]', lambda m: '%%%02X' % ord(m.group()), href)


def inline(block, where, ctx):
    """A block's spans -> one line of Markdown. Neighbouring spans that share a mark are grouped, so that a strong
    run holding some code is one `**a `b` c**`, not three."""
    defs = {d['_key']: d for d in block.get('markDefs', [])}
    spans = []
    for s in block['children']:
        if s.get('_type') != 'span':
            raise ConvertError(f'{where}: a child of type {s.get("_type")!r} (only spans are known)')
        if '\n' in s['text'] or '\r' in s['text']:
            raise ConvertError(f'{where}: a line break inside the span {s["text"]!r}')
        for m in s.get('marks') or []:
            if m not in DECORATORS and (m not in defs or defs[m].get('_type') != 'contentLink'):
                raise ConvertError(f'{where}: unknown mark {m!r} on the span {s["text"]!r}')
        if s['text']:
            spans.append((s['text'], list(s.get('marks') or [])))
    links = []                                              # link keys in order of appearance
    for _, ms in spans:
        links += [m for m in ms if m not in DECORATORS and m not in links]

    def render(group, order):
        out, i = '', 0
        while i < len(group):
            mark = next((m for m in order if m in group[i][1]), None)
            j = i + 1
            while j < len(group) and (mark in group[j][1] if mark else not any(m in order for m in group[j][1])):
                j += 1
            if mark is None:
                out += esc(''.join(t for t, _ in group[i:j]))
            else:
                inner = [(t, [x for x in ms if x != mark]) for t, ms in group[i:j]]
                if mark == 'code':
                    out += code_span(''.join(t for t, _ in inner))
                elif mark in DECORATORS:
                    d = '**' if mark == 'strong' else '*'
                    out += wrap(render(inner, order), d, d)
                else:
                    href = rewrite(defs[mark]['href'], where, *ctx)
                    out += wrap(render(inner, order), '[', '](' + href + ')')
            i = j
        return out
    return render(spans, links + list(DECORATORS)).strip()


def fence(b, where):
    code, lang = b.get('code'), b.get('language') or ''
    if not isinstance(code, str) or not code.strip():
        raise ConvertError(f'{where}: an empty code block')
    if '\r' in code or code.endswith('\n') or re.search(r'^[ ]{0,3}(`{3,}|~{3,})', code, re.M):
        raise ConvertError(f'{where}: the code has a carriage return, a final newline or a ``` line: it cannot be fenced verbatim')
    if not re.match(r'^[A-Za-z0-9_+#.-]*$', lang):
        raise ConvertError(f'{where}: the language {lang!r} cannot be written after a fence')
    return f'```{lang}\n{code}\n```'


def image(b, where, files_ok):
    m = re.match(r'^image-([0-9a-f]{40}-\d+x\d+)-(\w+)$', (b.get('asset') or {}).get('_ref', ''))
    if not m:
        raise ConvertError(f'{where}: the image has no usable asset reference')
    name = f'{m.group(1)}.{m.group(2)}'
    files_ok(name, where)
    alt, cap = esc((b.get('alt') or '').strip()), esc((b.get('caption') or '').strip())
    for s in (alt, cap):
        if '\n' in s:
            raise ConvertError(f'{where}: a line break in the alt text or caption')
    cap = ' "' + cap.replace('"', '\\"') + '"' if cap else ''
    return f'![{alt}](../assets/images/{name}{cap})'


def body(slug, doc, ctx, image_ok):
    parts, prev_item, count = [], False, {}
    fresh = False                                           # this item starts a list
    for n, b in enumerate(doc['body'], 1):
        where = f'{slug}.json: body block {n} (_key {b.get("_key")}, type {b.get("_type")})'
        t = b.get('_type')
        item = False
        if t == 'code':
            text = fence(b, where)
        elif t == 'image':
            text = image(b, where, image_ok)
        elif t == 'block':
            style, li, level = b.get('style'), b.get('listItem'), b.get('level')
            if style not in STYLES:
                raise ConvertError(f'{where}: unknown style {style!r}')
            line = inline(b, where, ctx)
            if not line:
                raise ConvertError(f'{where}: an empty block')
            if li:
                if li not in ('bullet', 'number') or level not in (1, 2) or style != 'normal':
                    raise ConvertError(f'{where}: unknown list item (listItem {li!r}, level {level!r}, style {style!r})')
                if level == 2 and not prev_item:
                    raise ConvertError(f'{where}: a level 2 list item that is not inside a list')
                fresh = not prev_item or (level == 1 and count.get(1, (li,))[0] != li)
                if fresh:
                    count = {}                              # a new list (a blank line before it); a nested one restarts under each parent
                k, c = count.get(level, (li, 0))
                c = c + 1 if k == li else 1
                count[level] = (li, c)
                if level == 1:
                    count.pop(2, None)
                marker = '- ' if li == 'bullet' else f'{c}. '
                text = ('    ' if level == 2 else '') + marker + line_start(line)
                item = True
            else:
                if level is not None:
                    raise ConvertError(f'{where}: a level without a listItem')
                text = STYLES[style] + line_start(line, style in ('h2', 'h3'))
        else:
            raise ConvertError(f'{where}: unknown block type {t!r}')
        if item and prev_item and not fresh:
            parts[-1] += '\n' + text
        else:
            parts.append(text)
        prev_item = item
    return '\n\n'.join(parts) + '\n'


# ---------- header

def q(s):
    return json.dumps(s, ensure_ascii=False)


def bare(s):
    return s if SLUG.match(s) or DATE.match(s) else q(s)


def one_line(s, what, slug):
    if not isinstance(s, str) or not s.strip() or '\n' in s:
        raise ConvertError(f'{slug}.json: {what} must be one line of text, it is {s!r}')
    return s.strip()


def header(slug, doc, posts, projects, image_ok):
    h = ['---']
    for k in doc:
        if k not in DOC_FIELDS and not k.startswith('_'):
            raise ConvertError(f'{slug}.json: unknown field `{k}`: add it to the format first, then to this script')
    if doc.get('slug', {}).get('current') != slug:
        raise ConvertError(f'{slug}.json: the slug field says {doc.get("slug")!r}, not the file name')
    for k in ('title', 'description'):
        h.append(f'{k}: {q(one_line(doc.get(k), k, slug))}')
    for k, name in (('publishedAt', 'published'), ('revisedAt', 'revised')):
        if doc.get(k) or k == 'publishedAt':
            if not DATE.match(doc.get(k) or ''):
                raise ConvertError(f'{slug}.json: {k} must be a date like 2026-03-30, it is {doc.get(k)!r}')
            h.append(f'{name}: {doc[k]}')
    if doc.get('tags'):
        tags = [one_line(t, 'a tag', slug) for t in doc['tags']]
        h.append('tags: ' + ('[' + ', '.join(tags) + ']' if all(SLUG.match(t) for t in tags) else json.dumps(tags, ensure_ascii=False)))
    img = doc.get('socialImage')
    if img:
        name = ref_image(img.get('asset', {}).get('_ref', ''), f'{slug}.json: socialImage', image_ok)
        h.append(f'image: {name}')
        if img.get('alt'):
            h.append(f'image_alt: {q(one_line(img["alt"], "socialImage.alt", slug))}')
    if doc.get('takeaways'):
        h.append('takeaways:')
        h += ['  - ' + q(line_start(esc(one_line(t, 'a takeaway', slug)))) for t in doc['takeaways']]
    if doc.get('changelog'):
        h.append('changelog:')
        for c in sorted(doc['changelog'], key=lambda c: c.get('date', ''), reverse=True):
            if not DATE.match(c.get('date', '')) or c.get('kind') not in ('update', 'correction') or not c.get('note'):
                raise ConvertError(f'{slug}.json: a changelog entry needs date, kind (update or correction) and note: {c!r}')
            h += [f'  - date: {c["date"]}', f'    kind: {c["kind"]}', f'    note: {q(one_line(c["note"], "a changelog note", slug))}']
    if doc.get('nextPost'):
        nxt = [s for s, p in posts.items() if p['_id'] == doc['nextPost'].get('_ref')]
        if not nxt:
            raise ConvertError(f'{slug}.json: nextPost points at {doc["nextPost"]!r}, which is not a post')
        h.append(f'next: {nxt[0]}')
    if doc.get('nextReadReason'):
        h.append(f'next_reason: {q(one_line(doc["nextReadReason"], "nextReadReason", slug))}')
    if doc.get('projects'):
        slugs = []
        for r in doc['projects']:
            hit = [s for s, p in projects.items() if p['_id'] == r.get('_ref')]
            if not hit:
                raise ConvertError(f'{slug}.json: the project reference {r!r} matches no document in data/projects/')
            slugs.append(hit[0])
        h.append('projects: [' + ', '.join(slugs) + ']')
    return '\n'.join(h + ['---']) + '\n'


def ref_image(ref, where, image_ok):
    m = re.match(r'^image-([0-9a-f]{40}-\d+x\d+)-(\w+)$', ref)
    if not m:
        raise ConvertError(f'{where}: not an image reference: {ref!r}')
    name = f'{m.group(1)}.{m.group(2)}'
    image_ok(name, where)
    return name


# ---------- projects (data/projects/<slug>.md, §6) and the profile (data/profile.json, §7)

# Not carried, and why (data/README.md says the same). Every other field of a document is carried or refused by name.
DROPPED = {
    'model': 'the homelab rack for a 3D viewer (hotspots, poster, real-world size): the new site has no such viewer',
}


def line(v, what, where):
    """A text of one line with nothing to trim, written exactly as it is, so a hand edit starts from the true text."""
    if not isinstance(v, str) or not v or v != v.strip() or re.search(r'[\x00-\x1f\x7f]', v):
        raise ConvertError(f'{where}: {what} must be one line of text with no space at its ends, it is {v!r}')
    return v


def paragraphs(v, what, where):
    """The same for a text of several paragraphs: lines, blank lines between paragraphs only."""
    if not isinstance(v, str) or not v or v != v.strip() or '\r' in v or re.search(r'\n\n\n|[\x00-\x09\x0b-\x1f\x7f]', v) \
            or any(not l or l != l.strip() for l in v.split('\n\n')):
        raise ConvertError(f'{where}: {what} must be paragraphs separated by one blank line, it is {v!r}')
    return v


def date(v, what, where):
    try:
        ok = isinstance(v, str) and DATE.match(v) and datetime.date.fromisoformat(v)
    except ValueError:
        ok = False
    if not ok:
        raise ConvertError(f'{where}: {what} must be a date like 2026-03-30, it is {v!r}')
    return v


def integer(v, what, where):
    if not isinstance(v, int) or isinstance(v, bool) or v < 1:
        raise ConvertError(f'{where}: {what} must be a whole number from 1, it is {v!r}')
    return v


def boolean(v, what, where):
    if not isinstance(v, bool):
        raise ConvertError(f'{where}: {what} must be true or false, it is {v!r}')
    return v


def listing(v, what, where):
    """A list that may be absent, null or empty (all three mean nothing): its items."""
    if v is None:
        return []
    if not isinstance(v, list):
        raise ConvertError(f'{where}: {what} must be a list, it is {v!r}')
    return v


def only(d, allowed, what, where, extra=BOOKKEEPING):
    """d is a record with no field but these (and Sanity's own bookkeeping, which is never carried)."""
    if not isinstance(d, dict):
        raise ConvertError(f'{where}: {what} must be a record, it is {d!r}')
    for k in d:
        if k not in allowed and k not in extra:
            raise ConvertError(f'{where}: {what} has a field `{k}` this script does not know: add it to the format first, then to this script')


def snake(k):
    return re.sub(r'[A-Z]', lambda m: '_' + m.group().lower(), k)


def flow(items):
    """`[a, b]` when every item is a plain word, else a JSON list: what content.py's header reader takes."""
    return '[' + ', '.join(items) + ']' if all(SLUG.match(t) for t in items) else json.dumps(items, ensure_ascii=False)


def ref_file(ref, where, files):
    m = re.match(r'^file-([0-9a-f]{40})-(\w+)$', ref if isinstance(ref, str) else '')
    if not m or f'{m.group(1)}.{m.group(2)}' not in files:
        raise ConvertError(f'{where}: {ref!r} is not a file in data/assets/files/')
    return f'{m.group(1)}.{m.group(2)}'


def ref_doc(r, by_id, what, where):
    only(r, {'_ref'}, what, where)
    if r.get('_ref') not in by_id:
        raise ConvertError(f'{where}: {what} points at {r.get("_ref")!r}, which is not in data/')
    return by_id[r['_ref']]


def link(l, where, ctx):
    """A link record -> {label, kind, and one of url, post, project, file}. A link to this site's own post or project, or
    to a file of the Sanity CDN that is in data/assets/files/, names it by slug or file name instead of by address."""
    posts, projects, files = ctx
    only(l, {'kind', 'label', 'url'}, 'a link', where)
    out = {'label': line(l.get('label'), 'a link label', where), 'kind': line(l.get('kind'), 'a link kind', where)}
    url = line(l.get('url'), 'a link url', where)
    for old, key, known in ((SITE + '/blog/', 'post', posts), (SITE + '/portfolio/', 'project', projects)):
        if url.startswith(old):
            m = re.fullmatch(r'([a-z0-9-]+)/?', url[len(old):])
            if not m or m.group(1) not in known:
                raise ConvertError(f'{where}: the link {url} names no post or project of that slug (or has a ? or #)')
            return dict(out, **{key: m.group(1)})
    if url.startswith(CDN):
        if url[len(CDN):] not in files:
            raise ConvertError(f'{where}: the link {url} is a file that is not in data/assets/files/')
        return dict(out, file=url[len(CDN):])
    if not re.fullmatch(r'https?://[^\s]+', url):
        raise ConvertError(f'{where}: the link {url} is not an http(s) address')
    return dict(out, url=url)


def project_header(slug, doc, ctx, image_ok, notes):
    where = f'{slug}.json'
    only(doc, PROJECT_FIELDS, 'the project', where, TOP_BOOKKEEPING)
    if doc.get('slug', {}).get('current') != slug:
        raise ConvertError(f'{where}: the slug field says {doc.get("slug")!r}, not the file name')
    h = ['---']
    put = lambda k, v: h.append(f'{k}: {v}')
    for k in ('title', 'name', 'summary'):
        put(k, q(line(doc.get(k), k, where)))
    put('order', integer(doc.get('designation'), 'designation', where))
    put('status', bare(line(doc.get('status'), 'status', where)))
    if 'statusNote' in doc:
        put('status_note', q(line(doc['statusNote'], 'statusNote', where)))
    for k in ('types', 'technologies'):
        v = [line(t, f'an item of {k}', where) for t in listing(doc.get(k), k, where)]
        if v:
            put(k, flow(v))
    if 'myRole' in doc:
        put('role', q(line(doc['myRole'], 'myRole', where)))
    for k, name in (('startDate', 'started'), ('endDate', 'ended')):
        if k in doc:
            put(name, date(doc[k], k, where))
    if 'datePrecision' in doc:
        put('date_precision', bare(line(doc['datePrecision'], 'datePrecision', where)))
    if 'datesApproximate' in doc:
        put('dates_approximate', str(boolean(doc['datesApproximate'], 'datesApproximate', where)).lower())
    if 'featured' in doc:
        put('featured', integer(doc['featured'], 'featured', where))
    if 'quiet' in doc:
        put('quiet', str(boolean(doc['quiet'], 'quiet', where)).lower())
    cover = doc.get('cover')
    if cover is not None:
        only(cover, {'alt', 'asset', 'caption'}, 'cover', where)
        only(cover.get('asset'), {'_ref'}, 'cover.asset', where)
        put('cover', ref_image(cover['asset'].get('_ref', ''), f'{where}: cover', image_ok))
        for k in ('alt', 'caption'):
            if k in cover:
                put('cover_' + k, q(line(cover[k], 'cover.' + k, where)))
    brief = doc.get('brief')
    if brief is not None:
        only(brief, {'problem', 'approach', 'outcome'}, 'brief', where, extra=())
        if 'problem' not in brief or 'approach' not in brief:
            raise ConvertError(f'{where}: brief needs a problem and an approach')
        for k in ('problem', 'approach', 'outcome'):
            if k in brief:
                put(k, q(line(brief[k], 'brief.' + k, where)))
    for k, name in (('highlights', 'highlights'), ('lessons', 'lessons'), ('next', 'next_steps')):
        v = [line(t, f'an item of {k}', where) for t in listing(doc.get(k), k, where)]
        if v:                                               # sentences: inline Markdown, so what Markdown reads is escaped
            h.append(name + ':')
            h += ['  - ' + q(line_start(esc(t))) for t in v]
    for k, fields in (('parameters', ('label', 'value')), ('results', ('metric', 'value', 'note'))):
        v = listing(doc.get(k), k, where)
        if v:
            h.append(k + ':')
        for r in v:
            only(r, fields, f'an item of {k}', where)
            for n, f in enumerate(f for f in fields if f in r):
                h.append(('  - ' if n == 0 else '    ') + f'{f}: {q(line(r[f], f"{k}.{f}", where))}')
    v = listing(doc.get('links'), 'links', where)
    if v:
        h.append('links:')
    for l in v:
        rec = link(l, f'{where}: links', ctx)
        for n, (f, x) in enumerate(rec.items()):
            h.append(('  - ' if n == 0 else '    ') + f'{f}: {bare(x) if f in ("kind", "post", "project") else q(x)}')
    if 'model' in doc:
        notes.append(f'{slug}: `model` is not carried ({DROPPED["model"]})')
    return '\n'.join(h + ['---']) + '\n'


def timestamp_date(v, what, where):
    """The date of an ISO timestamp as it is written (2026-10-26T01:47:15.863282+00:00 -> 2026-10-26)."""
    m = re.fullmatch(r'(\d{4}-\d{2}-\d{2})T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)', v if isinstance(v, str) else '')
    if not m:
        raise ConvertError(f'{where}: {what} must be a timestamp like 2026-10-26T01:47:15Z, it is {v!r}')
    return date(m.group(1), what, where)


def image_pair(img, base, where, image_ok):
    only(img, {'alt', 'asset'}, base, where)
    only(img.get('asset'), {'_ref'}, base + '.asset', where)
    out = {base: ref_image(img['asset'].get('_ref', ''), f'{where}: {base}', image_ok)}
    if 'alt' in img:
        out[base + '_alt'] = line(img['alt'], base + '.alt', where)
    return out


def profile_json(doc, ids, ctx, image_ok, notes):
    """The profile as the new file's text. ids = (post ids -> slug, project ids -> slug)."""
    where, posts_by_id, projects_by_id = 'profile.json', *ids
    files = ctx[2]
    only(doc, PROFILE_FIELDS, 'the profile', where, TOP_BOOKKEEPING)
    if doc.get('_id') != 'profile' or doc.get('_type') != 'profile':
        raise ConvertError(f'{where}: the document is not the profile singleton')
    out = {}

    def take(into, d, key, kind, at):
        if key in d:
            into[snake(key)] = {'line': line, 'text': paragraphs, 'date': date, 'int': integer, 'bool': boolean}[kind](d[key], key, at)

    def lines(v, what, at):
        return [line(t, what, at) for t in listing(v, what, at)]
    for k in ('name', 'headline', 'tagline', 'introduction'):
        take(out, doc, k, 'line', where)
    take(out, doc, 'bio', 'text', where)
    for k in ('workSummary', 'location', 'seoDescription', 'writingDescription', 'projectsIntro', 'contactIntro', 'contactInvitation'):
        take(out, doc, k, 'line', where)
    if doc.get('focusAreas'):
        out['focus_areas'] = lines(doc['focusAreas'], 'a focus area', where)
    if 'featuredPost' in doc:
        out['featured_post'] = ref_doc(doc['featuredPost'], posts_by_id, 'featuredPost', where)
    if 'resume' in doc:
        only(doc['resume'], {'asset'}, 'resume', where)
        only(doc['resume'].get('asset'), {'_ref'}, 'resume.asset', where)
        out['resume'] = ref_file(doc['resume']['asset'].get('_ref'), f'{where}: resume', files)
    if 'availability' in doc:
        a, at = doc['availability'], where + ': availability'
        only(a, {'cta', 'seeking', 'status', 'updatedAt'}, 'availability', where)
        out['availability'] = o = {}
        take(o, a, 'status', 'line', at)
        take(o, a, 'cta', 'line', at)
        seeking = []
        for r in listing(a.get('seeking'), 'seeking', at):
            only(r, {'label'}, 'an opening', at)
            seeking.append(line(r.get('label'), 'an opening label', at))
        if seeking:
            o['seeking'] = seeking                          # a record with only a label is that label
        take(o, a, 'updatedAt', 'date', at)
    if 'contactRoutes' in doc:
        out['contact_routes'] = o = {}
        for k, r in doc['contactRoutes'].items():
            at = f'{where}: contactRoutes.{k}'
            if not re.fullmatch(r'[a-z][a-z0-9-]*', k):
                raise ConvertError(f'{at}: the route name must be a valid id')
            only(r, {'title', 'prompt'}, 'a contact route', at)
            o[k] = {f: line(r.get(f), f, at) for f in ('title', 'prompt')}
    out_lists = {}
    for n, c in enumerate(listing(doc.get('credentials'), 'credentials', where)):
        at = f'{where}: credentials[{n}]'
        only(c, {'badge', 'expiresOn', 'issuedOn', 'issuer', 'lifetime', 'title', 'verificationUrl'}, 'a credential', at)
        r = {}
        for k, kind in (('title', 'line'), ('issuer', 'line'), ('issuedOn', 'date'), ('expiresOn', 'date'), ('lifetime', 'bool'), ('verificationUrl', 'line')):
            take(r, c, k, kind, at)
        if 'badge' in c:
            r.update(image_pair(c['badge'], 'badge', at, image_ok))
        out_lists.setdefault('credentials', []).append(r)
    if 'credentials' in out_lists:
        out['credentials'] = out_lists['credentials']
    if doc.get('skillGroups'):
        out['skill_groups'] = []
        for n, g in enumerate(doc['skillGroups']):
            at = f'{where}: skillGroups[{n}]'
            only(g, {'skills', 'title'}, 'a skill group', at)
            out['skill_groups'].append({'title': line(g.get('title'), 'title', at), 'skills': lines(g.get('skills'), 'a skill', at)})
    if doc.get('socialLinks'):
        out['social_links'] = []
        for n, l in enumerate(doc['socialLinks']):
            at = f'{where}: socialLinks[{n}]'
            only(l, {'label', 'url'}, 'a social link', at)
            r = {'label': line(l.get('label'), 'label', at), 'url': line(l.get('url'), 'url', at)}
            if not re.fullmatch(r'https?://[^\s]+', r['url']):
                raise ConvertError(f'{at}: {r["url"]} is not an http(s) address')
            out['social_links'].append(r)
    if 'currentCuriosities' in doc:
        out['current_curiosities'] = []
        for n, c in enumerate(listing(doc['currentCuriosities'], 'currentCuriosities', where)):
            at = f'{where}: currentCuriosities[{n}]'
            only(c, {'note', 'project', 'title'}, 'a curiosity', at)
            r = {}
            take(r, c, 'title', 'line', at)
            take(r, c, 'note', 'line', at)
            if 'project' in c:
                r['project'] = ref_doc(c['project'], projects_by_id, 'project', at)
            out['current_curiosities'].append(r)
    if 'curiositiesUpdatedAt' in doc:
        out['curiosities_updated_at'] = timestamp_date(doc['curiositiesUpdatedAt'], 'curiositiesUpdatedAt', where)
        notes.append('profile: curiositiesUpdatedAt keeps its date; the time of day is not carried')
    if 'talksAndPapers' in doc:
        out['talks_and_papers'] = []
        for n, t in enumerate(listing(doc['talksAndPapers'], 'talksAndPapers', where)):
            at = f'{where}: talksAndPapers[{n}]'
            only(t, {'abstract', 'authors', 'date', 'kind', 'links', 'project', 'title', 'venue'}, 'a talk or paper', at)
            r = {}
            for k, kind in (('title', 'line'), ('kind', 'line'), ('date', 'date'), ('authors', 'line'), ('venue', 'line'), ('abstract', 'line')):
                take(r, t, k, kind, at)
            if 'project' in t:
                r['project'] = ref_doc(t['project'], projects_by_id, 'project', at)
            if t.get('links'):
                r['links'] = [link(l, f'{at}: links[{i}]', ctx) for i, l in enumerate(t['links'])]
            out['talks_and_papers'].append(r)
    out['timeline'], ids_seen = [], set()
    for n, e in enumerate(listing(doc.get('timeline'), 'timeline', where)):
        at = f'{where}: timeline[{n}]'
        only(e, {'employment', 'endDate', 'endPrecision', 'expectedEndYear', 'highlights', 'isCurrent', 'kind', 'location', 'logo',
                 'orgShort', 'organization', 'startDate', 'startPrecision', 'summary', 'title'}, 'a timeline entry', at)
        short, start = line(e.get('orgShort'), 'orgShort', at), date(e.get('startDate'), 'startDate', at)
        tid = re.sub(r'[^a-z0-9]+', '-', short.lower()).strip('-') + '-' + start[:4]
        if tid in ids_seen or not re.fullmatch(r'[a-z][a-z0-9-]*', tid):
            raise ConvertError(f'{at}: the id {tid!r} (organization short name and start year) is taken or not a valid id')
        ids_seen.add(tid)
        r = {'id': tid}
        for k, kind in (('kind', 'line'), ('organization', 'line'), ('orgShort', 'line'), ('title', 'line'), ('employment', 'line'),
                        ('location', 'line'), ('summary', 'line'), ('startDate', 'date'), ('startPrecision', 'line'), ('endDate', 'date'),
                        ('endPrecision', 'line'), ('expectedEndYear', 'int'), ('isCurrent', 'bool')):
            take(r, e, k, kind, at)
        if e.get('highlights'):
            r['highlights'] = lines(e['highlights'], 'a highlight', at)
        if 'logo' in e:
            r.update(image_pair(e['logo'], 'logo', at, image_ok))
        out['timeline'].append(r)
    return json.dumps(out, ensure_ascii=False, indent=2) + '\n'


def convert_all():
    """-> ({path under data/: text}, [notes about what is deliberately not carried])."""
    posts, projects = load('posts'), load('projects')
    with open(os.path.join(DATA, 'assets', 'images.json'), encoding='utf-8') as f:
        known_images = {a['_id'] for a in json.load(f)}
    files = set(os.listdir(os.path.join(DATA, 'assets', 'files')))
    with open(os.path.join(DATA, 'profile', 'profile.json'), encoding='utf-8') as f:
        profile = json.load(f)

    def image_ok(name, where):
        ref = 'image-' + name.replace('.', '-')
        if ref not in known_images or not os.path.exists(os.path.join(DATA, 'assets', 'images', name)):
            raise ConvertError(f'{where}: the image {name} is not in data/assets/')
    project_slugs = {p['slug']['current'] for p in projects.values()}
    ctx = (set(posts), project_slugs, files)
    notes = []
    out = {f'posts/{s}.md': header(s, d, posts, projects, image_ok) + body(s, d, ctx, image_ok) for s, d in posts.items()}
    out.update({f'projects/{s}.md': project_header(s, d, ctx, image_ok, notes) + body(s, d, ctx, image_ok) for s, d in projects.items()})
    ids = ({d['_id']: s for s, d in posts.items()}, {d['_id']: s for s, d in projects.items()})
    out['profile.json'] = profile_json(profile, ids, ctx, image_ok, notes)
    return out, notes


def main(argv):
    force = '--force' in argv
    if [a for a in argv if a != '--force']:
        sys.exit(__doc__)
    try:
        out, notes = convert_all()
    except ConvertError as e:
        sys.exit(f'sanity_to_md: {e}')
    differ = []
    for rel_data, text in out.items():
        path = os.path.join(DATA, *rel_data.split('/'))
        rel = os.path.relpath(path, ROOT)
        old = None
        if os.path.exists(path):
            with open(path, encoding='utf-8', newline='') as f:
                old = f.read()
        if old == text:
            print(f'unchanged  {rel}')
        elif old is None or force:
            with open(path, 'w', encoding='utf-8', newline='') as f:
                f.write(text)
            print(f'{"wrote" if old is None else "replaced"}     {rel}')
        else:
            differ.append(rel)
            print(f'DIFFERS    {rel}: not overwritten (run with --force to replace it with the conversion)')
    for n in notes:
        print('note       ' + n)
    return 1 if differ else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
