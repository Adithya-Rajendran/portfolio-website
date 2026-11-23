#!/usr/bin/env python3
"""Sanity post (data/posts/<slug>.json, Portable Text) -> the post's Markdown source (data/posts/<slug>.md).
The format is docs/v1-contracts.md §2; tools/content.py reads it.

    python3 tools/sanity_to_md.py            # write the .md files that do not exist; list the ones that differ
    python3 tools/sanity_to_md.py --force    # overwrite those too (the .md files are edited by hand after the conversion)

Anything in a post that this script does not know (a block type, style, mark, list level, a document field) stops it
with an error naming the post and the block: nothing is dropped silently. tools/test_sanity_to_md.py checks the output.
"""
import glob, json, os, re, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DATA = os.path.join(ROOT, 'data')
SITE = 'https://adithya-rajendran.com'
CDN = 'https://cdn.sanity.io/files/ppk2h9tb/production/'
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
SLUG = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
DOC_FIELDS = {'body', 'changelog', 'description', 'nextPost', 'nextReadReason', 'projects', 'publishedAt', 'revisedAt',
              'slug', 'socialImage', 'tags', 'takeaways', 'title'}
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


def convert_all():
    posts, projects = load('posts'), load('projects')
    with open(os.path.join(DATA, 'assets', 'images.json'), encoding='utf-8') as f:
        known_images = {a['_id'] for a in json.load(f)}
    files = set(os.listdir(os.path.join(DATA, 'assets', 'files')))

    def image_ok(name, where):
        ref = 'image-' + name.replace('.', '-')
        if ref not in known_images or not os.path.exists(os.path.join(DATA, 'assets', 'images', name)):
            raise ConvertError(f'{where}: the image {name} is not in data/assets/')
    ctx = (set(posts), {p['slug']['current'] for p in projects.values()}, files)
    return {s: header(s, d, posts, projects, image_ok) + body(s, d, ctx, image_ok) for s, d in posts.items()}


def main(argv):
    force = '--force' in argv
    if [a for a in argv if a != '--force']:
        sys.exit(__doc__)
    try:
        out = convert_all()
    except ConvertError as e:
        sys.exit(f'sanity_to_md: {e}')
    differ = []
    for slug, text in out.items():
        path = os.path.join(DATA, 'posts', slug + '.md')
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
    return 1 if differ else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
