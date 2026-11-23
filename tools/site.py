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
import argparse, bisect, hashlib, html, json, os, re, shutil, subprocess, sys, tempfile
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import ContentError, DATA, ROOT, SITE, image_file, load_posts, load_profile
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
        src = image_file(file)
        if not src:
            self.error(line, f'image {file} is not in data/assets/images/')
        size = display_size(src)[1]
        name = media_name(src)
        self.media[name] = (src, size)
        return f'/blog/media/{name}', size

    def link(self, url, line, check_only=False):
        """The link policy: (href, external), or None when the link is refused and only its text is written.
        check_only: raise as it would, but record no warning and no file (the parser asks before it knows the link
        will be written)."""
        warn = (lambda w: None) if check_only else self.warnings.append
        low = url.lower()
        if low.startswith(('http://', 'https://')):
            return url, True
        if low.startswith('mailto:'):
            return url, False
        if url.startswith('/') and not url.startswith('//') and '\\' not in url:   # '/\host' is '//host' to a browser
            m = re.match(r'^/portfolio(?:/([a-z0-9-]+))?/?$', url)
            if m:
                if m[1] and not os.path.isfile(os.path.join(DATA, 'projects', f'{m[1]}.json')):
                    warn(f'{self.where(line)}: no project {m[1]} in data/projects/')
                return ('/?room=projects&project=' + m[1] if m[1] else '/?room=projects'), False
            m = re.match(r'^/blog/([a-z0-9-]+)/', url)
            if m and self.slugs is not None and m[1] not in self.slugs and m[1] not in ('media', 'files'):
                warn(f'{self.where(line)}: no post {m[1]} for the link {url}')
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
            if not check_only:
                self.files[name] = os.path.join(DATA, 'assets', 'files', file)
            return '/blog/files/' + quote(name), False
        warn(f'{self.where(line)}: link to {url} is not allowed; written as its text')
        return None


class Inline:
    """The inline subset: `code`, **strong**, *emphasis*, [text](url), and \\ before * _ \\ ` [ ].
    Parsed to nodes, written as HTML or as plain text (for ids, section titles and the feed).
    Outside the subset, as plain text: a * or ` with no partner (as in CommonMark), _ (no underscore emphasis: it is
    in file and variable names), raw HTML and entities (`<b>` and `&amp;` are shown as typed), autolinks, ~~, hard
    line breaks, and a backslash before any other character. An error: an image that is not alone in its paragraph,
    a link with a title.

    The text is read left to right. A `*` that can open emphasis looks ahead for its closer and is text if there is
    none; read literally, that look-ahead reads the rest of the paragraph again for every unclosed `*`, which doubles
    the time with each one. But where a look-ahead from a position ends depends only on that position and on the
    closer it looks for ('*' or '**'), so `_ends` first works out that answer for every position, from the end of the
    text backwards, and the text is then read once. Linear, apart from a link's label, which is read again on its
    own; no recursion. tools/test_site.py compares it with the earlier recursive parser on random text."""
    def __init__(self, text, doc, line=None):
        self.s, self.doc, self.line = text, doc, line
        self.star, self.tick = _runs(text, '*'), _runs(text, '`')
        self.exact = {}                                    # n -> where the runs of exactly n backticks start
        for m in re.finditer('`+', text):
            self.exact.setdefault(len(m[0]), []).append(m.start())
        self._nl, self._close, self._links = None, None, {}

    def parse(self):
        """-> the nodes. Raises ContentError, naming the line, where the text leaves the subset."""
        return self._read(0, len(self.s), True)

    def at(self, i):
        if not self.line:
            return None
        if self._nl is None:
            self._nl = [m.start() for m in re.finditer('\n', self.s)]
        return self.line + bisect.bisect_left(self._nl, i)

    def _error(self, i, msg):
        try:
            self.doc.error(self.at(i), msg)
        except ContentError as e:
            return e

    def _read(self, start, end, links):
        """The nodes of s[start:end]: the look-ahead answers first, then one pass that follows them."""
        ends, at_once = self._ends(start, end, links)
        step = lambda i, closer: self._step(i, closer, end, links, ends, at_once, start)
        stack, i = [(None, [], [])], start                 # (closer, nodes, text not yet in nodes): one per open emphasis
        while i < end:
            closer, nodes, buf = stack[-1]
            what, j, x = step(i, closer)
            if what == 'text':
                buf.append(x); i = j
                continue
            if buf:
                nodes.append(('text', ''.join(buf))); buf.clear()
            if what == 'code':
                code = self.s[x[0]:x[1]].replace('\n', ' ')
                if len(code) > 2 and code[0] == ' ' == code[-1] and code.strip():
                    code = code[1:-1]
                nodes.append(('code', code))
            elif what == 'link':
                nodes.append(('link', self.doc.link(x[0], self.at(i)), x[1]))
            elif what == 'open':
                stack.append((x, [], []))
            elif what == 'close':
                stack.pop()
                stack[-1][1].append(('strong' if closer == '**' else 'em', nodes))
            else:
                raise x
            i = j
        assert len(stack) == 1, 'an emphasis the look-ahead said would close did not'
        nodes, buf = stack[0][1:]
        if buf:
            nodes.append(('text', ''.join(buf)))
        return nodes

    def _ends(self, start, end, links):
        """For each closer and each position p in start..end, where a look-ahead for that closer started at p ends:
        the index after its closer, None if it reaches the end unclosed, or the ContentError it meets first.
        at_once: it closes at p itself, so the emphasis would be empty (and is text). Lists indexed p - start."""
        size = end - start + 1
        ends, at_once = {'*': [None] * size, '**': [None] * size}, {'*': [False] * size, '**': [False] * size}
        later = end                                        # the next position that is not plain text
        for i in reversed([start - 1] + [m.start() for m in SPECIAL.finditer(self.s, start, end)]):
            for d in ends:                                 # plain text: the look-ahead goes on to the next special
                ends[d][i + 1 - start:later - start] = [ends[d][later - start]] * (later - i - 1)
            if i < start:
                break
            later = i
            same = None if self.s[i] == '*' else self._step(i, None, end, links, ends, at_once, start)
            for d in ends:
                what, j, x = same or self._step(i, d, end, links, ends, at_once, start)
                if what == 'close':
                    ends[d][i - start], at_once[d][i - start] = j, True
                elif what == 'error':
                    ends[d][i - start] = x
                elif what == 'open':                       # an emphasis that closes, then on from after it
                    ends[d][i - start] = ends[d][ends[x][j - start] - start]
                else:
                    ends[d][i - start] = ends[d][j - start]
        return ends, at_once

    def _step(self, i, closer, end, links, ends, at_once, base):
        """What reading at i does while looking for `closer` (None, '*' or '**') -> (what, next index, detail):
        'text' (the text), 'code' (where its content starts and ends), 'link' (url, label nodes), 'open' (an emphasis
        that closes later: its closer), 'close', or 'error' (the ContentError). Only a '*' depends on the closer."""
        s, c = self.s, self.s[i]
        if c == '\\' and i + 1 < end and s[i + 1] in ESCAPABLE:
            return 'text', i + 2, s[i + 1]
        if c == '`':
            k = min(self.tick[i], end - i)
            runs = self.exact.get(k, ())                   # the closing run has exactly as many backticks
            t = bisect.bisect_left(runs, i + k)
            if t < len(runs) and runs[t] + k <= end:
                return 'code', runs[t] + k, (i + k, runs[t])
            return 'text', i + k, '`' * k
        if c == '*':
            k = min(self.star[i], end - i)
            prev, nxt = s[i - 1] if i else ' ', s[i + k] if i + k < end else ' '
            can_close, can_open = not prev.isspace(), not nxt.isspace()
            if closer and can_close and (closer == '*' and not (k >= 2 and can_open) or closer == '**' and k >= 2):
                return 'close', i + len(closer), None
            if can_open:
                d = '**' if k >= 2 else '*'
                r = ends[d][i + len(d) - base]
                if isinstance(r, ContentError):
                    return 'error', i, r
                if r is None and closer == '*' and can_close:   # `*a**` : this run closes the outer emphasis
                    return 'close', i + 1, None
                if r is not None and not at_once[d][i + len(d) - base]:
                    return 'open', i + len(d), d
            return 'text', i + k, '*' * k
        if c == '!' and s.startswith('![', i):
            return 'error', i, self._error(i, 'an image must be alone in its paragraph: ![alt](../assets/images/<file> "caption")')
        if c == '[' and links:
            if i not in self._links:
                self._links[i] = self._link(i)
            link = self._links[i]
            if isinstance(link, ContentError):
                return 'error', i, link
            if link:
                return 'link', link[0], link[1:]
        return 'text', i + 1, c

    def _link(self, i):
        """[text](url) starting at i -> (index after, url, label nodes), None when it is not a link (then '[' is
        text), or the ContentError that reading it raises. The link policy is only asked here (Doc.link with
        check_only): whether the URL is refused or an error; the pass that builds the nodes asks again for real."""
        s, n = self.s, len(self.s)
        if self._close is None:
            self._tables()
        j = self._close[i]                                 # the matching ']', skipping escapes and code spans
        if j is None or not s.startswith('](', j):
            return None
        ts = self._depth_at.get(self._depth[j + 2] - 1, ())   # the destination: no spaces, parentheses balanced
        t = bisect.bisect_right(ts, j + 2)
        k = min(ts[t] - 1 if t < len(ts) else n, self._space[j + 2])
        url = s[j + 2:k]
        if k < n and s[k].isspace():
            if s[self._solid[k]:self._solid[k] + 1] in ('"', "'", '('):
                return self._error(i, 'links with a title are not supported: [text](url)')
            return None
        if k >= n or not url:
            return None
        try:
            label = self._read(i + 1, j, False)
            self.doc.link(url, self.at(i), check_only=True)
        except ContentError as e:
            return e
        return k + 1, url, label

    def _tables(self):
        """What _link needs, for the whole text at once: for each '[' its matching ']' (None if none), the
        parenthesis depth before each position, where each depth is reached, and the next (non-)space."""
        s, n = self.s, len(self.s)
        longer = {}                                        # n -> where the runs of n or more backticks start
        for m in re.finditer('`+', s):
            for k in range(1, len(m[0]) + 1):
                longer.setdefault(k, []).append(m.start())
        bracket = [n] * (n + 2)                            # the first [ or ] the bracket scan meets from here on
        for x in range(n - 1, -1, -1):
            c = s[x]
            if c in '[]':
                bracket[x] = x
                continue
            if c == '\\':
                y = x + 2
            elif c == '`':                                 # a code span: skip to after the first run as long
                k = self.tick[x]
                runs = longer[k]
                t = bisect.bisect_left(runs, x + k)
                y = runs[t] + k if t < len(runs) else x + k
            else:
                y = x + 1
            bracket[x] = bracket[min(y, n)]
        self._close = close = {}
        for x in range(n - 1, -1, -1):                     # from the end, so the brackets inside are matched already
            if s[x] == '[':
                z = bracket[x + 1]
                while z < n and s[z] == '[':
                    z = n if close[z] is None else bracket[close[z] + 1]
                close[x] = z if z < n else None
        self._depth, self._depth_at, d = [0] * (n + 1), {0: [0]}, 0
        for t, c in enumerate(s, 1):
            d += (c == '(') - (c == ')')
            self._depth[t] = d
            self._depth_at.setdefault(d, []).append(t)
        self._space, self._solid = [n] * (n + 1), [n] * (n + 1)
        for x in range(n - 1, -1, -1):
            sp = s[x].isspace()
            self._space[x] = x if sp else self._space[x + 1]
            self._solid[x] = self._solid[x + 1] if sp else x


SPECIAL = re.compile(r'[\\`*!\[]')                         # the characters Inline._step does more than copy


def _runs(s, ch):
    """For each position of s, how many `ch` follow from there on (0 where there is none)."""
    run = [0] * (len(s) + 1)
    for m in re.finditer(re.escape(ch) + '+', s):
        a, b = m.span()
        run[a:b] = range(b - a, 0, -1)
    return run


def to_html(nodes):
    out, stack = [], [(iter(nodes), '')]                  # a stack, not recursion: emphasis may nest deeply
    while stack:
        n = next(stack[-1][0], None)
        if n is None:
            out.append(stack.pop()[1])
        elif n[0] == 'text':
            out.append(escape(n[1]))
        elif n[0] == 'code':
            out.append(f'<code>{escape(n[1])}</code>')
        elif n[0] in ('strong', 'em'):
            out.append(f'<{n[0]}>')
            stack.append((iter(n[1]), f'</{n[0]}>'))
        elif n[1] is None:                                 # a refused link: its text only
            stack.append((iter(n[2]), ''))
        else:
            href, external = n[1]
            out.append(f'<a href="{escape(href)}"' + (' target="_blank" rel="noopener"' if external else '') + '>')
            stack.append((iter(n[2]), '</a>'))
    return ''.join(out)


def to_text(nodes):
    out, stack = [], [iter(nodes)]
    while stack:
        n = next(stack[-1], None)
        if n is None:
            stack.pop()
        elif n[0] in ('text', 'code'):
            out.append(n[1])
        else:
            stack.append(iter(n[-1]))
    return ''.join(out)


def render_inline(text, doc=None, line=None):
    """Inline Markdown -> HTML (used for paragraphs, headings, list items, captions, takeaways and notes)."""
    return to_html(Inline(text, doc or Doc(), line).parse())


def inline_text(text, doc=None):
    """Inline Markdown -> the plain text a reader sees."""
    return to_text(Inline(text, doc or Doc()).parse())


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
            nodes = Inline(m[2], doc, ln(i)).parse()
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
        w, h, _ = image_info(image_file(post['image']))
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
            src = image_file(p['image'])
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


def out_path(out, rel):
    """out/rel with links and '..' resolved, or ContentError when that is not inside out. Every file this tool
    writes, copies or removes goes through here: a name taken from the data can never put a file elsewhere."""
    root = os.path.realpath(out)
    path = os.path.realpath(os.path.join(root, rel))
    if path == root or os.path.commonpath([root, path]) != root:
        raise ContentError(f'{rel}: refused, it is not inside {out}')
    return path


def write_outputs(out, outputs, prune=('blog',)):
    """Write what changed; leave identical files alone; under each `prune` folder, remove what this run did not make.
    Every path is checked before the first file is written."""
    written = unchanged = removed = 0
    paths = {rel: out_path(out, rel) for rel in outputs}
    for rel, data in sorted(outputs.items()):
        path = paths[rel]
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
                    os.remove(os.path.join(out_path(out, os.path.dirname(rel)), f)); print('removed', rel); removed += 1
            if not os.listdir(folder) and folder != os.path.join(out, top):
                os.rmdir(out_path(out, os.path.relpath(folder, out)))
    print(f'{written} written, {unchanged} unchanged, {removed} removed')


def main(argv=None):
    ap = argparse.ArgumentParser(description='Write public/blog/ from the posts in data/posts/.')
    ap.add_argument('--posts', default=os.path.join(DATA, 'posts'), help='folder of <slug>.md posts (default data/posts)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public'), help='site folder to write into (default public)')
    a = ap.parse_args(argv)
    try:
        outputs, posts, profile, warnings = build(a.posts, a.out)
        extras = site_extras.build(posts, profile)         # before anything is written, like the pages
        for rel in extras:                                 # site_extras.write writes them: checked here, before anything
            out_path(a.out, rel)
        for rel in outputs:
            out_path(a.out, rel)
    except ContentError as e:
        sys.exit(f'site.py: {e}\nnothing was written')
    for w in warnings:
        print('warning:', w, file=sys.stderr)
    write_outputs(a.out, outputs)
    site_extras.write(a.out, extras)


if __name__ == '__main__':
    main()
