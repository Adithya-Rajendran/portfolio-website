#!/usr/bin/env python3
# Documentation checker: modules, front matter, dependency graph, links, duplicates, glossary and the Vale language check.
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ci"))
import legacy as legacy_list  # noqa: E402

BT = chr(96)
TYPES = {"concept": "con_", "procedure": "proc_", "reference": "ref_", "assembly": "assembly_"}
FIXED = {"glossary.md": "reference"}
RULE_FILES = ("AGENTS.md", "CLAUDE.md")
INDEX = "docs/assembly_index.md"
GLOSSARY = "glossary.md"
EXCLUDED = ("data/posts/", "data/projects/", "tools/testdata/", "public/vendor/", "node_modules/", "dist/", ".agent-chat/")
KEYS = ("type", "title", "depends")
PROCEDURE_SECTIONS = ["Prerequisites", "Procedure", "Verification", "Troubleshooting", "Next steps", "Additional resources"]
GLOSSARY_HEADER = ["Term", "Kind", "Forms", "Meaning"]
GLOSSARY_KINDS = ("name", "verb")
MIN_SENTENCE_WORDS = 6
NEAR_SENTENCE_WORDS = 8
NEAR_SENTENCE = 0.85
MIN_PARAGRAPH_WORDS = 15
NEAR_PARAGRAPH = 0.6
LINK = re.compile(r"(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
REF_DEF = re.compile(r"^\s{0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+[\"'(].*)?$")
HTML_LINK = re.compile(r"<a\s[^>]*?\bhref\s*=\s*[\"']([^\"']+)[\"']", re.IGNORECASE)
REF_USE = re.compile(r"\[([^\]]+)\]\[[^\]]*\]")
FENCE = re.compile(r"^\s*(" + BT * 3 + r"|~~~)")
INLINE_CODE = re.compile(BT + r"+[^" + BT + r"]*" + BT + r"+")
SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\[(\"'" + BT + r"])")
NUMBERED = re.compile(r"^\s*\d+[.)]\s+")
BULLET = re.compile(r"^\s*[-*+]\s+")
MULTI_ACTION = re.compile(r";")
JOINED = re.compile(r"\b(?:and|then)\s+(?:then\s+)?([A-Za-z]+)", re.IGNORECASE)


class Doc:
    def __init__(self, path, text):
        self.path = path
        self.text = text
        self.meta = None
        self.meta_end = 0
        self.problems = []
        self.blocks = []
        self.links = []
        self.headings = []


def in_scope(path):
    return path.endswith(".md") and not path.startswith(EXCLUDED)


def kind_of(path):
    if path in RULE_FILES:
        return "rules"
    return "module"


def parse_list(value):
    value = value.strip()
    if not (value.startswith("[") and value.endswith("]")):
        return None
    inner = value[1:-1].strip()
    return [x.strip() for x in inner.split(",") if x.strip()] if inner else []


def parse_front_matter(doc):
    lines = doc.text.split("\n")
    if not lines or lines[0].strip() != "---":
        doc.problems.append("line 1: the file must start with a front matter block (---)")
        return
    meta = {}
    for i in range(1, len(lines)):
        line = lines[i]
        if line.strip() == "---":
            doc.meta_end = i + 1
            break
        m = re.match(r"^([a-z]+):\s*(.*)$", line)
        if not m:
            doc.problems.append("line %d: front matter lines must be 'key: value'" % (i + 1))
            continue
        key, value = m.group(1), m.group(2).strip()
        if key not in KEYS:
            doc.problems.append("line %d: unknown front matter key %r (use %s)" % (i + 1, key, ", ".join(KEYS)))
            continue
        if key in meta:
            doc.problems.append("line %d: the key %r is in the front matter two times" % (i + 1, key))
        meta[key] = value
    else:
        doc.problems.append("line 1: the front matter block has no end (---)")
        return
    for key in KEYS:
        if key not in meta:
            doc.problems.append("line 1: the front matter has no %r" % key)
    if "type" in meta and meta["type"] not in TYPES:
        doc.problems.append("line 1: type must be one of %s, not %r" % (", ".join(TYPES), meta["type"]))
    if "depends" in meta:
        deps = parse_list(meta["depends"])
        if deps is None:
            doc.problems.append("line 1: depends must be a list in brackets, for example [glossary.md]")
            deps = []
        meta["depends"] = deps
    doc.meta = meta


def strip_code(text):
    return INLINE_CODE.sub("X", text)


def parse_body(doc, start):
    lines = doc.text.split("\n")
    in_fence = False
    current = None
    for n in range(start, len(lines)):
        line = lines[n]
        if FENCE.match(line):
            if not in_fence:
                current = None
                doc.blocks.append({"kind": "code", "line": n + 1, "text": "", "indent": len(line) - len(line.lstrip())})
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        spaced = INLINE_CODE.sub(lambda x: " " * len(x.group(0)), line)
        d = REF_DEF.match(spaced)
        if d:
            doc.links.append((n + 1, d.group(2)))
            current = None
            doc.blocks.append({"kind": "linkdef", "line": n + 1, "text": ""})
            continue
        for m in LINK.finditer(spaced):
            doc.links.append((n + 1, m.group(3)))
        for m in HTML_LINK.finditer(spaced):
            doc.links.append((n + 1, m.group(1)))
        if "<!--" in INLINE_CODE.sub("", line):
            doc.problems.append("line %d: a module must not contain comments" % (n + 1))
        if not line.strip():
            current = None
            continue
        h = re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", line)
        if h:
            current = None
            doc.blocks.append({"kind": "heading", "level": len(h.group(1)), "line": n + 1, "text": h.group(2)})
            doc.headings.append(h.group(2))
            continue
        if line.lstrip().startswith("|"):
            if current is None or current["kind"] != "table":
                current = {"kind": "table", "line": n + 1, "rows": []}
                doc.blocks.append(current)
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if not all(re.match(r"^:?-+:?$", c) for c in cells):
                current["rows"].append((n + 1, cells))
            continue
        if NUMBERED.match(line) or BULLET.match(line):
            numbered = bool(NUMBERED.match(line))
            item = NUMBERED.sub("", line, count=1) if numbered else BULLET.sub("", line, count=1)
            current = {"kind": "item", "numbered": numbered, "line": n + 1, "text": item.strip(), "indent": len(line) - len(line.lstrip())}
            doc.blocks.append(current)
            continue
        if current is not None and current["kind"] in ("paragraph", "item"):
            current["text"] += " " + line.strip()
            continue
        current = {"kind": "paragraph", "line": n + 1, "text": line.strip()}
        doc.blocks.append(current)


def sentences(text):
    plain = strip_code(REF_USE.sub(lambda m: m.group(1), LINK.sub(lambda m: m.group(2), text))).strip()
    return [s.strip() for s in SENTENCE_END.split(plain) if s.strip()] if plain else []


def heading_slugs(headings):
    out, seen = set(), {}
    for x in headings:
        s = slug(x)
        if s in seen:
            seen[s] += 1
            out.add("%s-%d" % (s, seen[s]))
        else:
            seen[s] = 0
            out.add(s)
    return out


def slug(heading):
    s = strip_code(LINK.sub(lambda m: m.group(2), heading)).strip().lower()
    s = re.sub(r"[^\w\- ]", "", s)
    return s.replace(" ", "-")


def resolve(doc_path, target):
    path, _, anchor = target.partition("#")
    if not path:
        return doc_path, anchor
    base = os.path.dirname(doc_path)
    joined = os.path.normpath(os.path.join(base, path)).replace(os.sep, "/")
    return joined, anchor


def check_type(doc, verbs):
    t = doc.meta.get("type")
    blocks = [b for b in doc.blocks]
    h1 = [b for b in blocks if b["kind"] == "heading" and b["level"] == 1]
    if len(h1) != 1:
        doc.problems.append("line %d: a module must have exactly one first-level heading" % (h1[1]["line"] if len(h1) > 1 else doc.meta_end + 1))
    elif blocks and blocks[0] is not h1[0]:
        doc.problems.append("line %d: the first-level heading must come first" % h1[0]["line"])
    if h1 and doc.meta.get("title") and h1[0]["text"] != doc.meta["title"]:
        doc.problems.append("line %d: the heading %r is not the title %r" % (h1[0]["line"], h1[0]["text"], doc.meta["title"]))
    body = [b for b in blocks if b not in h1]
    if t == "assembly":
        paras = [b for b in body if b["kind"] == "paragraph"]
        others = [b for b in body if b["kind"] not in ("paragraph", "item", "linkdef")]
        if len(paras) != 1 or len(sentences(paras[0]["text"])) != 1:
            doc.problems.append("line %d: an assembly has one paragraph of one sentence (its purpose)" % (paras[1]["line"] if len(paras) > 1 else doc.meta_end + 1))
        for b in others:
            doc.problems.append("line %d: an assembly contains only its title, its purpose and a list of links" % b["line"])
        items = [b for b in body if b["kind"] == "item"]
        if not items:
            doc.problems.append("line %d: an assembly must have a list of links" % (doc.meta_end + 1))
        for b in items:
            if not re.fullmatch(r"\[[^\]]+\](?:\([^)\s]+\.md(#[^)]*)?\)|\[[^\]]*\])", b["text"]):
                doc.problems.append("line %d: each item of an assembly is one link to a module, and nothing else" % b["line"])
        if paras and body and body.index(paras[0]) != 0:
            doc.problems.append("line %d: the purpose comes before the links" % paras[0]["line"])
    elif t == "procedure":
        h2 = [b for b in body if b["kind"] == "heading" and b["level"] == 2]
        names = [b["text"] for b in h2]
        order = [PROCEDURE_SECTIONS.index(x) if x in PROCEDURE_SECTIONS else -1 for x in names]
        if "Procedure" not in names or -1 in order or order != sorted(set(order)):
            doc.problems.append("line %d: a procedure has a Procedure section, and only these sections in this sequence: %s (found %s)" % (h2[0]["line"] if h2 else doc.meta_end + 1, ", ".join(PROCEDURE_SECTIONS), ", ".join(names) or "none"))
        if "Procedure" in names:
            k = names.index("Procedure")
            i = body.index(h2[k])
            j = body.index(h2[k + 1]) if k + 1 < len(h2) else len(body)
            section = body[i + 1:j]
            steps = [b for b in section if b["kind"] == "item" and b["numbered"]]
            if not steps:
                doc.problems.append("line %d: the Procedure section must have a numbered list of steps" % body[i]["line"])
            last = None
            for b in section:
                if b in steps:
                    last = "step"
                    continue
                if b["kind"] == "code" and b["indent"] >= 2 and last in ("step", "code"):
                    last = "code"
                    continue
                doc.problems.append("line %d: the Procedure section contains only numbered steps, with code blocks indented under a step" % b["line"])
            for b in steps:
                text = strip_code(LINK.sub(lambda m: m.group(2), b["text"]))
                if len(sentences(b["text"])) != 1:
                    doc.problems.append("line %d: a step is one sentence" % b["line"])
                if MULTI_ACTION.search(text) or any(m.group(1).lower() in verbs for m in JOINED.finditer(text)):
                    doc.problems.append("line %d: a step has one action" % b["line"])
                words = re.findall(r"[A-Za-z][\w-]*", text)
                if not words or words[0].lower() not in verbs:
                    doc.problems.append("line %d: a step starts with an approved verb in the imperative (found %r)" % (b["line"], words[0] if words else ""))
    elif t == "concept":
        for b in body:
            if b["kind"] == "item" and b["numbered"]:
                doc.problems.append("line %d: a concept has no steps (numbered lists)" % b["line"])
    elif t == "reference":
        if not any(b["kind"] in ("table", "item") for b in body):
            doc.problems.append("line %d: a reference gives its facts in tables or lists" % (doc.meta_end + 1))
        for b in body:
            if b["kind"] == "paragraph" and len(sentences(b["text"])) > 1:
                doc.problems.append("line %d: a paragraph in a reference is one sentence" % b["line"])


def glossary_terms(doc):
    terms, problems = [], []
    tables = [b for b in doc.blocks if b["kind"] == "table"]
    if len(tables) != 1:
        return terms, ["the glossary has exactly one table"]
    rows = tables[0]["rows"]
    if not rows or rows[0][1] != GLOSSARY_HEADER:
        return terms, ["line %d: the glossary table has the columns %s" % (tables[0]["line"], " | ".join(GLOSSARY_HEADER))]
    seen = set()
    last = ""
    for line, cells in rows[1:]:
        if len(cells) != 4:
            problems.append("line %d: a glossary row has four cells" % line)
            continue
        term, kind, forms, meaning = cells
        key = term.lower()
        if key in seen:
            problems.append("line %d: %r is in the glossary two times" % (line, term))
        if key < last:
            problems.append("line %d: %r is not in alphabetical sequence" % (line, term))
        seen.add(key)
        last = key
        if kind not in GLOSSARY_KINDS:
            problems.append("line %d: the kind of %r is %s" % (line, term, " or ".join(GLOSSARY_KINDS)))
        if len(sentences(meaning)) != 1:
            problems.append("line %d: %r has one meaning, in one sentence" % (line, term))
        form_list = [f.strip() for f in forms.split(",") if f.strip() and f.strip() != "-"]
        terms.append((term, kind, form_list))
    return terms, problems


def words(text):
    return re.findall(r"[a-z0-9]+", strip_code(LINK.sub(lambda m: m.group(2), text)).lower())


def units(doc):
    out = []
    for b in doc.blocks:
        if b["kind"] in ("paragraph", "item"):
            out.append((b["line"], b["kind"], b["text"]))
        elif b["kind"] == "table":
            for line, cells in b["rows"]:
                for c in cells:
                    out.append((line, "cell", c))
    return out


def jaccard(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def shingles(ws, k=3):
    return {tuple(ws[i:i + k]) for i in range(max(0, len(ws) - k + 1))}


def duplicates(docs, report):
    found = []
    sents, paras = [], []
    for d in docs:
        for line, kind, text in units(d):
            for s in sentences(text):
                ws = words(s)
                if len(ws) >= MIN_SENTENCE_WORDS:
                    sents.append((d, line, " ".join(ws), set(ws), len(ws)))
            ws = words(text)
            if kind == "paragraph" and len(ws) >= MIN_PARAGRAPH_WORDS:
                paras.append((d, line, shingles(ws)))

    def pick(a, b):
        if b[0].path in report:
            return b, a
        if a[0].path in report:
            return a, b
        return None, None

    seen = {}
    for item in sents:
        norm = item[2]
        if norm in seen and seen[norm][0] is not item[0]:
            mine, other = pick(seen[norm], item)
            if mine:
                found.append((mine[0], "line %d: the same sentence is in %s line %d" % (mine[1], other[0].path, other[1])))
        seen.setdefault(norm, item)
    near = [s for s in sents if s[4] >= NEAR_SENTENCE_WORDS]
    for i, a in enumerate(near):
        if a[0].path not in report:
            continue
        for j, b in enumerate(near):
            if a[0] is b[0] or a[2] == b[2] or (b[0].path in report and j < i):
                continue
            if jaccard(a[3], b[3]) >= NEAR_SENTENCE:
                found.append((a[0], "line %d: a sentence is almost the same as %s line %d" % (a[1], b[0].path, b[1])))
    for i, a in enumerate(paras):
        if a[0].path not in report:
            continue
        for j, b in enumerate(paras):
            if a[0] is b[0] or (b[0].path in report and j < i):
                continue
            if jaccard(a[2], b[2]) >= NEAR_PARAGRAPH:
                found.append((a[0], "line %d: a paragraph is almost the same as %s line %d" % (a[1], b[0].path, b[1])))
    return found


def check_links(doc, root, docs_by_path, exists):
    linked = set()
    for line, target in doc.links:
        if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.IGNORECASE):
            continue
        if target.startswith("/"):
            doc.problems.append("line %d: use a relative link, not %r" % (line, target))
            continue
        path, anchor = resolve(doc.path, target)
        if not exists(path):
            doc.problems.append("line %d: the link %r goes to a file that does not exist" % (line, target))
            continue
        if path.endswith(".md"):
            if path != doc.path:
                linked.add(path)
            if anchor:
                other = docs_by_path.get(path)
                if other is None:
                    try:
                        with open(os.path.join(root, path), encoding="utf-8") as f:
                            other = Doc(path, f.read())
                        parse_body(other, 0)
                    except OSError:
                        other = Doc(path, "")
                if anchor not in heading_slugs(other.headings):
                    doc.problems.append("line %d: the link %r goes to a heading that does not exist" % (line, target))
    return linked


def cycles(graph):
    found, state, stack = [], {}, []

    def visit(n):
        state[n] = 1
        stack.append(n)
        for m in sorted(graph.get(n, ())):
            if m not in graph:
                continue
            if state.get(m) == 1:
                found.append(stack[stack.index(m):] + [m])
            elif m not in state:
                visit(m)
        stack.pop()
        state[n] = 2

    for n in sorted(graph):
        if n not in state:
            visit(n)
    return found


def load_verbs(root, terms):
    verbs = set()
    path = os.path.join(root, ".vale", "verbs.txt")
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            verbs |= {w.strip().lower() for w in f if w.strip()}
    for term, kind, forms in terms:
        if kind == "verb":
            verbs.add(term.lower())
    return verbs


def vocab_entries(terms):
    out = set()
    for term, _, forms in terms:
        for w in [term] + forms:
            for part in re.split(r"\s+", w.strip()):
                if not part:
                    continue
                esc = re.escape(part)
                if part[0].isalpha() and part[0].islower():
                    esc = "[%s%s]%s" % (part[0].upper(), part[0], re.escape(part[1:]))
                out.add(esc)
    return sorted(out)


def run_vale(vale, root, paths, terms):
    if not paths:
        return {}
    tmp = tempfile.mkdtemp(prefix="arcadia-vale-")
    try:
        styles = os.path.join(tmp, "styles")
        shutil.copytree(os.path.join(root, ".vale", "styles"), styles)
        vocab = os.path.join(styles, "config", "vocabularies", "Glossary")
        os.makedirs(vocab, exist_ok=True)
        with open(os.path.join(vocab, "accept.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(vocab_entries(terms)) + "\n")
        with open(os.path.join(root, ".vale", "vale.ini"), encoding="utf-8") as f:
            ini = f.read()
        ini = re.sub(r"(?m)^StylesPath\s*=.*$", lambda m: "StylesPath = " + styles, ini)
        config = os.path.join(tmp, "vale.ini")
        with open(config, "w", encoding="utf-8") as f:
            f.write(ini)
        proc = subprocess.run([vale, "--config", config, "--output", "JSON", "--no-exit"] + paths, cwd=root, capture_output=True, text=True)
        if proc.returncode != 0 or not proc.stdout.strip().startswith("{"):
            raise SystemExit("vale failed (exit %d): %s" % (proc.returncode, (proc.stderr or proc.stdout)[:2000]))
        data = json.loads(proc.stdout)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    out = {}
    for path, alerts in data.items():
        rel = os.path.relpath(os.path.join(root, path), root).replace(os.sep, "/")
        out[rel] = ["line %d: %s (%s)" % (a["Line"], a["Message"], a["Check"]) for a in alerts]
    return out


def check(root, files, vale=None, legacy=None, base=None, legacy_name="tools/ci/legacy.txt", exists=None):
    legacy = legacy or {}
    file_set = set(files)
    exists = exists or (lambda p: p in file_set or os.path.exists(os.path.join(root, p)))
    paths = [p for p in files if in_scope(p)]
    datas = {}
    for p in paths:
        with open(os.path.join(root, p), "rb") as f:
            datas[p] = f.read()
    digests = {p: legacy_list.digest(d) for p, d in datas.items()}
    docs = {}
    for p in paths:
        d = Doc(p, datas[p].decode("utf-8", errors="replace"))
        if kind_of(p) == "module":
            parse_front_matter(d)
        parse_body(d, d.meta_end)
        docs[p] = d
    terms = []
    if GLOSSARY in docs and docs[GLOSSARY].meta is not None:
        terms, gp = glossary_terms(docs[GLOSSARY])
        docs[GLOSSARY].problems += gp
    elif GLOSSARY not in docs:
        terms = []
    verbs = load_verbs(root, terms)
    frozen = {p for p in paths if p in legacy and legacy[p] == digests[p]}
    for p, d in docs.items():
        if kind_of(p) == "rules":
            check_links(d, root, docs, exists)
            continue
        base_name = os.path.basename(p)
        if d.meta is not None:
            t = d.meta.get("type")
            want = FIXED.get(p)
            if want:
                if t != want:
                    d.problems.append("line 1: %s is a %s" % (p, want))
            elif t in TYPES and not base_name.startswith(TYPES[t]):
                d.problems.append("line 1: the file name of a %s starts with %r" % (t, TYPES[t]))
            elif not any(base_name.startswith(x) for x in TYPES.values()):
                d.problems.append("line 1: the file name starts with con_, proc_, ref_ or assembly_")
            if t in TYPES:
                check_type(d, verbs)
        linked = check_links(d, root, docs, exists)
        if d.meta is not None and isinstance(d.meta.get("depends"), list):
            deps = set(d.meta["depends"])
            for dep in sorted(deps - linked):
                d.problems.append("line 1: depends lists %s, but the module has no link to it" % dep)
            for dep in sorted(linked - deps):
                d.problems.append("line 1: the module links to %s, but depends does not list it" % dep)
    active = {p: d for p, d in docs.items() if p not in frozen}
    modules = {p: d for p, d in active.items() if kind_of(p) == "module" and d.meta is not None}
    graph = {p: set(d.meta.get("depends") or []) for p, d in modules.items()}
    for cyc in cycles(graph):
        docs[cyc[0]].problems.append("line 1: depends makes a cycle: %s" % " -> ".join(cyc))
    if any(kind_of(p) == "module" for p in active):
        if INDEX not in modules:
            for p in sorted(x for x in active if kind_of(x) == "module" and x != INDEX):
                docs[p].problems.append("the docs index %s is not available, so the module is not reachable" % INDEX)
        else:
            reach, todo = {INDEX}, [INDEX]
            while todo:
                cur = todo.pop()
                for nxt in check_links_targets(docs[cur]):
                    if nxt in modules and nxt not in reach:
                        reach.add(nxt)
                        todo.append(nxt)
            for p in sorted(modules):
                if p not in reach:
                    docs[p].problems.append("no link path from %s goes to this module" % INDEX)
    for d, msg in duplicates(list(docs.values()), set(active)):
        d.problems.append(msg)
    if vale:
        for p, alerts in run_vale(vale, root, paths, terms).items():
            if p in docs:
                docs[p].problems += alerts
    results = {p: d.problems for p, d in docs.items()}
    return results, digests


def check_links_targets(doc):
    out = []
    for _, target in doc.links:
        if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.IGNORECASE) or target.startswith("/"):
            continue
        path, _ = resolve(doc.path, target)
        if path.endswith(".md"):
            out.append(path)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="Check the documentation rules of AGENTS.md.")
    ap.add_argument("--root", default=".")
    ap.add_argument("--legacy", default="tools/ci/legacy.txt")
    ap.add_argument("--base-legacy")
    ap.add_argument("--vale")
    ap.add_argument("--no-vale", action="store_true")
    ap.add_argument("--seed", action="store_true")
    a = ap.parse_args(argv)
    if not a.vale and not a.no_vale:
        ap.error("give --vale <path> or --no-vale")
    root = os.path.abspath(a.root)
    legacy = legacy_list.read(os.path.join(root, a.legacy), "docs")
    base = legacy_list.read(a.base_legacy, "docs") if a.base_legacy else None
    files = legacy_list.tracked_files(root)
    results, digests = check(root, files, None if a.no_vale else a.vale, {} if a.seed else legacy, base, a.legacy)
    if a.seed:
        print("\n".join(legacy_list.seed_lines("docs", results, digests)))
        return 0
    errors = legacy_list.apply(results, digests, legacy, base, a.legacy)
    for e in errors:
        print(e)
    print("docs: %d files, %d on the legacy list, %d problems" % (len(results), legacy_list.skipped(results, digests, legacy), len(errors)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())