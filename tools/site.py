#!/usr/bin/env python3
"""Turn the posts (data/posts/*.md, read by tools/content.py) into pages, as docs/v1-contracts.md §3 specifies:
    python3 tools/site.py [--posts data/posts] [--out public]
writes blog/index.json, blog/index.html, blog/<slug>/index.html, blog/media/* and blog/files/* under --out. Every page
is public/index.html (the shell) with its <title>, <!--site:head--> and <!--site:page--> replaced. Everything is
rendered (and every image encoded) before a single file is written, so a bad post leaves the output as it was; files
whose content is unchanged are not touched, and anything under blog/ that this run did not produce is removed.
Images need cwebp and dwebp (libwebp) under ~/.local/opt/webp (tools/get-pack-tools.sh).

The functions are meant to be imported (render_markdown, render_inline, escape, human_date, page): the feed, the sitemap
and llms.txt are built from the same pieces. `import site` gives Python's own startup module, so load this file by path:
    spec = importlib.util.spec_from_file_location('sitegen', 'tools/site.py')
    sitegen = importlib.util.module_from_spec(spec); spec.loader.exec_module(sitegen)"""
import argparse, hashlib, html, json, os, re, shutil, subprocess, sys, tempfile
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import ContentError, DATA, ROOT, SITE, load_posts, load_profile
import site_extras                                         # feed, sitemap, llms.txt, résumé, _redirects

SHELL = os.path.join(ROOT, 'public', 'index.html')
WEBP = os.path.expanduser('~/.local/opt/webp/bin')
MAX_SIDE = 1600                                            # longest side of an image in a post body
# Bump the version when the encoding below changes: it is part of every media file's name, so caches never go stale.
ENCODING = 'v1: photos -q 82; PNG the smaller of -lossless and -q 85; EXIF orientation applied; -metadata none'
LANGS = ('bash', 'yaml', 'python', 'text')
MONTHS = ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
          'November', 'December')
ESCAPABLE = '*_\\`[]'
KEEP = object()                                            # an output whose file on disk is already current


def escape(s):
    """Text and attribute values: & < > " ' all become references."""
    return html.escape(str(s), quote=True)


def human_date(iso):
    """2026-03-30 -> '30 March 2026' (no locale: the site is in English wherever it is built)."""
    y, m, d = (int(x) for x in iso.split('-'))
    return f'{d} {MONTHS[m - 1]} {y}'


def json_ld(data):
    """A JSON-LD <script>. '<' is written as \\u003c, so no text can close the element or open a comment."""
    text = json.dumps(data, ensure_ascii=False, indent=1).replace('<', '\\u003c')
    return f'<script type="application/ld+json">\n{text}\n</script>'


# ---------------------------------------------------------------- images and files

def image_info(path):
    """(width, height, EXIF orientation) as stored in a PNG, JPEG or WebP file, read from its header."""
    with open(path, 'rb') as f:
        d = f.read()
    if d[:8] == b'\x89PNG\r\n\x1a\n':
        return int.from_bytes(d[16:20], 'big'), int.from_bytes(d[20:24], 'big'), 1
    if d[:4] == b'RIFF' and d[8:12] == b'WEBP':
        kind = d[12:16]
        if kind == b'VP8 ':
            return int.from_bytes(d[26:28], 'little') & 0x3fff, int.from_bytes(d[28:30], 'little') & 0x3fff, 1
        if kind == b'VP8L':
            b = int.from_bytes(d[21:25], 'little')
            return (b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1, 1
        if kind == b'VP8X':
            return int.from_bytes(d[24:27], 'little') + 1, int.from_bytes(d[27:30], 'little') + 1, 1
    if d[:2] == b'\xff\xd8':
        i, orientation, size = 2, 1, None
        while i + 4 <= len(d) and d[i] == 0xff:
            marker, length = d[i + 1], int.from_bytes(d[i + 2:i + 4], 'big')
            seg = d[i + 4:i + 2 + length]
            if marker == 0xe1 and seg[:6] == b'Exif\0\0':
                orientation = _exif_orientation(seg[6:]) or 1
            elif 0xc0 <= marker <= 0xcf and marker not in (0xc4, 0xc8, 0xcc):
                size = int.from_bytes(seg[3:5], 'big'), int.from_bytes(seg[1:3], 'big')
                break
            i += 2 + length
        if size:
            return size[0], size[1], orientation
    raise ContentError(f'{os.path.relpath(path, ROOT)}: not a PNG, JPEG or WebP image this tool can read')


def _exif_orientation(t):
    e = 'little' if t[:2] == b'II' else 'big'
    ifd = int.from_bytes(t[4:8], e)
    for k in range(int.from_bytes(t[ifd:ifd + 2], e)):
        entry = t[ifd + 2 + 12 * k:ifd + 14 + 12 * k]
        if int.from_bytes(entry[:2], e) == 0x112:
            return int.from_bytes(entry[8:10], e)
    return None


def display_size(path):
    """The size an image is seen at (EXIF orientation applied) and the size it is written at in /blog/media/."""
    w, h, o = image_info(path)
    if o >= 5:
        w, h = h, w
    s = min(1, MAX_SIDE / max(w, h))
    return (w, h), (max(1, round(w * s)), max(1, round(h * s))), o


def media_name(path):
    """`<source name>.<8 hex>.webp`: the hash covers the source's bytes and ENCODING, so a name never changes meaning."""
    with open(path, 'rb') as f:
        key = hashlib.sha1(f.read() + ENCODING.encode()).hexdigest()[:8]
    return f'{os.path.splitext(os.path.basename(path))[0]}.{key}.webp'


def run(*cmd):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if r.returncode:
        sys.exit('FAILED %s\n%s' % (' '.join(map(str, cmd)), r.stdout + r.stderr))


def orient_ppm(path, o):
    """Apply EXIF orientation o to a binary PPM in place (cwebp ignores the tag, so phone photos would lie on their
    side). Each colour plane is transposed and flipped with byte slices, which takes well under a second."""
    with open(path, 'rb') as f:
        d = f.read()
    m = re.match(rb'P6\s+(\d+)\s+(\d+)\s+255\s', d)
    w, h, px = int(m[1]), int(m[2]), d[m.end():]
    planes = [px[c::3] for c in range(3)]
    for op in {2: 'h', 3: 'hv', 4: 'v', 5: 't', 6: 'th', 7: 'thv', 8: 'tv'}.get(o, ''):
        if op == 't':
            planes = [b''.join(p[x::w] for x in range(w)) for p in planes]
            w, h = h, w
        elif op == 'h':
            planes = [b''.join(p[y * w:(y + 1) * w][::-1] for y in range(h)) for p in planes]
        else:
            planes = [b''.join(p[y * w:(y + 1) * w] for y in reversed(range(h))) for p in planes]
    out = bytearray(3 * w * h)
    for c in range(3):
        out[c::3] = planes[c]
    with open(path, 'wb') as f:
        f.write(b'P6\n%d %d\n255\n' % (w, h) + out)


def encode(src, size, tmp):
    """Encode one body image to WebP at `size` (its longest side at most MAX_SIDE), without metadata. Returns bytes."""
    (w, h), (ow, oh), o = display_size(src)
    out, args = os.path.join(tmp, 'out.webp'), ['-quiet', '-metadata', 'none']
    if o != 1:                                             # scale losslessly, turn the pixels, then encode once
        sw, sh = (oh, ow) if o >= 5 else (ow, oh)
        run(f'{WEBP}/cwebp', *args, '-lossless', '-z', '0', '-resize', sw, sh, src, '-o', f'{tmp}/scaled.webp')
        run(f'{WEBP}/dwebp', '-quiet', '-ppm', f'{tmp}/scaled.webp', '-o', f'{tmp}/turned.ppm')
        orient_ppm(f'{tmp}/turned.ppm', o)
        src = f'{tmp}/turned.ppm'
    elif (ow, oh) != (w, h):
        args += ['-resize', ow, oh]
    if src.endswith('.png'):                               # screenshots and diagrams: lossless is often the smaller
        run(f'{WEBP}/cwebp', *args, '-lossless', src, '-o', f'{tmp}/lossless.webp')
        run(f'{WEBP}/cwebp', *args, '-q', 85, src, '-o', out)
        if os.path.getsize(f'{tmp}/lossless.webp') <= os.path.getsize(out):
            os.replace(f'{tmp}/lossless.webp', out)
    else:
        run(f'{WEBP}/cwebp', *args, '-q', 82, src, '-o', out)
    if image_info(out)[:2] != size:
        sys.exit(f'{src}: encoded at {image_info(out)[:2]}, expected {size}')
    with open(out, 'rb') as f:
        return f.read()


def file_names():
    """data/assets/files/<asset>.<ext> -> the name it was uploaded under (data/assets/files.json)."""
    with open(os.path.join(DATA, 'assets', 'files.json'), encoding='utf-8') as f:
        return {f"{a['assetId']}.{a['extension']}": a['originalFilename'] for a in json.load(f)}


# ---------------------------------------------------------------- Markdown

class Doc:
    """What rendering one post collects: ids in use, sections (h2, h3), the images and files it needs, warnings.
    `taken` are ids already in the page around the article (the shell's), which headings must not repeat."""
    def __init__(self, name='post', first_line=1, taken=(), slugs=None):
        self.name, self.first_line, self.ids, self.slugs = name, first_line, set(taken), slugs
        self.sections, self.media, self.files, self.warnings = [], {}, {}, []
        self._files = None

    def where(self, line):
        return f'{self.name}, line {line}' if line else self.name

    def error(self, line, msg):
        raise ContentError(f'{self.where(line)}: {msg}')

    def unique_id(self, text):
        base = re.sub(r'[^a-z0-9 -]', '', text.lower()).replace(' ', '-') or 'section'
        new, n = base, 1
        while new in self.ids:
            n += 1
            new = f'{base}-{n}'
        self.ids.add(new)
        return new

    def image(self, file, line):
        """A body image -> (URL, width, height) of its WebP in /blog/media/."""
        src = os.path.join(DATA, 'assets', 'images', file)
        if '/' in file or not os.path.isfile(src):
            self.error(line, f'image {file} is not in data/assets/images/')
        size = display_size(src)[1]
        name = media_name(src)
        self.media[name] = (src, size)
        return f'/blog/media/{name}', size

    def link(self, url, line):
        """The link policy: (href, external), or None when the link is refused and only its text is written."""
        low = url.lower()
        if low.startswith(('http://', 'https://')):
            return url, True
        if low.startswith('mailto:'):
            return url, False
        if url.startswith('/') and not url.startswith('//') and '\\' not in url:   # '/\host' is '//host' to a browser
            m = re.match(r'^/portfolio(?:/([a-z0-9-]+))?/?$', url)
            if m:
                if m[1] and not os.path.isfile(os.path.join(DATA, 'projects', f'{m[1]}.json')):
                    self.warnings.append(f'{self.where(line)}: no project {m[1]} in data/projects/')
                return ('/?room=projects&project=' + m[1] if m[1] else '/?room=projects'), False
            m = re.match(r'^/blog/([a-z0-9-]+)/', url)
            if m and self.slugs is not None and m[1] not in self.slugs and m[1] not in ('media', 'files'):
                self.warnings.append(f'{self.where(line)}: no post {m[1]} for the link {url}')
            return url, False
        if url.startswith('../assets/files/'):
            file = url[len('../assets/files/'):]
            if self._files is None:
                self._files = file_names()
            if file not in self._files or not os.path.isfile(os.path.join(DATA, 'assets', 'files', file)):
                self.error(line, f'file {file} is not in data/assets/files/ (and files.json)')
            name = self._files[file]
            if '/' in name or '\\' in name or name.startswith('.'):
                self.error(line, f'file {file} has an unusable original name: {name}')
            self.files[name] = os.path.join(DATA, 'assets', 'files', file)
            return '/blog/files/' + quote(name), False
        self.warnings.append(f'{self.where(line)}: link to {url} is not allowed; written as its text')
        return None


class Inline:
    """The inline subset: `code`, **strong**, *emphasis*, [text](url), and \\ before * _ \\ ` [ ].
    Parsed to nodes, written as HTML or as plain text (for ids, section titles and the feed).
    Outside the subset, as plain text: a * or ` with no partner (as in CommonMark), _ (no underscore emphasis: it is
    in file and variable names), raw HTML and entities (`<b>` and `&amp;` are shown as typed), autolinks, ~~, hard
    line breaks, and a backslash before any other character. An error: an image that is not alone in its paragraph,
    a link with a title."""
    def __init__(self, text, doc, line=None, links=True):
        self.s, self.doc, self.line, self.links = text, doc, line, links

    def at(self, i):
        return self.line + self.s.count('\n', 0, i) if self.line else None

    def parse(self, i=0, closer=None, end=None):
        """-> (nodes, index after, closed). Stops at `closer` ('*' or '**') when one can close here."""
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
                while True:                                # the closing run has exactly as many backticks
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
                    if not closed and closer == '*' and can_close:   # `*a**` : this run closes the outer emphasis
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
        """[text](url) starting at i -> (node, index after), or None when it is not a link (then '[' is text)."""
        s, depth, j = self.s, 0, i
        while j < end:                                     # the matching ']', skipping escapes and code spans
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
        k, depth = j + 2, 0                                # the destination: no spaces, parentheses balanced
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
        label = Inline(s[:j], self.doc, self.line, links=False).parse(i + 1, None, j)[0]
        target = self.doc.link(url, self.at(i))
        return ('link', target, label), k + 1


def to_html(nodes):
    out = []
    for n in nodes:
        if n[0] == 'text':
            out.append(escape(n[1]))
        elif n[0] == 'code':
            out.append(f'<code>{escape(n[1])}</code>')
        elif n[0] in ('strong', 'em'):
            out.append(f'<{n[0]}>{to_html(n[1])}</{n[0]}>')
        elif n[1] is None:                                 # a refused link: its text only
            out.append(to_html(n[2]))
        else:
            (href, external), label = n[1], to_html(n[2])
            out.append(f'<a href="{escape(href)}"' + (' target="_blank" rel="noopener"' if external else '') + f'>{label}</a>')
    return ''.join(out)


def to_text(nodes):
    return ''.join(n[1] if n[0] in ('text', 'code') else to_text(n[-1]) for n in nodes)


def render_inline(text, doc=None, line=None):
    """Inline Markdown -> HTML (used for paragraphs, headings, list items, captions, takeaways and notes)."""
    return to_html(Inline(text, doc or Doc(), line).parse()[0])


def inline_text(text, doc=None):
    """Inline Markdown -> the plain text a reader sees."""
    return to_text(Inline(text, doc or Doc()).parse()[0])


FENCE = re.compile(r'^```([^`\s]*)[ \t]*$')
HEADING = re.compile(r'^(#{1,6})(?:[ \t]+(.*?))?[ \t]*$')
ITEM = re.compile(r'^( *)(-|\d{1,9}\.)(?:[ \t]+(.*))?$')
RULE = re.compile(r'^ {0,3}(?:([-*_])[ \t]*(?:\1[ \t]*)+|=+[ \t]*)$')   # ---, ***, ___, ===, - : rules, setext underlines
IMAGE = re.compile(r'^!\[((?:[^\]\\]|\\.)*)\]\(([^\s)]+)(?:[ \t]+"((?:[^"\\]|\\.)*)")?\)[ \t]*$')


def render_markdown(md, name='post', first_line=1, doc=None):
    """A post's body -> (HTML of its blocks, the Doc with its sections, images, files and warnings).
    Blocks: ## and ### headings, paragraphs, - and 1. lists (one nested level, 4 spaces), > quotations of paragraphs,
    ``` fences with a language, and an image alone in its paragraph. Anything else that Markdown would turn into a
    block (other headings, rules and underlined headings, tables, indented code, * and + bullets, 1) lists, reference
    definitions, ~~~ fences) is an error naming the line, so the page never differs silently from the GitHub preview.
    Raw HTML is text: `<div>` is shown as typed."""
    doc = doc or Doc(name, first_line)
    lines, out, i = md.replace('\r\n', '\n').split('\n'), [], 0
    ln = lambda k: doc.first_line + k
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
        elif line.lstrip().startswith(('```', '~~~')):
            m = FENCE.match(line)
            if not m or not m[1]:
                doc.error(ln(i), 'a code block starts at the line\'s beginning with ``` and a language: ' + ', '.join(LANGS))
            if m[1] not in LANGS:
                doc.error(ln(i), f'unknown code language {m[1]}; use one of ' + ', '.join(LANGS))
            j = i + 1
            while j < len(lines) and not re.match(r'^```[ \t]*$', lines[j]):
                j += 1
            if j == len(lines):
                doc.error(ln(i), 'the code block is not closed with ```')
            out.append(f'<pre data-lang="{m[1]}"><code>{escape(chr(10).join(lines[i + 1:j]))}</code></pre>')
            i = j + 1
        elif (m := HEADING.match(line)):
            if len(m[1]) not in (2, 3):
                doc.error(ln(i), 'headings are ## and ### (the title is the page\'s only h1)')
            if not m[2]:
                doc.error(ln(i), 'empty heading')
            nodes = Inline(m[2], doc, ln(i)).parse()[0]
            text = to_text(nodes)
            hid = doc.unique_id(text)
            doc.sections.append({'id': hid, 'title': text, 'level': len(m[1])})
            out.append(f'<h{len(m[1])} id="{hid}">{to_html(nodes)}</h{len(m[1])}>')
            i += 1
        elif RULE.match(line):
            doc.error(ln(i), 'horizontal rules and underlined (---, ===) headings are not supported')
        elif line.startswith('>'):
            i = _quote(lines, i, doc, out)
        elif (m := ITEM.match(line)) and not m[1]:
            i = _list(lines, i, doc, out)
        elif m and len(m[1]) < 4:
            doc.error(ln(i), 'a list starts at the beginning of the line')
        elif re.match(r'^ {0,3}([*+][ \t]|\d{1,9}\)[ \t])', line):
            doc.error(ln(i), 'list items start with "- " or "1. "')
        elif re.match(r'^ *\|', line):
            doc.error(ln(i), 'tables are not supported')
        elif re.match(r'^ {0,3}\[[^\]]+\]:', line):
            doc.error(ln(i), 'reference links are not supported: write [text](url)')
        elif line.startswith(('    ', '\t')):
            doc.error(ln(i), 'indented code is not supported: fence it with ``` and a language')
        else:
            j = i + 1
            while j < len(lines) and lines[j].strip() and not _interrupts(lines[j]):
                j += 1
            para = '\n'.join(x.strip() for x in lines[i:j])
            if para.startswith('!['):
                out.append(_figure(para, doc, ln(i)))
            else:
                out.append(f'<p>{render_inline(para, doc, ln(i))}</p>')
            i = j
    return '\n'.join(out), doc


def _interrupts(line):
    """Does this line end a paragraph (CommonMark: a fence, heading, rule, quotation, bullet or a list from 1)?"""
    m = ITEM.match(line)
    return (line.startswith(('```', '~~~', '>')) or bool(HEADING.match(line)) or bool(RULE.match(line))
            or bool(m and not m[1] and m[3] and m[2] in ('-', '1.')))


def _figure(para, doc, line):
    m = IMAGE.match(para)
    if not m:
        doc.error(line, 'an image is one line alone: ![alt](../assets/images/<file> "caption")')
    if not m[2].startswith('../assets/images/'):
        doc.error(line, 'an image\'s path is ../assets/images/<file>')
    src, (w, h) = doc.image(m[2][len('../assets/images/'):], line)
    alt = re.sub(r'\\(.)', r'\1', m[1])
    cap = f'<figcaption>{render_inline(m[3].replace('\\"', '"'), doc, line)}</figcaption>' if m[3] else ''
    return (f'<figure><img src="{escape(src)}" width="{w}" height="{h}" alt="{escape(alt)}" loading="lazy" '
            f'decoding="async">{cap}</figure>')


def _quote(lines, i, doc, out):
    """> lines: paragraphs only (a line holding just > separates them)."""
    paras, cur, start = [], [], i
    while i < len(lines) and lines[i].startswith('>'):
        text = lines[i][2:] if lines[i].startswith('> ') else lines[i][1:]
        if not text.strip():
            if cur:
                paras.append(cur)
            cur = []
        elif text.startswith(('>', '```', '~~~', '    ', '![')) or HEADING.match(text) or ITEM.match(text) or RULE.match(text):
            doc.error(doc.first_line + i, 'a quotation holds paragraphs only')
        else:
            cur.append((doc.first_line + i, text.strip()))
        i += 1
    if cur:
        paras.append(cur)
    if i < len(lines) and lines[i].strip():
        doc.error(doc.first_line + i, 'start every line of a quotation with >, and end it with a blank line')
    body = '\n'.join(f'<p>{render_inline(chr(10).join(t for _, t in p), doc, p[0][0])}</p>' for p in paras)
    out.append(f'<blockquote>{body}</blockquote>')
    return i


def _list(lines, i, doc, out):
    """- and 1. lists with one nested level, indented 4 spaces. Each item is one paragraph; lines that follow it
    without a marker continue it. Blank lines between items are allowed and change nothing (no loose lists)."""
    def kind(m):
        return 'ul' if m[2] == '-' else 'ol'
    top, n = [], len(lines)                               # top: [line, text, [nested lists]]; a list: (kind, start, items)
    first = ITEM.match(lines[i])
    tkind, start = kind(first), first[2]
    last = None                                            # the item that continuation lines belong to
    while i < n:
        line = lines[i]
        if not line.strip():
            j = i
            while j < n and not lines[j].strip():
                j += 1
            m = ITEM.match(lines[j]) if j < n else None
            if m and (m[1] == '    ' or (m[1] == '' and kind(m) == tkind)):
                i = j; continue
            if j < n and lines[j].startswith((' ', '\t')):
                doc.error(doc.first_line + j, 'a list item is one paragraph; nest items with 4 spaces and "- " or "1. "')
            break
        m = ITEM.match(line)
        if m and m[1] not in ('', '    '):
            doc.error(doc.first_line + i, 'nest a list item by exactly 4 spaces; only one nested level is supported')
        if m and not m[3]:
            doc.error(doc.first_line + i, 'empty list item')
        if m and m[1] == '':
            if kind(m) != tkind:
                break
            last = [doc.first_line + i, [m[3]], []]
            top.append(last)
        elif m:
            item = [doc.first_line + i, [m[3]], []]
            nested = top[-1][2]
            if not nested or nested[-1][0] != kind(m):
                nested.append((kind(m), m[2], []))
            nested[-1][2].append(item)
            last = item
        elif line.lstrip().startswith(('```', '~~~')) and line.startswith((' ', '\t')):
            doc.error(doc.first_line + i, 'code in a list item is not supported')
        elif not line.startswith((' ', '\t')) and _interrupts(line):
            break
        else:
            last[1].append(line.strip())
        i += 1
    def ol_start(kind_, first_marker):
        s = int(first_marker[:-1]) if kind_ == 'ol' else 1
        return f' start="{s}"' if s != 1 else ''
    def items(its):
        return '\n'.join('<li>' + render_inline('\n'.join(t), doc, ln) +
                         ''.join(f'<{k}{ol_start(k, st)}>\n{items(sub)}\n</{k}>' for k, st, sub in nested) + '</li>'
                         for ln, t, nested in its)
    out.append(f'<{tkind}{ol_start(tkind, start)}>\n{items(top)}\n</{tkind}>')
    return i


# ---------------------------------------------------------------- pages

def page(shell, title, head, main):
    """The shell with exactly three changes: the <title> text, <!--site:head--> and <!--site:page-->."""
    for mark in ('<title>', '<!--site:head-->', '<!--site:page-->'):
        if shell.count(mark) != 1:
            sys.exit(f'public/index.html must contain {mark} exactly once')
    a = shell.index('<title>') + len('<title>')
    b = shell.index('</title>', a)
    shell = shell[:a] + escape(title) + shell[b:]
    return shell.replace('<!--site:head-->', head).replace('<!--site:page-->', main)


def meta(prop, content, attr='property'):
    return f'<meta {attr}="{prop}" content="{escape(content)}">'


def rss_link(profile):
    return f'<link rel="alternate" type="application/rss+xml" title="{escape(profile["name"])} — Writing" href="/feed.xml">'


def post_page(shell, post, doc, body, profile, posts_by_slug):
    url, name = f'{SITE}/blog/{post["slug"]}/', profile['name']
    first, last = post['published'], post['revised'] or post['published']
    card = None
    if post['image']:
        w, h, _ = image_info(os.path.join(DATA, 'assets', 'images', post['image']))
        card = f'{SITE}/blog/media/{quote(post["image"])}', w, h
    head = [meta('description', post['description'], 'name'), f'<link rel="canonical" href="{escape(url)}">',
            meta('og:type', 'article'), meta('og:site_name', name), meta('og:title', post['title']),
            meta('og:description', post['description']), meta('og:url', url)]
    if card:
        head += [meta('og:image', card[0]), meta('og:image:width', card[1]), meta('og:image:height', card[2]),
                 meta('og:image:alt', post['image_alt'] or post['title'])]
    head += [meta('article:published_time', first)]
    if post['revised']:
        head += [meta('article:modified_time', post['revised'])]
    head += [meta('article:tag', t) for t in post['tags']]
    head += [meta('twitter:card', 'summary_large_image' if card else 'summary', 'name'), rss_link(profile)]
    ld = {'@context': 'https://schema.org', '@type': 'BlogPosting', 'headline': post['title'],
          'description': post['description'], 'datePublished': first, 'dateModified': last,
          'author': {'@type': 'Person', 'name': name, 'url': f'{SITE}/'}, 'url': url,
          'mainEntityOfPage': {'@type': 'WebPage', '@id': url}, 'wordCount': post['words'], 'keywords': ', '.join(post['tags'])}
    if card:
        ld['image'] = card[0]
    head.append(json_ld(ld))

    revised = (f' · <span class="post-revised">Revised <time datetime="{post["revised"]}">{human_date(post["revised"])}</time></span>'
               if post['revised'] else '')
    parts = ['<main id="page">', f'<article class="post" data-slug="{escape(post["slug"])}">', '  <header>',
             f'    <p class="post-meta"><time datetime="{first}">{human_date(first)}</time> · '
             f'<span class="post-minutes">{post["minutes"]} min read</span>{revised}</p>',
             f'    <h1>{escape(post["title"])}</h1>', f'    <p class="post-lede">{escape(post["description"])}</p>']
    if post['tags']:
        parts.append('    <ul class="post-tags">' + ''.join(f'<li>{escape(t)}</li>' for t in post['tags']) + '</ul>')
    parts.append('  </header>')
    if post['takeaways']:
        tk = Doc(f'{doc.name}, takeaways', None, slugs=doc.slugs)
        lis = ''.join(f'<li>{render_inline(t, tk)}</li>' for t in post['takeaways'])
        doc.files.update(tk.files); doc.warnings += tk.warnings
        parts.append(f'  <section class="post-takeaways"><h2>Takeaways</h2><ul>{lis}</ul></section>')
    parts += ['  <div class="post-body">', body, '  </div>']
    foot, nd = [], Doc(f'{doc.name}, header', None, slugs=doc.slugs)
    if post['changelog']:
        lis = ''.join(f'<li><time datetime="{c["date"]}">{human_date(c["date"])}</time> <b>{c["kind"].capitalize()}</b> '
                      f'{render_inline(c["note"], nd)}</li>' for c in post['changelog'])
        foot.append(f'    <section class="post-changelog"><h2>Changes</h2><ul>{lis}</ul></section>')
    if post['next']:
        reason = f' {render_inline(post["next_reason"], nd)}' if post['next_reason'] else ''
        foot.append(f'    <p class="post-next"><a href="/blog/{escape(post["next"])}/"><span>Next</span> '
                    f'{escape(posts_by_slug[post["next"]]["title"])}</a>{reason}</p>')
    doc.files.update(nd.files); doc.warnings += nd.warnings
    if foot:
        parts += ['  <footer>', *foot, '  </footer>']
    parts += ['</article>', '</main>']
    return page(shell, f'{post["title"]} — {name}', '\n'.join(head), '\n'.join(parts))


def list_page(shell, entries, profile):
    name, url, about = profile['name'], f'{SITE}/blog/', profile.get('writingDescription', '')
    title = f'Writing — {name}'
    ld = {'@context': 'https://schema.org', '@type': 'Blog', 'name': title, 'description': about, 'url': url,
          'author': {'@type': 'Person', 'name': name, 'url': f'{SITE}/'},
          'blogPost': [{'@type': 'BlogPosting', 'headline': e['title'], 'description': e['description'], 'url': SITE + e['url'],
                        'datePublished': e['published'], 'dateModified': e['revised'] or e['published']} for e in entries]}
    head = [meta('description', about, 'name'), f'<link rel="canonical" href="{url}">', meta('og:type', 'website'),
            meta('og:site_name', name), meta('og:title', title), meta('og:description', about), meta('og:url', url),
            meta('twitter:card', 'summary', 'name'), rss_link(profile), json_ld(ld)]
    lis = [f'    <li><a href="{escape(e["url"])}">{escape(e["title"])}</a> <p>{escape(e["description"])}</p>\n'
           f'        <p class="post-meta"><time datetime="{e["published"]}">{e["date"]}</time> · {e["minutes"]} min read</p></li>'
           for e in entries]
    main = '\n'.join(['<main id="page">', '<section class="post-list">', '  <h1>Writing</h1>',
                      f'  <p class="post-lede">{escape(about)}</p>', '  <ol>', *lis, '  </ol>', '</section>', '</main>'])
    return page(shell, title, '\n'.join(head), main)


def body_start(path):
    """The file line where the body starts (content.py strips the blank lines after the header)."""
    with open(path, encoding='utf-8') as f:
        lines = f.read().replace('\r\n', '\n').split('\n')
    k = lines.index('---', 1) + 1
    while k < len(lines) and lines[k] == '':
        k += 1
    return k + 1


def build(posts_dir, out):
    """Render everything into memory: {path under out: bytes, or KEEP when the file there is already right}.
    Raises ContentError (or exits) before anything is written."""
    with open(SHELL, encoding='utf-8') as f:
        shell = f.read()
    taken = set(re.findall(r'\bid="([^"]+)"', shell)) | {'page'}
    posts, profile = load_posts(posts_dir), load_profile()
    by_slug = {p['slug']: p for p in posts}
    outputs, entries, media, warnings = {}, [], {}, []
    for p in posts:
        path = os.path.join(posts_dir, p['slug'] + '.md')
        doc = Doc(os.path.relpath(path), body_start(path), taken, set(by_slug))
        body, doc = render_markdown(p['body'], doc=doc)
        outputs[f'blog/{p["slug"]}/index.html'] = post_page(shell, p, doc, body, profile, by_slug).encode()
        if p['image']:
            src = os.path.join(DATA, 'assets', 'images', p['image'])
            if image_info(src)[0:2] != (1200, 630) or not p['image'].endswith(('.png', '.jpg')):
                warnings.append(f'{doc.name}: the social card {p["image"]} should be a 1200x630 PNG')
            with open(src, 'rb') as f:
                outputs[f'blog/media/{p["image"]}'] = f.read()
        for name, src in doc.files.items():
            with open(src, 'rb') as f:
                data = f.read()
            if outputs.get(f'blog/files/{name}', data) != data:
                raise ContentError(f'{doc.name}: two different files are both called {name}')
            outputs[f'blog/files/{name}'] = data
        media.update(doc.media)
        warnings += doc.warnings
        entries.append({'slug': p['slug'], 'url': f'/blog/{p["slug"]}/', 'title': p['title'], 'description': p['description'],
                        'published': p['published'], 'revised': p['revised'], 'date': human_date(p['published']),
                        'minutes': p['minutes'], 'words': p['words'], 'tags': p['tags'], 'sections': doc.sections})
    v = hashlib.sha256(json.dumps(entries, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:8]
    outputs['blog/index.json'] = (json.dumps({'v': v, 'posts': entries}, ensure_ascii=False, indent=1) + '\n').encode()
    outputs['blog/index.html'] = list_page(shell, entries, profile).encode()
    with tempfile.TemporaryDirectory(prefix='site-') as tmp:  # images last: they are slow, and named by content
        for name, (src, size) in sorted(media.items()):
            have = os.path.join(out, 'blog', 'media', name)
            if os.path.isfile(have) and image_info(have)[:2] == size:
                outputs[f'blog/media/{name}'] = KEEP
            else:
                print(f'encoding {os.path.relpath(src, ROOT)} at {size[0]}x{size[1]}', flush=True)
                outputs[f'blog/media/{name}'] = encode(src, size, tmp)
    return outputs, posts, profile, warnings


def write_outputs(out, outputs, prune=('blog',)):
    """Write what changed; leave identical files alone; under each `prune` folder, remove what this run did not make."""
    written = unchanged = removed = 0
    for rel, data in sorted(outputs.items()):
        path = os.path.join(out, rel)
        if data is KEEP:
            unchanged += 1; continue
        try:
            with open(path, 'rb') as f:
                if f.read() == data:
                    unchanged += 1; continue
        except FileNotFoundError:
            pass
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path + '.tmp', 'wb') as f:
            f.write(data)
        os.replace(path + '.tmp', path)
        print('wrote', rel); written += 1
    for top in prune:
        for folder, dirs, files in os.walk(os.path.join(out, top), topdown=False):
            for f in sorted(files):
                rel = os.path.relpath(os.path.join(folder, f), out).replace(os.sep, '/')
                if rel not in outputs:
                    os.remove(os.path.join(folder, f)); print('removed', rel); removed += 1
            if not os.listdir(folder) and folder != os.path.join(out, top):
                os.rmdir(folder)
    print(f'{written} written, {unchanged} unchanged, {removed} removed')


def main(argv=None):
    ap = argparse.ArgumentParser(description='Write public/blog/ from the posts in data/posts/.')
    ap.add_argument('--posts', default=os.path.join(DATA, 'posts'), help='folder of <slug>.md posts (default data/posts)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public'), help='site folder to write into (default public)')
    a = ap.parse_args(argv)
    try:
        outputs, posts, profile, warnings = build(a.posts, a.out)
        extras = site_extras.build(posts, profile)         # before anything is written, like the pages
    except ContentError as e:
        sys.exit(f'site.py: {e}\nnothing was written')
    for w in warnings:
        print('warning:', w, file=sys.stderr)
    write_outputs(a.out, outputs)
    site_extras.write(a.out, extras)


if __name__ == '__main__':
    main()
