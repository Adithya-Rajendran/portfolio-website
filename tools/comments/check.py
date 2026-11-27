#!/usr/bin/env python3
# Comment rule checker for the tracked source files, with the shrinking legacy list.
import argparse
import ast
import io
import os
import re
import sys
import tokenize

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ci"))
import legacy as legacy_list  # noqa: E402

BT = chr(96)
OPEN = "$" "{"
EXTENSIONS = {
    ".js": "js", ".mjs": "js", ".cjs": "js", ".ts": "js", ".tsx": "js", ".jsx": "js",
    ".py": "py", ".sh": "sh", ".bash": "sh", ".css": "css", ".html": "html", ".htm": "html", ".ps1": "ps1",
}
EXEMPT_PREFIXES = ("public/vendor/", "node_modules/", "dist/", ".agent-chat/")
GENERATED = (
    "public/asset-catalogue/",
    "public/lighting-review/index.html",
)
HEADER_BANNED = re.compile(
    r"\b(because|since|so that|why|todo|fixme|xxx|hack|workaround|decided|decision|instead|previously|formerly|"
    r"no longer|used to|was|were|reason|history|note)\b|\bD\d+\b|#\d+",
    re.IGNORECASE,
)
SINGLE_WORD_RULES = {"camelcase", "complexity", "curly", "eqeqeq", "indent", "quotes", "radix", "semi", "strict", "yoda", "indentation"}
RULE_NAME = re.compile(r"(?:@[\w-]+/)?[a-z][\w-]*(?:/[\w-]+)?")


def rule_names(m):
    rest = (m.group(1) or "").strip()
    if not rest:
        return True
    names = [x.strip() for x in rest.split(",")]
    return all(RULE_NAME.fullmatch(x) and ("-" in x or "/" in x or x in SINGLE_WORD_RULES) for x in names)


PY_TYPE = r"[\w.]+(?:\[[\w.\[\], |]*\])?"
DIRECTIVES = {
    "js": [
        (re.compile(r"^eslint-(?:disable|enable|disable-line|disable-next-line)(?:\s+(.+))?$"), rule_names),
        (re.compile(r"^@ts-(?:expect-error|nocheck|check)$"), None),
        (re.compile(r"^@vite-ignore$"), None),
        (re.compile(r"^[@#]__PURE__$"), None),
        (re.compile(r'^/\s*<reference\s+(?:path|types|lib)="[^"]+"\s*/>$'), None),
        (re.compile(r"^prettier-ignore$"), None),
    ],
    "css": [
        (re.compile(r"^stylelint-(?:disable|enable|disable-line|disable-next-line)(?:\s+(.+))?$"), rule_names),
        (re.compile(r"^prettier-ignore$"), None),
    ],
    "py": [
        (re.compile(r"^noqa(?::\s*[A-Z]+\d+(?:\s*,\s*[A-Z]+\d+)*)?$"), None),
        (re.compile(r"^type:\s*(?:ignore(?:\[[\w-]+(?:,\s*[\w-]+)*\])?|" + PY_TYPE + r"(?:\s*\|\s*" + PY_TYPE + r")*)$"), None),
        (re.compile(r"^pragma: no cover$"), None),
        (re.compile(r"^-\*- coding: [\w-]+ -\*-$"), None),
        (re.compile(r"^fmt: (?:off|on|skip)$"), None),
    ],
    "sh": [(re.compile(r"^shellcheck\s+(?:disable|enable|source|shell)=[\w,./-]+$"), None)],
    "ps1": [(re.compile(r"^requires(?:\s+-(?:version\s+\d+(?:\.\d+)*|modules?\s+[\w.,-]+|runasadministrator|psedition\s+\w+))+$", re.IGNORECASE), None)],
    "html": [(re.compile(r"^site:(?:head|page)$"), None)],
    "docker": [(re.compile(r"^(?:syntax|escape|check)=\S+$"), None)],
}
GLSL_MARK = re.compile(
    r"\bgl_(?:FragColor|Position|FragCoord)\b|\bvoid\s+main\s*\(|\b(?:uniform|varying|attribute)\s+\w"
    r"|\bprecision\s+(?:high|medium|low)p\b|#include\s*<|\bvec[234]\s*\("
    r"|\b(?:float|int|bool|[ib]?vec[234]|mat[234]|sampler2D|samplerCube)\s+\w+\s*(?:=|;|\[|,|\))"
    r"|\btexture(?:2D|Cube|2DLod|CubeLodEXT)?\s*\(|(?m:^\s*#\s*(?:define|ifdef|ifndef|endif|elif|undef)\b)"
)
GLSL_COMMENT = re.compile(r"(?<![:\\])//[^\n]*|/\*.*?(?:\*/|$)", re.DOTALL)
REGEX_BEFORE = set("(,=:[!&|?{};+-*%<>~^")
REGEX_KEYWORDS = {"return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"}
SCRIPT_TAG = re.compile(r"<(script|style)\b([^>]*)>", re.IGNORECASE)
SCRIPT_TYPE = re.compile(r"\btype\s*=\s*[\"']?([^\"'\s>]+)")
JS_TYPES = ("", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript")


class Comment:
    def __init__(self, line, text, kind, end_line=None, lang=None):
        self.line = line
        self.text = text
        self.kind = kind
        self.end_line = end_line if end_line is not None else line
        self.lang = lang

    def body(self):
        t = self.text
        if self.kind == "line":
            if t.startswith("///"):
                return t[2:].strip()
            t = t[2:] if t.startswith("//") else t[1:]
        elif self.kind == "block":
            if t.startswith("<!--"):
                t = t[4:-3] if t.endswith("-->") else t[4:]
            elif t.startswith("<#"):
                t = t[2:-2] if t.endswith("#>") else t[2:]
            else:
                t = t[2:-2] if t.endswith("*/") else t[2:]
        return t.strip()


def line_of(src, pos):
    return src.count("\n", 0, pos) + 1


def scan_js(src, base_line=1, jsx=False):
    comments, strings = [], []
    i, n = 0, len(src)
    prev = None
    modes = ["code"]
    depth = [0]
    tpl = []
    groups = 0
    while i < n:
        c = src[i]
        if modes[-1] == "tpl":
            start = i
            while i < n:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == BT:
                    strings.append((start, src[start:i], tpl[-1]))
                    i += 1
                    modes.pop()
                    tpl.pop()
                    prev = "str"
                    break
                if src.startswith(OPEN, i):
                    strings.append((start, src[start:i], tpl[-1]))
                    i += 2
                    modes.append("code")
                    depth.append(0)
                    prev = "("
                    break
                i += 1
            else:
                strings.append((start, src[start:n], tpl[-1]))
            continue
        if c in " \t\r\n":
            i += 1
            continue
        if jsx and src.startswith("//", i) and i > 0 and src[i - 1] == ":":
            i += 2
            continue
        if src.startswith("//", i):
            j = src.find("\n", i)
            j = n if j < 0 else j
            comments.append(Comment(base_line + line_of(src, i) - 1, src[i:j], "line", lang="js"))
            i = j
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            comments.append(Comment(base_line + line_of(src, i) - 1, src[i:j], "block", base_line + line_of(src, j - 1) - 1, lang="js"))
            i = j
            continue
        if c in "'\"":
            j = i + 1
            while j < n and src[j] != c and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            groups += 1
            strings.append((i + 1, src[i + 1:min(j, n)], -groups))
            i = j + 1
            prev = "str"
            continue
        if c == BT:
            groups += 1
            modes.append("tpl")
            tpl.append(groups)
            i += 1
            continue
        if c == "/":
            if prev is None or prev in REGEX_BEFORE or prev in REGEX_KEYWORDS:
                j = i + 1
                in_class = False
                while j < n and src[j] != "\n":
                    if src[j] == "\\":
                        j += 2
                        continue
                    if src[j] == "[":
                        in_class = True
                    elif src[j] == "]":
                        in_class = False
                    elif src[j] == "/" and not in_class:
                        break
                    j += 1
                j += 1
                while j < n and src[j].isalnum():
                    j += 1
                i = j
                prev = "re"
                continue
            prev = "/"
            i += 1
            continue
        if c.isalnum() or c in "_$":
            j = i
            while j < n and (src[j].isalnum() or src[j] in "_$"):
                j += 1
            word = src[i:j]
            prev = word if word in REGEX_KEYWORDS else "id"
            i = j
            continue
        if c == "{":
            depth[-1] += 1
        elif c == "}":
            if len(modes) > 1 and depth[-1] == 0:
                modes.pop()
                depth.pop()
                i += 1
                continue
            depth[-1] -= 1
        prev = "id" if c in ")]" else c
        i += 1
    glsl = {g for _, text, g in strings if GLSL_MARK.search(text)}
    for start, text, g in strings:
        if g in glsl:
            for m in GLSL_COMMENT.finditer(text):
                comments.append(Comment(base_line + line_of(src, start + m.start()) - 1, m.group(0), "glsl", lang="glsl"))
    return comments


def scan_css(src, base_line=1):
    comments = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if c in "'\"":
            j = i + 1
            while j < n and src[j] != c and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            i = j + 1
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            comments.append(Comment(base_line + line_of(src, i) - 1, src[i:j], "block", base_line + line_of(src, j - 1) - 1, lang="css"))
            i = j
            continue
        i += 1
    return comments


def scan_html(src):
    comments = []
    i, n = 0, len(src)
    low = src.lower()
    while i < n:
        if src.startswith("<!--", i):
            j = src.find("-->", i + 4)
            j = n if j < 0 else j + 3
            comments.append(Comment(line_of(src, i), src[i:j], "block", line_of(src, j - 1), lang="html"))
            i = j
            continue
        m = SCRIPT_TAG.match(src, i) if src[i] == "<" else None
        if m:
            tag, attrs = m.group(1).lower(), m.group(2).lower()
            end = low.find("</" + tag, m.end())
            end = n if end < 0 else end
            inner = src[m.end():end]
            line = line_of(src, m.end())
            t = SCRIPT_TYPE.search(attrs)
            kind = t.group(1) if t else ""
            if tag == "style":
                comments += scan_css(inner, line)
            elif "x-shader" in kind:
                for mm in GLSL_COMMENT.finditer(inner):
                    comments.append(Comment(line + inner.count("\n", 0, mm.start()), mm.group(0), "glsl", lang="glsl"))
            elif kind in JS_TYPES:
                comments += scan_js(inner, line)
            i = end
            continue
        if src[i] == "<" and i + 1 < n and (src[i + 1].isalpha() or src[i + 1] == "/"):
            j = i + 1
            quote = None
            while j < n:
                if quote:
                    if src[j] == quote:
                        quote = None
                elif src[j] in "\"'":
                    quote = src[j]
                elif src[j] == ">":
                    break
                j += 1
            i = j + 1
            continue
        i += 1
    return comments


def scan_sh(src):
    comments = []
    lines = src.split("\n")
    heredocs = []
    in_single = in_double = False
    k = 0
    while k < len(lines):
        line = lines[k]
        if heredocs and not in_single and not in_double:
            delim, strip = heredocs[0]
            if (line.lstrip("\t") if strip else line) == delim:
                heredocs.pop(0)
            k += 1
            continue
        i, n = 0, len(line)
        while i < n:
            c = line[i]
            if in_single:
                if c == "'":
                    in_single = False
                i += 1
                continue
            if in_double:
                if c == "\\":
                    i += 2
                    continue
                if c == '"':
                    in_double = False
                i += 1
                continue
            if c == "\\":
                i += 2
                continue
            if c == "'":
                if i > 0 and line[i - 1] == "$":
                    j = i + 1
                    while j < n and line[j] != "'":
                        j += 2 if line[j] == "\\" else 1
                    i = j + 1
                    continue
                in_single = True
                i += 1
                continue
            if c == '"':
                in_double = True
                i += 1
                continue
            if c == "#" and (i == 0 or line[i - 1] in " \t;&|()"):
                comments.append(Comment(k + 1, line[i:], "line", lang="sh"))
                break
            if line.startswith("<<", i) and not line.startswith("<<<", i) and line[:i].count("((") <= line[:i].count("))"):
                m = re.match(r"<<(-?)\s*(['\"]?)([A-Za-z_][\w.-]*)\2", line[i:])
                if m:
                    heredocs.append((m.group(3), m.group(1) == "-"))
                    i += m.end()
                    continue
            i += 1
        k += 1
    return comments


def scan_ps1(src):
    comments = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith('@"', i) or src.startswith("@'", i):
            j = src.find("\n" + src[i + 1] + "@", i + 2)
            i = n if j < 0 else j + 3
            continue
        if c == "'":
            j = i + 1
            while j < n:
                if src.startswith("''", j):
                    j += 2
                    continue
                if src[j] == "'":
                    break
                j += 1
            i = j + 1
            continue
        if c == '"':
            j = i + 1
            while j < n and src[j] != '"':
                j += 2 if src[j] == BT else 1
            i = j + 1
            continue
        if src.startswith("<#", i):
            j = src.find("#>", i + 2)
            j = n if j < 0 else j + 2
            comments.append(Comment(line_of(src, i), src[i:j], "block", line_of(src, j - 1), lang="ps1"))
            i = j
            continue
        if c == "#" and (i == 0 or src[i - 1] in " \t\n;(){}|"):
            j = src.find("\n", i)
            j = n if j < 0 else j
            comments.append(Comment(line_of(src, i), src[i:j], "line", lang="ps1"))
            i = j
            continue
        i += 1
    return comments


def scan_docker(src):
    comments, pending = [], []
    for k, line in enumerate(src.split("\n"), 1):
        if pending:
            delim, strip = pending[0]
            if (line.lstrip("\t") if strip else line).strip() == delim:
                pending.pop(0)
            continue
        if line.lstrip().startswith("#"):
            comments.append(Comment(k, line.strip(), "line", lang="docker"))
            continue
        for m in re.finditer(r"<<(-?)(['\"]?)([A-Za-z_]\w*)\2", line):
            pending.append((m.group(3), m.group(1) == "-"))
    return comments


def scan_py(src):
    comments = []
    try:
        for tok in tokenize.generate_tokens(io.StringIO(src).readline):
            if tok.type == tokenize.COMMENT:
                comments.append(Comment(tok.start[0], tok.string, "line", lang="py"))
        tree = ast.parse(src)
    except (tokenize.TokenError, SyntaxError) as e:
        return comments, ["cannot read the file as Python: %s" % e]
    docs = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and node.body:
            docs.add(id(node.body[0]))
    for node in ast.walk(tree):
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            kind = "docstring" if id(node) in docs else "string"
            comments.append(Comment(node.lineno, kind, kind, node.end_lineno, lang="py"))
    return comments, []


SCANNERS = {"js": scan_js, "css": scan_css, "html": scan_html, "sh": scan_sh, "ps1": scan_ps1, "docker": scan_docker}


def language(path):
    base = os.path.basename(path)
    if base == "Dockerfile" or base.startswith("Dockerfile."):
        return "docker"
    return EXTENSIONS.get(os.path.splitext(base)[1].lower())


def is_exempt(path):
    return path.startswith(EXEMPT_PREFIXES) or any(path == g or (g.endswith("/") and path.startswith(g)) for g in GENERATED)


def is_directive(comment, lang):
    kind = comment.lang if comment.lang in ("js", "css") else lang
    body = comment.body()
    for pattern, valid in DIRECTIVES.get(kind, []):
        m = pattern.match(body)
        if m and (valid is None or valid(m)):
            return True
    return False


def header_problems(header):
    body = header.body()
    if not body:
        return ["line %d: the header comment is empty" % header.line]
    found = []
    if len(body) > 160:
        found.append("line %d: the header comment is longer than 160 characters" % header.line)
    if re.search(r"[.!?;]\s+\S", body):
        found.append("line %d: the header comment has more than one sentence" % header.line)
    m = HEADER_BANNED.search(body)
    if m:
        found.append("line %d: the header comment gives an explanation or a history (%r)" % (header.line, m.group(0)))
    return found


def check_source(path, src):
    lang = language(path)
    if lang is None or not src.strip():
        return []
    errors = []
    if lang == "py":
        comments, errors = scan_py(src)
    elif lang == "js":
        comments = scan_js(src, jsx=path.endswith((".jsx", ".tsx")))
    else:
        comments = SCANNERS[lang](src)
    comments.sort(key=lambda c: c.line)
    lines = src.split("\n")
    first = 1 if lines[0].startswith("#!") else 0
    comments = [c for c in comments if not (c.line == 1 and c.text.startswith("#!"))]
    if lang == "html" and first < len(lines) and re.match(r"^\s*<!doctype[^>]*>\s*$", lines[first], re.IGNORECASE):
        first += 1
    while lang in ("py", "docker") and any(c.line == first + 1 and is_directive(c, lang) for c in comments):
        first += 1
    header = None
    rest = [c for c in comments if c.line > first]
    if rest and rest[0].line == first + 1 and rest[0].end_line == first + 1 and rest[0].kind in ("line", "block"):
        c = rest[0]
        if not is_directive(c, lang) and lines[first].strip() == c.text.strip():
            header = c
    if header is None:
        errors.append("line %d: the file must start with one header comment line" % (first + 1))
    else:
        errors += header_problems(header)
    for c in comments:
        if c is header:
            continue
        if c.kind == "docstring":
            errors.append("line %d: docstring" % c.line)
        elif c.kind == "string":
            errors.append("line %d: a string used as a comment" % c.line)
        elif c.kind == "glsl" or not is_directive(c, lang):
            errors.append("line %d: comment %s" % (c.line, c.text.split("\n")[0][:60]))
    return errors


def collect(root, paths):
    results, digests = {}, {}
    for rel in paths:
        if is_exempt(rel) or language(rel) is None:
            continue
        with open(os.path.join(root, rel), "rb") as f:
            data = f.read()
        digests[rel] = legacy_list.digest(data)
        results[rel] = check_source(rel, data.decode("utf-8", errors="replace"))
    return results, digests


def main(argv=None):
    ap = argparse.ArgumentParser(description="Check the comment rule of AGENTS.md.")
    ap.add_argument("--root", default=".")
    ap.add_argument("--legacy", default="tools/ci/legacy.txt")
    ap.add_argument("--base-legacy")
    ap.add_argument("--seed", action="store_true")
    a = ap.parse_args(argv)
    root = os.path.abspath(a.root)
    results, digests = collect(root, legacy_list.tracked_files(root))
    if a.seed:
        print("\n".join(legacy_list.seed_lines("comments", results, digests)))
        return 0
    legacy = legacy_list.read(os.path.join(root, a.legacy), "comments")
    base = legacy_list.read(a.base_legacy, "comments") if a.base_legacy else None
    errors = legacy_list.apply(results, digests, legacy, base, a.legacy)
    for e in errors:
        print(e)
    print("comments: %d files, %d on the legacy list, %d problems" % (len(results), legacy_list.skipped(results, digests, legacy), len(errors)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())