#!/usr/bin/env python3
# Page builder that turns the content in data/ into pages
import argparse, bisect, copy, hashlib, html, json, os, re, shutil, subprocess, sys, tempfile
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import ContentError, DATA, ROOT, SITE, image_file, load_posts, load_profile, load_projects
import site_extras

SHELL = os.path.join(ROOT, 'index.html')
WEBP = os.path.expanduser('~/.local/opt/webp/bin')
MAX_SIDE = 1600
ENCODING = 'v1: photos -q 82; PNG the smaller of -lossless and -q 85; EXIF orientation applied; -metadata none'
LANGS = ('bash', 'yaml', 'python', 'text')
MONTHS = ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
          'November', 'December')
ESCAPABLE = '*_\\`[]'
RUNTIME_IDS = ('reader', 'stepin', 'enter', 'comms', 'cue')
KEEP = object()


def escape(s):
    return html.escape(str(s), quote=True)


def human_date(iso):
    y, m, d = (int(x) for x in iso.split('-'))
    return f'{d} {MONTHS[m - 1]} {y}'


def json_ld(data):
    text = json.dumps(data, ensure_ascii=False, indent=1).replace('<', '\\u003c')
    return f'<script type="application/ld+json">\n{text}\n</script>'


def image_info(path):
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
    w, h, o = image_info(path)
    if o >= 5:
        w, h = h, w
    s = min(1, MAX_SIDE / max(w, h))
    return (w, h), (max(1, round(w * s)), max(1, round(h * s))), o


def media_name(path):
    with open(path, 'rb') as f:
        key = hashlib.sha1(f.read() + ENCODING.encode()).hexdigest()[:8]
    return f'{os.path.splitext(os.path.basename(path))[0]}.{key}.webp'


def run(*cmd):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if r.returncode:
        sys.exit('FAILED %s\n%s' % (' '.join(map(str, cmd)), r.stdout + r.stderr))


def orient_ppm(path, o):
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
    (w, h), (ow, oh), o = display_size(src)
    out, args = os.path.join(tmp, 'out.webp'), ['-quiet', '-metadata', 'none']
    if o != 1:
        sw, sh = (oh, ow) if o >= 5 else (ow, oh)
        run(f'{WEBP}/cwebp', *args, '-lossless', '-z', '0', '-resize', sw, sh, src, '-o', f'{tmp}/scaled.webp')
        run(f'{WEBP}/dwebp', '-quiet', '-ppm', f'{tmp}/scaled.webp', '-o', f'{tmp}/turned.ppm')
        orient_ppm(f'{tmp}/turned.ppm', o)
        src = f'{tmp}/turned.ppm'
    elif (ow, oh) != (w, h):
        args += ['-resize', ow, oh]
    if src.endswith('.png'):
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
    with open(os.path.join(DATA, 'assets', 'files.json'), encoding='utf-8') as f:
        return {f"{a['assetId']}.{a['extension']}": a['originalFilename'] for a in json.load(f)}


class Doc:
    def __init__(self, name='post', first_line=1, taken=(), slugs=None, media='/blog/media', projects=None):
        self.name, self.first_line, self.ids, self.slugs = name, first_line, set(taken), slugs
        self.media_url, self.projects = media, projects
        self.sections, self.media, self.files, self.warnings = [], {}, {}, []
        self._files = None

    def part(self, what):
        d = copy.copy(self)
        d.name, d.first_line = f'{self.name}, {what}', None
        return d

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
        src = image_file(file)
        if not src:
            self.error(line, f'image {file} is not in data/assets/images/')
        size = display_size(src)[1]
        url = f'{self.media_url}/{media_name(src)}'
        self.media[url[1:]] = (src, size)
        return url, size

    def link(self, url, line, check_only=False):
        warn = (lambda w: None) if check_only else self.warnings.append
        low = url.lower()
        if low.startswith(('http://', 'https://')):
            return url, True
        if low.startswith('mailto:'):
            return url, False
        if url.startswith('/') and not url.startswith('//') and '\\' not in url:
            m = re.match(r'^/portfolio(?:/([a-z0-9-]+))?/?$', url)
            if m:
                if m[1] and not (m[1] in self.projects if self.projects is not None
                                 else os.path.isfile(os.path.join(DATA, 'projects', f'{m[1]}.md'))):
                    warn(f'{self.where(line)}: no project {m[1]} in data/projects/')
                return (f'/portfolio/{m[1]}/' if m[1] else '/portfolio/'), False
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

    def __init__(self, text, doc, line=None):
        self.s, self.doc, self.line = text, doc, line
        self.star, self.tick = _runs(text, '*'), _runs(text, '`')
        self.exact = {}
        for m in re.finditer('`+', text):
            self.exact.setdefault(len(m[0]), []).append(m.start())
        self._nl, self._close, self._links = None, None, {}

    def parse(self):
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
        ends, at_once = self._ends(start, end, links)
        step = lambda i, closer: self._step(i, closer, end, links, ends, at_once, start)
        stack, i = [(None, [], [])], start
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
        size = end - start + 1
        ends, at_once = {'*': [None] * size, '**': [None] * size}, {'*': [False] * size, '**': [False] * size}
        later = end
        for i in reversed([start - 1] + [m.start() for m in SPECIAL.finditer(self.s, start, end)]):
            for d in ends:
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
                elif what == 'open':
                    ends[d][i - start] = ends[d][ends[x][j - start] - start]
                else:
                    ends[d][i - start] = ends[d][j - start]
        return ends, at_once

    def _step(self, i, closer, end, links, ends, at_once, base):
        s, c = self.s, self.s[i]
        if c == '\\' and i + 1 < end and s[i + 1] in ESCAPABLE:
            return 'text', i + 2, s[i + 1]
        if c == '`':
            k = min(self.tick[i], end - i)
            runs = self.exact.get(k, ())
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
                if r is None and closer == '*' and can_close:
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
        s, n = self.s, len(self.s)
        if self._close is None:
            self._tables()
        j = self._close[i]
        if j is None or not s.startswith('](', j):
            return None
        ts = self._depth_at.get(self._depth[j + 2] - 1, ())
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
        s, n = self.s, len(self.s)
        longer = {}
        for m in re.finditer('`+', s):
            for k in range(1, len(m[0]) + 1):
                longer.setdefault(k, []).append(m.start())
        bracket = [n] * (n + 2)
        for x in range(n - 1, -1, -1):
            c = s[x]
            if c in '[]':
                bracket[x] = x
                continue
            if c == '\\':
                y = x + 2
            elif c == '`':
                k = self.tick[x]
                runs = longer[k]
                t = bisect.bisect_left(runs, x + k)
                y = runs[t] + k if t < len(runs) else x + k
            else:
                y = x + 1
            bracket[x] = bracket[min(y, n)]
        self._close = close = {}
        for x in range(n - 1, -1, -1):
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


SPECIAL = re.compile(r'[\\`*!\[]')


def _runs(s, ch):
    run = [0] * (len(s) + 1)
    for m in re.finditer(re.escape(ch) + '+', s):
        a, b = m.span()
        run[a:b] = range(b - a, 0, -1)
    return run


def to_html(nodes):
    out, stack = [], [(iter(nodes), '')]
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
        elif n[1] is None:
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
    return to_html(Inline(text, doc or Doc(), line).parse())


def inline_text(text, doc=None):
    return to_text(Inline(text, doc or Doc()).parse())


FENCE = re.compile(r'^```([^`\s]*)[ \t]*$')
HEADING = re.compile(r'^(#{1,6})(?:[ \t]+(.*?))?[ \t]*$')
ITEM = re.compile(r'^( *)(-|\d{1,9}\.)(?:[ \t]+(.*))?$')
RULE = re.compile(r'^ {0,3}(?:([-*_])[ \t]*(?:\1[ \t]*)+|=+[ \t]*)$')
IMAGE = re.compile(r'^!\[((?:[^\]\\]|\\.)*)\]\(([^\s)]+)(?:[ \t]+"((?:[^"\\]|\\.)*)")?\)[ \t]*$')


def render_markdown(md, name='post', first_line=1, doc=None):
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
    def kind(m):
        return 'ul' if m[2] == '-' else 'ol'
    top, n = [], len(lines)
    first = ITEM.match(lines[i])
    tkind, start = kind(first), first[2]
    last = None
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


def page(shell, title, head, main):
    for mark in ('<title>', '<!--site:head-->', '<!--site:page-->'):
        if shell.count(mark) != 1:
            sys.exit(f'the shell must contain {mark} exactly once')
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
    name, url, about = profile['name'], f'{SITE}/blog/', profile.get('writing_description', '')
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
    with open(path, encoding='utf-8') as f:
        lines = f.read().replace('\r\n', '\n').split('\n')
    k = lines.index('---', 1) + 1
    while k < len(lines) and lines[k] == '':
        k += 1
    return k + 1


SHORT_MONTHS = tuple(m[:3] for m in MONTHS)
STATUS = {'active': 'Active', 'completed': 'Complete'}
TYPES = {'software': 'Software', 'infrastructure': 'Infrastructure', 'research': 'Research', 'hardware': 'Hardware'}
SELECTED = 3
PERSON_ID = f'{SITE}/#person'


def month_year(iso, precision):
    return iso[:4] if precision == 'year' else f'{SHORT_MONTHS[int(iso[5:7]) - 1]} {iso[:4]}'


def period(start, end, start_precision, end_precision, now=False, approximate=False):
    if not start:
        return None
    a, b = month_year(start, start_precision), end and month_year(end, end_precision)
    text = f'{a} – now' if now else a if not b or a == b else f'{a} – {b}'
    return f'c. {text}' if approximate else text


def project_period(p):
    return period(p['started'], p['ended'], p['date_precision'], p['date_precision'], p['status'] == 'active' and not p['ended'],
                  p['dates_approximate'])


def entry_period(e):
    return period(e['start_date'], e['end_date'], e['start_precision'], e['end_precision'], bool(e['is_current']) and not e['end_date'])


def listing(projects):
    ranked = sorted(projects, key=lambda p: (p['featured'] or float('inf'), p['order']))
    loud = [p for p in ranked if not p['quiet']] or ranked
    first = next((p for p in loud if p['featured'] == 1), loud[0]) if loud else None
    selected = ([first] if first else []) + [p for p in loud if p is not first][:SELECTED - 1]
    return selected, [p for p in ranked if p not in selected]


def page_doc(name, site):
    return Doc(name, None, site['taken'], set(site['posts']), media='/media', projects=set(site['projects']))


def reserve(doc, ids, what):
    for i in ids:
        if i in doc.ids:
            raise ContentError(f'{doc.name}: {what} id {i} is already an id of the page (the shell\'s, or another {what})')
        doc.ids.add(i)


def person(profile, **more):
    return {'@type': 'Person', '@id': PERSON_ID, 'name': profile['name'], 'url': f'{SITE}/', **more}


def page_head(profile, title, description, path, ld, og_type='website', og_title=None, image=None):
    url = SITE + path
    head = [meta('description', description, 'name'), f'<link rel="canonical" href="{escape(url)}">', meta('og:type', og_type),
            meta('og:site_name', profile['name']), meta('og:title', og_title or title), meta('og:description', description),
            meta('og:url', url)]
    if image:
        head += [meta('og:image', image[0]), meta('og:image:width', image[1]), meta('og:image:height', image[2]),
                 meta('og:image:alt', image[3])]
    head += [meta('twitter:card', 'summary_large_image' if image else 'summary', 'name'), rss_link(profile),
             json_ld({'@context': 'https://schema.org', **ld, 'url': url})]
    return '\n'.join(head)


def anchor(doc, address, text_html, *, new_tab=False):
    to = doc.link(address, None)
    if to is None:
        return text_html
    return f'<a href="{escape(to[0])}"' + (' target="_blank" rel="noopener"' if to[1] or new_tab else '') + f'>{text_html}</a>'


def link_address(link):
    return (link['url'] or (link['post'] and f'/blog/{link["post"]}/') or (link['project'] and f'/portfolio/{link["project"]}/')
            or f'../assets/files/{link["file"]}')


def links_list(doc, items, indent='    ', *, new_tab=False, first_note=None):
    lis = []
    for i, (a, t, k) in enumerate(items):
        note = f' <span class="post-note">{escape(first_note)}</span>' if i == 0 and first_note else ''
        lis.append(f'<li{f" data-kind=\"{escape(k)}\"" if k else ""}>{anchor(doc, a, escape(t), new_tab=new_tab)}{note}</li>')
    return f'{indent}<ul class="post-links">{"".join(lis)}</ul>'


def h2(doc, title, base):
    return f'    <h2 id="{doc.unique_id(base)}">{escape(title)}</h2>'


def img(src, size, alt, cls, lazy=True):
    return (f'<img class="{cls}" src="{escape(src)}" width="{size[0]}" height="{size[1]}" alt="{escape(alt or "")}"'
            + (' loading="lazy"' if lazy else '') + ' decoding="async">')


def project_meta(p):
    per = project_period(p)
    return ' · '.join([f'<span class="post-status">{STATUS[p["status"]]}</span>'] + ([escape(per)] if per else [])
                      + [escape(', '.join(TYPES[t] for t in p['types']))])


def project_page(shell, p, doc, profile, site, next_project):
    related = [q for q in site['posts'].values() if p['slug'] in q['projects']]
    fixed = [(k, t) for k, t, have in (
        ('problem', 'Problem', p['problem']), ('approach', 'Approach', p['approach']), ('outcome', 'Outcome', p['outcome']),
        ('highlights', 'Highlights', p['highlights']), ('results', 'Results', p['results']),
        ('parameters', 'Parameters', p['parameters']), ('lessons', 'Lessons', p['lessons']),
        ('next-steps', 'Next steps', p['next_steps']), ('links', 'Links', p['links']),
        ('related-writing', 'Related writing', related)) if have]
    ids = {k: doc.unique_id(k) for k, _ in fixed}
    body, doc = render_markdown(p['body'], doc=doc)
    sec = lambda k, html: f'    <h2 id="{ids[k]}">{escape(dict(fixed)[k])}</h2>\n    {html}'
    inline = lambda k: '<ul>' + ''.join(f'<li>{render_inline(t, doc.part(f"`{k}[{i}]`"))}</li>' for i, t in enumerate(p[k])) + '</ul>'
    parts = []
    for k in ('problem', 'approach', 'outcome'):
        if p[k]:
            parts.append(sec(k, f'<p>{escape(p[k])}</p>'))
    if body:
        parts.append(body)
    if p['highlights']:
        parts.append(sec('highlights', inline('highlights')))
    if p['results']:
        parts.append(sec('results', '<dl class="post-facts">' + ''.join(
            f'<dt>{escape(r["metric"])}</dt><dd>{escape(r["value"])}</dd>' + (f'<dd class="post-note">{escape(r["note"])}</dd>' if r['note'] else '')
            for r in p['results']) + '</dl>'))
    if p['parameters']:
        parts.append(sec('parameters', '<dl class="post-facts">' + ''.join(
            f'<dt>{escape(r["label"])}</dt><dd>{escape(r["value"])}</dd>' for r in p['parameters']) + '</dl>'))
    for k in ('lessons', 'next_steps'):
        if p[k]:
            parts.append(sec(k.replace('_', '-'), inline(k)))
    if p['links']:
        parts.append(sec('links', links_list(doc.part('`links`'), [(link_address(l), l['label'], l['kind']) for l in p['links']], '').strip()))
    if related:
        parts.append(sec('related-writing', links_list(doc, [(f'/blog/{q["slug"]}/', q['title'], None) for q in related], '').strip()))

    path, cover, card = f'/portfolio/{p["slug"]}/', '', None
    if p['cover']:
        src, size = doc.image(p['cover'], None)
        cap = f'<figcaption>{escape(p["cover_caption"])}</figcaption>' if p['cover_caption'] else ''
        cover = f'  <figure class="post-cover">{img(src, size, p["cover_alt"], "post-cover-image", lazy=False)}{cap}</figure>'
        card = (SITE + src, size[0], size[1], p['cover_alt'] or p['title'])
    head = ['  <header>', f'    <p class="post-meta">{project_meta(p)}</p>', f'    <h1>{escape(p["title"])}</h1>',
            f'    <p class="post-lede">{escape(p["summary"])}</p>']
    if p['role']:
        head.append(f'    <p class="post-role"><b>Role</b> {escape(p["role"])}</p>')
    if p['status_note']:
        head.append(f'    <p class="post-status-note">{escape(p["status_note"])}</p>')
    if p['technologies']:
        head.append('    <ul class="post-tags">' + ''.join(f'<li>{escape(t)}</li>' for t in p['technologies']) + '</ul>')
    head.append('  </header>')
    main = ['<main id="page">', f'<article class="post project" data-slug="{escape(p["slug"])}">', *head]
    if cover:
        main.append(cover)
    if parts:
        main += ['  <div class="post-body">', *parts, '  </div>']
    if next_project:
        main += ['  <footer>', f'    <p class="post-next"><a href="/portfolio/{escape(next_project["slug"])}/"><span>Next</span> '
                 f'{escape(next_project["title"])}</a></p>', '  </footer>']
    main += ['</article>', '</main>']

    ld = {'@type': 'CreativeWork', 'name': p['title'], 'alternateName': p['name'], 'description': p['summary'],
          'genre': ', '.join(TYPES[t] for t in p['types']), 'creator': person(profile),
          'isPartOf': {'@type': 'CollectionPage', '@id': f'{SITE}/portfolio/'}}
    if p['technologies']:
        ld['keywords'] = ', '.join(p['technologies'])
    if card:
        ld['image'] = card[0]
    same = [l['url'] for l in p['links'] if l['url']]
    if same:
        ld['sameAs'] = same
    title = f'{p["title"]} — {profile["name"]}'
    return page(shell, title, page_head(profile, title, p['summary'], path, ld, og_title=p['title'], image=card), '\n'.join(main)), doc


def portfolio_page(shell, profile, site):
    doc = page_doc('/portfolio/', site)
    selected, more = listing(site['projects'].values())
    title = f'Projects — {profile["name"]}'
    item = lambda p: (f'    <li{" class=\"quiet\"" if p["quiet"] else ""}><a href="/portfolio/{escape(p["slug"])}/">{escape(p["title"])}</a> '
                      f'<p>{escape(p["summary"])}</p>\n        <p class="post-meta">{project_meta(p)}</p></li>')
    main = ['<main id="page">', '<section class="post-list">', '  <h1>Projects</h1>', f'  <p class="post-lede">{escape(profile["projects_intro"])}</p>']
    for group, name, base in ((selected, 'Selected projects', 'selected'), (more, 'Experiments & systems', 'more')):
        if group:
            main += [h2(doc, name, base)[2:], '  <ol>', *map(item, group), '  </ol>']
    main += ['</section>', '</main>']
    ld = {'@type': 'CollectionPage', '@id': f'{SITE}/portfolio/', 'name': title, 'description': profile['projects_intro'],
          'author': person(profile),
          'mainEntity': {'@type': 'ItemList', 'itemListElement': [
              {'@type': 'ListItem', 'position': i, 'url': f'{SITE}/portfolio/{p["slug"]}/', 'name': p['title']}
              for i, p in enumerate(selected + more, 1)]}}
    return page(shell, title, page_head(profile, title, profile['projects_intro'], '/portfolio/', ld), '\n'.join(main)), doc


def contact_links(profile):
    if not profile['contact_links']:
        return profile['social_links']
    by_label = {l['label']: l for l in profile['social_links']}
    return [by_label[k] for k in profile['contact_links']]


def availability(doc, profile, here=False):
    a = profile['availability']
    when = f' · updated <time datetime="{a["updated_at"]}">{human_date(a["updated_at"])}</time>' if a['updated_at'] else ''
    out = [h2(doc, 'Availability', 'availability'),
           f'    <p class="post-availability" data-status="{escape(a["status"])}"><b>{escape(a["status"].capitalize())}</b>{when}</p>']
    if a['seeking']:
        out.append('    <ul>' + ''.join(f'<li>{escape(s)}</li>' for s in a['seeking']) + '</ul>')
    if not here:
        out.append(f'    <p class="post-cta"><a href="/contact/">{escape(a["cta"])}</a></p>')
    return out


def elsewhere(doc, profile, site, *, links=None, new_tab=False, first_note=None):
    items = [(l['url'], l['label'], None) for l in (links if links is not None else profile['social_links'])]
    if site['resume']:
        items.append((site['resume'], 'Résumé (PDF)', None))
    return [h2(doc, 'Elsewhere', 'elsewhere'), links_list(doc.part('`social_links`'), items, new_tab=new_tab, first_note=first_note)]


def article_page(shell, slug, title, header, body, head):
    main = ['<main id="page">', f'<article class="post page" data-slug="{slug}">', '  <header>', *header, '  </header>',
            '  <div class="post-body">', *body, '  </div>', '</article>', '</main>']
    return page(shell, title, head, '\n'.join(main))


def about_page(shell, profile, site):
    doc, name = page_doc('data/profile.json', site), profile['name']
    header = [f'    <p class="post-meta">{escape(profile["headline"])} · {escape(profile["location"])}</p>',
              f'    <h1>{escape(name)}</h1>', f'    <p class="post-lede">{escape(profile["tagline"])}</p>']
    body = [f'    <p>{escape(profile["introduction"])}</p>', h2(doc, 'The story so far', 'story'),
            *(f'    <p>{escape(para)}</p>' for para in profile['bio'].split('\n\n'))]
    if profile['focus_areas']:
        body += [h2(doc, 'Current focus', 'focus'), '    <ul>' + ''.join(f'<li>{escape(f)}</li>' for f in profile['focus_areas']) + '</ul>']
    if profile['current_curiosities']:
        body.append(h2(doc, 'Curiosities', 'curiosities'))
        if profile['curiosities_updated_at']:
            d = profile['curiosities_updated_at']
            body.append(f'    <p class="post-meta">Updated <time datetime="{d}">{human_date(d)}</time></p>')
        lis = []
        for i, c in enumerate(profile['current_curiosities']):
            li = f'<li><strong>{escape(c["title"])}</strong>' + (f' <p>{escape(c["note"])}</p>' if c['note'] else '')
            if c['project']:
                pr = site['projects'].get(c['project'])
                li += (' <p class="post-meta">Project: ' + anchor(doc.part(f'`current_curiosities[{i}].project`'), f'/portfolio/{c["project"]}/',
                                                                  escape(pr['name'] if pr else c['project'])) + '</p>')
            lis.append(li + '</li>')
        body.append('    <ul class="post-curiosities">' + ''.join(lis) + '</ul>')
    body += availability(doc, profile)
    if profile['featured_post']:
        post = site['posts'].get(profile['featured_post'])
        if post:
            body += [h2(doc, 'Featured writing', 'featured-writing'),
                     f'    <p class="post-featured"><a href="/blog/{escape(post["slug"])}/">{escape(post["title"])}</a> {escape(post["description"])}</p>']
        else:
            doc.warnings.append(f'{doc.name}: `featured_post` {profile["featured_post"]} is not among the posts; /about/ leaves it out')
    body += elsewhere(doc, profile, site)

    title = f'About — {name}'
    work = next((e for e in profile['timeline'] if e['kind'] == 'work' and e['is_current']), None)
    studies = lambda now: [{'@type': 'CollegeOrUniversity', 'name': n} for n in dict.fromkeys(
        e['organization'] for e in profile['timeline'] if e['kind'] == 'education' and bool(e['is_current']) == now)]
    place = dict(zip(('addressLocality', 'addressRegion'), (s.strip() for s in profile['location'].split(',')[:2])))
    who = person(profile, description=profile['seo_description'])
    if work:
        who.update(jobTitle=work['title'], worksFor={'@type': 'Organization', 'name': work['organization']})
    who['homeLocation'] = {'@type': 'Place', 'address': {'@type': 'PostalAddress', **place}}
    for k, v in (('alumniOf', studies(False)), ('affiliation', studies(True)),
                 ('knowsAbout', list(dict.fromkeys(s for g in profile['skill_groups'] for s in g['skills']))),
                 ('hasCredential', [credential_ld(c) for c in profile['credentials']])):
        if v:
            who[k] = v
    who['sameAs'] = [l['url'] for l in profile['social_links']]
    ld = {'@type': 'ProfilePage', 'name': title, 'description': profile['seo_description'], 'mainEntity': who}
    return article_page(shell, 'about', title, header, body,
                        page_head(profile, title, profile['seo_description'], '/about/', ld, og_type='profile')), doc


def credential_ld(c):
    ld = {'@type': 'EducationalOccupationalCredential', 'name': c['title'], 'credentialCategory': 'certification',
          'recognizedBy': {'@type': 'Organization', 'name': c['issuer']}, 'validFrom': c['issued_on']}
    if c['expires_on'] and not c['lifetime']:
        ld['validUntil'] = c['expires_on']
    if c['verification_url']:
        ld['url'] = c['verification_url']
    return ld


def employment(e):
    if not e['employment']:
        return None
    label = e['employment'][:1].upper() + e['employment'][1:]
    return None if re.search(r'\b' + re.escape(re.sub(r'ship$', '', label, flags=re.I)) + r'\b', e['title'], re.I) else label


def experience_page(shell, profile, site):
    doc = page_doc('data/profile.json', site)
    reserve(doc, [e['id'] for e in profile['timeline']], 'timeline')
    body = []
    for i, e in enumerate(profile['timeline']):
        when = entry_period(e) + (f' (expected {e["expected_end_year"]})' if e['expected_end_year'] and not e['end_date'] else '')
        meta_ = ' · '.join(escape(x) for x in (e['organization'], when, e['location'], employment(e)) if x)
        sec = [f'    <section class="entry" id="{e["id"]}" data-kind="{e["kind"]}">']
        if e['logo']:
            src, size = doc.image(e['logo'], None)
            sec.append('      ' + img(src, size, e['logo_alt'], 'entry-logo'))
        sec += [f'      <h2>{escape(e["title"])}</h2>', f'      <p class="post-meta">{meta_}</p>']
        if e['summary']:
            sec.append(f'      <p>{escape(e["summary"])}</p>')
        if e['highlights']:
            sec.append('      <ul>' + ''.join(f'<li>{escape(h)}</li>' for h in e['highlights']) + '</ul>')
        body += sec + ['    </section>']
    body.append(h2(doc, 'Skills', 'skills'))
    for g in profile['skill_groups']:
        body += [f'    <h3 id="{doc.unique_id(re.sub(r"[^a-z0-9 -]", "", g["title"].lower()).replace(" ", "-") or "skills")}">{escape(g["title"])}</h3>',
                 '    <ul class="post-tags">' + ''.join(f'<li>{escape(s)}</li>' for s in g['skills']) + '</ul>']
    if profile['credentials']:
        lis = []
        for i, c in enumerate(profile['credentials']):
            badge = ''
            if c['badge']:
                src, size = doc.image(c['badge'], None)
                badge = img(src, size, c['badge_alt'], 'post-badge') + ' '
            name = (anchor(doc.part(f'`credentials[{i}].verification_url`'), c['verification_url'], escape(c['title']))
                    if c['verification_url'] else escape(c['title']))
            issued = month_year(c['issued_on'], 'month')
            dates = f'{issued} – {month_year(c["expires_on"], "month")}' if c['expires_on'] and not c['lifetime'] else issued
            said = c['issuer'].lower() in c['title'].lower()
            lis.append(f'<li>{badge}{name} <span class="post-meta">' + ' · '.join(([] if said else [escape(c['issuer'])]) + [dates]) + '</span></li>')
        body += [h2(doc, 'Credentials', 'credentials'), '    <ul class="post-credentials">' + ''.join(lis) + '</ul>']
    if profile['talks_and_papers']:
        lis = []
        for i, t in enumerate(profile['talks_and_papers']):
            facts = [t['kind'][:1].upper() + t['kind'][1:], f'<time datetime="{t["date"]}">{month_year(t["date"], "month")}</time>']
            li = (f'<li><strong>{escape(t["title"])}</strong> <p class="post-meta">' + ' · '.join(
                [escape(facts[0]), facts[1]] + [escape(x) for x in (t['venue'], t['authors']) if x]) + '</p>')
            if t['abstract']:
                li += f' <p>{escape(t["abstract"])}</p>'
            items = [(link_address(l), l['label'], l['kind']) for l in t['links']]
            if t['project']:
                pr = site['projects'].get(t['project'])
                items.append((f'/portfolio/{t["project"]}/', 'Project: ' + (pr['name'] if pr else t['project']), None))
            if items:
                li += ' ' + links_list(doc.part(f'`talks_and_papers[{i}]`'), items, '')
            lis.append(li + '</li>')
        body += [h2(doc, 'Talks and papers', 'talks-and-papers'), '    <ul class="post-talks">' + ''.join(lis) + '</ul>']
    if site['resume']:
        body += [h2(doc, 'Résumé', 'resume'), links_list(doc, [(site['resume'], 'Résumé (PDF)', None)])]

    title = f'Experience — {profile["name"]}'
    ld = {'@type': 'WebPage', 'name': title, 'description': profile['work_summary'], 'about': person(profile)}
    header = ['    <h1>Experience</h1>', f'    <p class="post-lede">{escape(profile["work_summary"])}</p>']
    return article_page(shell, 'experience', title, header, body,
                        page_head(profile, title, profile['work_summary'], '/experience/', ld)), doc


def contact_page(shell, profile, site):
    doc = page_doc('data/profile.json', site)
    header = ['    <h1>Contact</h1>', f'    <p class="post-lede">{escape(profile["contact_intro"])}</p>']
    body = [f'    <p>{escape(profile["contact_invitation"])}</p>']
    body += elsewhere(doc, profile, site, links=contact_links(profile), new_tab=True, first_note='Write to me')
    body += availability(doc, profile, here=True)
    title = f'Contact — {profile["name"]}'
    ld = {'@type': 'ContactPage', 'name': title, 'description': profile['contact_invitation'],
          'about': person(profile, sameAs=[l['url'] for l in profile['social_links']])}
    return article_page(shell, 'contact', title, header, body,
                        page_head(profile, title, profile['contact_invitation'], '/contact/', ld)), doc


def portfolio_json(projects):
    return [{'slug': p['slug'], 'url': f'/portfolio/{p["slug"]}/', 'name': p['name'], 'title': p['title'], 'summary': p['summary'],
             'status': p['status'], 'status_label': STATUS[p['status']], 'period': project_period(p),
             'year': p['started'] and p['started'][:4], 'types': p['types'], 'role': p['role'], 'technologies': p['technologies'],
             'featured': p['featured'], 'quiet': bool(p['quiet'])} for p in projects]


def profile_json(profile, resume_url):
    a = profile['availability']
    return {
        'name': profile['name'], 'headline': profile['headline'], 'tagline': profile['tagline'], 'location': profile['location'],
        'introduction': profile['introduction'], 'focus': profile['focus_areas'],
        'availability': {'status': a['status'], 'label': a['cta'], 'seeking': a['seeking']},
        'curiosities': [{'kind': 'question' if c['title'].endswith('?') else None, 'title': c['title'], 'note': c['note'],
                         'url': c['project'] and f'/portfolio/{c["project"]}/'} for c in profile['current_curiosities']],
        'timeline': [{'id': e['id'], 'url': f'/experience/#{e["id"]}', 'kind': e['kind'], 'title': e['title'],
                      'organization': e['organization'], 'org_short': e['org_short'], 'period': entry_period(e),
                      'year': e['start_date'][:4], 'current': bool(e['is_current']), 'location': e['location'],
                      'employment': e['employment'], 'summary': e['summary']} for e in profile['timeline']],
        'links': [{'label': l['label'], 'url': l['url']} for l in profile['social_links']],
        'contact': {'intro': profile['contact_intro'], 'invitation': profile['contact_invitation'],
                    'links': [{'label': l['label'], 'url': l['url']} for l in contact_links(profile)],
                    'routes': [{'id': k, 'title': r['title'], 'prompt': r['prompt']} for k, r in profile['contact_routes'].items()]},
        'resume': resume_url}


def versioned(key, value):
    v = hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:8]
    body = {'v': v, key: value} if key else {'v': v, **value}
    return (json.dumps(body, ensure_ascii=False, indent=1) + '\n').encode()


def add_files(outputs, doc):
    for name, src in doc.files.items():
        with open(src, 'rb') as f:
            data = f.read()
        if outputs.get(f'blog/files/{name}', data) != data:
            raise ContentError(f'{doc.name}: two different files are both called {name}')
        outputs[f'blog/files/{name}'] = data


def build(posts_dir, out, projects_dir=None, profile_path=None, shell_path=SHELL):
    with open(shell_path, encoding='utf-8') as f:
        shell = f.read()
    taken = set(re.findall(r'\bid="([^"]+)"', shell)) | {'page', *RUNTIME_IDS}
    projects_dir = projects_dir or os.path.join(DATA, 'projects')
    posts, projects, profile = load_posts(posts_dir), load_projects(projects_dir), load_profile(profile_path)
    by_slug, by_project = {p['slug']: p for p in posts}, {p['slug']: p for p in projects}
    outputs, entries, media, warnings = {}, [], {}, []
    for p in posts:
        path = os.path.join(posts_dir, p['slug'] + '.md')
        doc = Doc(os.path.relpath(path), body_start(path), taken, set(by_slug), projects=set(by_project))
        body, doc = render_markdown(p['body'], doc=doc)
        outputs[f'blog/{p["slug"]}/index.html'] = post_page(shell, p, doc, body, profile, by_slug).encode()
        if p['image']:
            with open(image_file(p['image']), 'rb') as f:
                outputs[f'blog/media/{p["image"]}'] = f.read()
        add_files(outputs, doc)
        media.update(doc.media)
        warnings += doc.warnings
        entries.append({'slug': p['slug'], 'url': f'/blog/{p["slug"]}/', 'title': p['title'], 'description': p['description'],
                        'published': p['published'], 'revised': p['revised'], 'date': human_date(p['published']),
                        'minutes': p['minutes'], 'words': p['words'], 'tags': p['tags'], 'sections': doc.sections})
    v = hashlib.sha256(json.dumps(entries, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:8]
    outputs['blog/index.json'] = (json.dumps({'v': v, 'posts': entries}, ensure_ascii=False, indent=1) + '\n').encode()
    outputs['blog/index.html'] = list_page(shell, entries, profile).encode()

    cv = site_extras.resume(profile)
    site = {'taken': taken, 'posts': by_slug, 'projects': by_project, 'resume': cv and f'/resume/{quote(cv[0])}'}
    order = sum(listing(projects), [])
    pages = []
    for i, p in enumerate(order):
        path = os.path.join(projects_dir, p['slug'] + '.md')
        doc = page_doc(os.path.relpath(path), site)
        doc.first_line = body_start(path)
        nxt = order[(i + 1) % len(order)] if len(order) > 1 else None
        pages.append((f'portfolio/{p["slug"]}/index.html', *project_page(shell, p, doc, profile, site, nxt)))
    for rel, make in (('portfolio/index.html', portfolio_page), ('about/index.html', about_page),
                      ('experience/index.html', experience_page), ('contact/index.html', contact_page)):
        pages.append((rel, *make(shell, profile, site)))
    for rel, html_, doc in pages:
        outputs[rel] = html_.encode()
        add_files(outputs, doc)
        media.update(doc.media)
        warnings += doc.warnings
    outputs['portfolio/index.json'] = versioned('projects', portfolio_json(projects))
    outputs['profile.json'] = versioned(None, profile_json(profile, site['resume']))

    with tempfile.TemporaryDirectory(prefix='site-') as tmp:
        for rel, (src, size) in sorted(media.items()):
            have = os.path.join(out, rel)
            if os.path.isfile(have) and image_info(have)[:2] == size:
                outputs[rel] = KEEP
            else:
                print(f'encoding {os.path.relpath(src, ROOT)} at {size[0]}x{size[1]}', flush=True)
                outputs[rel] = encode(src, size, tmp)
    return outputs, posts, projects, profile, warnings


def out_path(out, rel):
    root = os.path.realpath(out)
    path = os.path.realpath(os.path.join(root, rel))
    if path == root or os.path.commonpath([root, path]) != root:
        raise ContentError(f'{rel}: refused, it is not inside {out}')
    return path


RECORD = '.generated-files'
OWNED = ('blog/', 'portfolio/', 'about/', 'experience/', 'contact/', 'media/', 'profile.json')


def write_outputs(out, outputs, prune=('blog',)):
    written = unchanged = removed = 0
    outputs = dict(outputs)
    outputs[RECORD] = ('# Written by tools/site.py: the files of its last run, which the next removes if it no longer makes them.\n'
                       + ''.join(f'{rel}\n' for rel in sorted(outputs))).encode()
    paths = {rel: out_path(out, rel) for rel in outputs}
    stale = []
    try:
        with open(os.path.join(out, RECORD), encoding='utf-8') as f:
            earlier = [l.strip() for l in f if l.strip() and not l.startswith('#')]
    except FileNotFoundError:
        earlier = []
    root = os.path.realpath(out)
    for rel in sorted(set(earlier) - set(outputs)):
        if '\\' in rel or '..' in rel.split('/') or rel.startswith('/'):
            continue
        try:
            path = out_path(out, rel)
        except ContentError:
            continue
        real = os.path.relpath(os.path.realpath(path), root).replace(os.sep, '/')
        if real == rel and rel.startswith(OWNED):
            stale.append((rel, path))
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
    root = os.path.realpath(out)
    for rel, path in stale:
        if os.path.isfile(path) and not os.path.islink(path):
            os.remove(path); print('removed', rel); removed += 1
            folder = os.path.dirname(path)
            while folder != root and os.path.isdir(folder) and not os.listdir(folder):
                os.rmdir(folder)
                folder = os.path.dirname(folder)
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
    ap = argparse.ArgumentParser(description='Write the pages of the site from data/: the posts, the projects and the profile.')
    ap.add_argument('--posts', default=os.path.join(DATA, 'posts'), help='folder of <slug>.md posts (default data/posts)')
    ap.add_argument('--projects', default=os.path.join(DATA, 'projects'), help='folder of <slug>.md projects (default data/projects)')
    ap.add_argument('--profile', default=os.path.join(DATA, 'profile.json'), help='the profile (default data/profile.json)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public'), help='site folder to write into (default public)')
    ap.add_argument('--shell', default=SHELL, help='page that each page is made from (default index.html; dist/index.html after vite build)')
    a = ap.parse_args(argv)
    try:
        outputs, posts, projects, profile, warnings = build(a.posts, a.out, a.projects, a.profile, a.shell)
        extras = site_extras.build(posts, profile, projects)
        for rel in extras:
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
