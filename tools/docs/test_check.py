# Unit tests for tools/docs/check.py, with the Vale cases when VALE names a Vale binary.
import importlib.util
import os
import shutil
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SPEC = importlib.util.spec_from_file_location("docs_check", os.path.join(HERE, "check.py"))
dc = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dc)
VALE = os.environ.get("VALE")
BT = chr(96)

GLOSSARY = """---
type: reference
title: Glossary
depends: []
---
# Glossary

This table gives the approved technical names and technical verbs.

| Term | Kind | Forms | Meaning |
|---|---|---|---|
| bake | verb | bakes, baked | To calculate the light of a room and keep it in textures. |
| concept | name | concepts | A module that tells what a thing is. |
| room | name | rooms | One of the six areas of the station. |
| station | name | - | The site as one place with six rooms. |
"""

INDEX = """---
type: assembly
title: Index
depends: [glossary.md, docs/con_station.md]
---
# Index

This assembly gives the modules.

- [Glossary](../glossary.md)
- [The station](con_station.md)
"""

CONCEPT = """---
type: concept
title: The station
depends: []
---
# The station

The station has six rooms. Each room has a name and a path.
"""


def fm(kind, title, depends=""):
    return "---\ntype: %s\ntitle: %s\ndepends: [%s]\n---\n# %s\n\n" % (kind, title, depends, title)


class Tree:
    def __init__(self, files, vale_style=False):
        self.root = tempfile.mkdtemp(prefix="docs-check-test-")
        self.files = dict(files)
        if vale_style:
            shutil.copytree(os.path.join(REPO, ".vale"), os.path.join(self.root, ".vale"))
        else:
            os.makedirs(os.path.join(self.root, ".vale"))
            shutil.copy(os.path.join(REPO, ".vale", "verbs.txt"), os.path.join(self.root, ".vale", "verbs.txt"))
        for path, text in self.files.items():
            full = os.path.join(self.root, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as f:
                f.write(text)

    def run(self, vale=None, legacy=None, base=None):
        return dc.check(self.root, sorted(self.files), vale=vale, legacy=legacy, base=base)

    def close(self):
        shutil.rmtree(self.root, ignore_errors=True)


def base_files(**extra):
    files = {"glossary.md": GLOSSARY, "docs/assembly_index.md": INDEX, "docs/con_station.md": CONCEPT}
    files.update(extra)
    return files


class DocsCheckTest(unittest.TestCase):
    def check(self, files, **kw):
        t = Tree(files, vale_style=kw.pop("vale_style", False))
        try:
            return t.run(**kw)
        finally:
            t.close()

    def problems(self, files, path, **kw):
        results, _ = self.check(files, **kw)
        return results[path]

    def assertProblem(self, files, path, text, **kw):
        got = self.problems(files, path, **kw)
        self.assertTrue(any(text in p for p in got), "%r not in %r" % (text, got))

    def test_valid_tree_has_no_problems(self):
        results, _ = self.check(base_files())
        self.assertEqual({p: v for p, v in results.items() if v}, {})

    def test_missing_front_matter(self):
        self.assertProblem(base_files(**{"docs/con_station.md": "# The station\n\nThe station has six rooms.\n"}), "docs/con_station.md", "front matter")

    def test_unknown_key_and_type(self):
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("type: concept", "type: tutorial\nowner: me")})
        got = self.problems(files, "docs/con_station.md")
        self.assertTrue(any("unknown front matter key" in p for p in got))
        self.assertTrue(any("type must be one of" in p for p in got))

    def test_file_name_prefix_must_match_type(self):
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("type: concept", "type: reference")})
        self.assertProblem(files, "docs/con_station.md", "starts with 'ref_'")

    def test_title_must_match_heading(self):
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("# The station", "# A station")})
        self.assertProblem(files, "docs/con_station.md", "is not the title")

    def test_assembly_with_extra_text_fails(self):
        files = base_files(**{"docs/assembly_index.md": INDEX + "\nThe station is good.\n"})
        self.assertProblem(files, "docs/assembly_index.md", "one paragraph of one sentence")
        files = base_files(**{"docs/assembly_index.md": INDEX + "\n## More\n"})
        self.assertProblem(files, "docs/assembly_index.md", "contains only its title")
        files = base_files(**{"docs/assembly_index.md": INDEX.replace("- [The station](con_station.md)", "- [The station](con_station.md) and more")})
        self.assertProblem(files, "docs/assembly_index.md", "one link to a module")

    def test_procedure_rules(self):
        good = fm("procedure", "Bake a room") + "## Prerequisites\n\n- The room has a model.\n\n## Procedure\n\n1. Bake the room.\n2. Check the textures.\n\n## Verification\n\n- The room has textures.\n"
        index = INDEX.replace("depends: [glossary.md, docs/con_station.md]", "depends: [glossary.md, docs/con_station.md, docs/proc_bake.md]") + "- [Bake a room](proc_bake.md)\n"
        results, _ = self.check(base_files(**{"docs/proc_bake.md": good, "docs/assembly_index.md": index}))
        self.assertEqual(results["docs/proc_bake.md"], [])
        optional = good.replace("## Verification\n\n- The room has textures.\n", "").replace("## Prerequisites\n\n- The room has a model.\n\n", "")
        self.assertEqual(self.problems(base_files(**{"docs/proc_bake.md": optional, "docs/assembly_index.md": index}), "docs/proc_bake.md"), [])
        more = good + "\n## Troubleshooting\n\n- Bake the room again.\n\n## Next steps\n\n- Pack the room.\n\n## Additional resources\n\n- The glossary.\n"
        self.assertEqual(self.problems(base_files(**{"docs/proc_bake.md": more, "docs/assembly_index.md": index}), "docs/proc_bake.md"), [])
        bad = good.replace("## Procedure", "## Steps")
        self.assertProblem(base_files(**{"docs/proc_bake.md": bad, "docs/assembly_index.md": index}), "docs/proc_bake.md", "sections in this sequence")
        bad = good.replace("## Prerequisites\n\n- The room has a model.\n\n", "") + "\n## Prerequisites\n\n- The room has a model.\n"
        self.assertProblem(base_files(**{"docs/proc_bake.md": bad, "docs/assembly_index.md": index}), "docs/proc_bake.md", "sections in this sequence")
        bad = good.replace("## Verification", "## Notes")
        self.assertProblem(base_files(**{"docs/proc_bake.md": bad, "docs/assembly_index.md": index}), "docs/proc_bake.md", "sections in this sequence")
        fence = BT * 3
        code = good.replace("1. Bake the room.\n", "1. Bake the room.\n\n   " + fence + "sh\n   python3 tools/pack.py\n   " + fence + "\n\n")
        self.assertEqual(self.problems(base_files(**{"docs/proc_bake.md": code, "docs/assembly_index.md": index}), "docs/proc_bake.md"), [])
        loose = good.replace("1. Bake the room.\n", "1. Bake the room.\n\n" + fence + "sh\npython3 tools/pack.py\n" + fence + "\n\n")
        self.assertProblem(base_files(**{"docs/proc_bake.md": loose, "docs/assembly_index.md": index}), "docs/proc_bake.md", "indented under a step")
        for joined in ["Open the file and run the check.", "Open the file, run the check.", "Open the file or run the check."]:
            bad = good.replace("2. Check the textures.", "2. " + joined)
            self.assertProblem(base_files(**{"docs/proc_bake.md": bad, "docs/assembly_index.md": index}), "docs/proc_bake.md", "one action")
        intro = good.replace("# Bake a room\n\n", "# Bake a room\n\nThis procedure bakes one room.\n\n")
        self.assertEqual(self.problems(base_files(**{"docs/proc_bake.md": intro, "docs/assembly_index.md": index}), "docs/proc_bake.md"), [])
        long_intro = good.replace("# Bake a room\n\n", "# Bake a room\n\nThis bakes a room. It takes time. It uses the GPU.\n\n")
        self.assertProblem(base_files(**{"docs/proc_bake.md": long_intro, "docs/assembly_index.md": index}), "docs/proc_bake.md", "one short introduction")
        two = good.replace("# Bake a room\n\n", "# Bake a room\n\nThis bakes a room.\n\nIt uses the GPU.\n\n")
        self.assertProblem(base_files(**{"docs/proc_bake.md": two, "docs/assembly_index.md": index}), "docs/proc_bake.md", "one short introduction")
        fine = good.replace("2. Check the textures.", "2. Compare the old and new textures.")
        self.assertEqual(self.problems(base_files(**{"docs/proc_bake.md": fine, "docs/assembly_index.md": index}), "docs/proc_bake.md"), [])
        bad = good.replace("2. Check the textures.", "2. The textures are good.")
        self.assertProblem(base_files(**{"docs/proc_bake.md": bad, "docs/assembly_index.md": index}), "docs/proc_bake.md", "approved verb")
        bad = good.replace("2. Check the textures.", "2. Check the textures. Bake the room.")
        self.assertProblem(base_files(**{"docs/proc_bake.md": bad, "docs/assembly_index.md": index}), "docs/proc_bake.md", "one sentence")
        bad = good.replace("2. Check the textures.", "2. Bake the room and then check the textures.")
        self.assertProblem(base_files(**{"docs/proc_bake.md": bad, "docs/assembly_index.md": index}), "docs/proc_bake.md", "one action")

    def test_concept_has_no_steps(self):
        files = base_files(**{"docs/con_station.md": CONCEPT + "\n1. Bake the room.\n"})
        self.assertProblem(files, "docs/con_station.md", "no steps")

    def test_reference_rules(self):
        ref = fm("reference", "Rooms") + "The rooms are on this list. Each room has a path.\n"
        index = INDEX.replace("depends: [glossary.md, docs/con_station.md]", "depends: [glossary.md, docs/con_station.md, docs/ref_rooms.md]") + "- [Rooms](ref_rooms.md)\n"
        got = self.problems(base_files(**{"docs/ref_rooms.md": ref, "docs/assembly_index.md": index}), "docs/ref_rooms.md")
        self.assertTrue(any("tables or lists" in p for p in got))
        self.assertTrue(any("one sentence" in p for p in got))

    def test_depends_must_equal_links(self):
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("depends: []", "depends: [glossary.md]")})
        self.assertProblem(files, "docs/con_station.md", "has no link to it")
        files = base_files(**{"docs/con_station.md": CONCEPT + "\nRead [the glossary](../glossary.md).\n"})
        self.assertProblem(files, "docs/con_station.md", "depends does not list it")

    def test_cycle_fails(self):
        a = fm("concept", "Alpha", "docs/con_b.md") + "Alpha uses [beta](con_b.md).\n"
        b = fm("concept", "Beta", "docs/con_a.md") + "Beta uses [alpha](con_a.md).\n"
        index = INDEX.replace("depends: [glossary.md, docs/con_station.md]", "depends: [glossary.md, docs/con_station.md, docs/con_a.md]") + "- [Alpha](con_a.md)\n"
        results, _ = self.check(base_files(**{"docs/con_a.md": a, "docs/con_b.md": b, "docs/assembly_index.md": index}))
        self.assertTrue(any("cycle" in p for p in results["docs/con_a.md"] + results["docs/con_b.md"]))

    def test_orphan_fails(self):
        files = base_files(**{"docs/con_other.md": fm("concept", "Other") + "The other room has a path.\n"})
        self.assertProblem(files, "docs/con_other.md", "no link path")

    def test_missing_index_fails(self):
        files = base_files()
        del files["docs/assembly_index.md"]
        self.assertProblem(files, "docs/con_station.md", "not available")

    def test_broken_links_fail(self):
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("depends: []", "depends: [docs/con_none.md]") + "\nSee [none](con_none.md).\n"})
        self.assertProblem(files, "docs/con_station.md", "does not exist")
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("depends: []", "depends: [glossary.md]") + "\nSee [the glossary](../glossary.md#nothing).\n"})
        self.assertProblem(files, "docs/con_station.md", "heading that does not exist")
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("depends: []", "depends: [glossary.md]") + "\nSee [the glossary](../glossary.md#glossary).\n"})
        self.assertEqual(self.problems(files, "docs/con_station.md"), [])

    def test_reference_style_and_html_links_count(self):
        ref = fm("concept", "Alpha", "docs/con_b.md") + "Alpha uses [beta][b].\n\n[b]: con_b.md\n"
        b = fm("concept", "Beta") + "Beta has a path.\n"
        index = INDEX.replace("depends: [glossary.md, docs/con_station.md]", "depends: [glossary.md, docs/con_station.md, docs/con_a.md]") + "- [Alpha](con_a.md)\n"
        results, _ = self.check(base_files(**{"docs/con_a.md": ref, "docs/con_b.md": b, "docs/assembly_index.md": index}))
        self.assertEqual(results["docs/con_a.md"], [])
        self.assertEqual(results["docs/con_b.md"], [])
        html = fm("concept", "Alpha", "docs/con_b.md") + 'Alpha uses <a href="con_b.md">beta</a>.\n'
        results, _ = self.check(base_files(**{"docs/con_a.md": html, "docs/con_b.md": b, "docs/assembly_index.md": index}))
        self.assertEqual(results["docs/con_a.md"], [])
        hidden = fm("concept", "Alpha") + "Alpha uses [beta][b].\n\n[b]: con_none.md\n"
        got = self.problems(base_files(**{"docs/con_a.md": hidden, "docs/assembly_index.md": index}), "docs/con_a.md")
        self.assertTrue(any("does not exist" in p for p in got), got)
        a = fm("concept", "Alpha", "docs/con_b.md") + 'Alpha uses <a href="con_b.md">beta</a>.\n'
        cyc = fm("concept", "Beta", "docs/con_a.md") + "Beta uses [alpha][a].\n\n[a]: con_a.md\n"
        results, _ = self.check(base_files(**{"docs/con_a.md": a, "docs/con_b.md": cyc, "docs/assembly_index.md": index}))
        self.assertTrue(any("cycle" in p for p in results["docs/con_a.md"] + results["docs/con_b.md"]))

    def test_repeated_heading_anchors(self):
        target = fm("concept", "Beta") + "## Use\n\nBeta has a path.\n\n## Use\n\nBeta has a name.\n"
        a = fm("concept", "Alpha", "docs/con_b.md") + "See [the second use](con_b.md#use-1).\n"
        index = INDEX.replace("depends: [glossary.md, docs/con_station.md]", "depends: [glossary.md, docs/con_station.md, docs/con_a.md]") + "- [Alpha](con_a.md)\n"
        results, _ = self.check(base_files(**{"docs/con_a.md": a, "docs/con_b.md": target, "docs/assembly_index.md": index}))
        self.assertEqual(results["docs/con_a.md"], [])

    def test_headings_in_code_of_unchecked_files_are_not_anchors(self):
        fence = BT * 3
        other = "# Old\n\n" + fence + "\n# not a heading\n" + fence + "\n"
        files = base_files(**{"data/posts/old.md": other, "docs/con_station.md": CONCEPT.replace("depends: []", "depends: [data/posts/old.md]") + "\nSee [old](../data/posts/old.md#not-a-heading).\n"})
        self.assertProblem(files, "docs/con_station.md", "heading that does not exist")

    def test_duplicates_of_legacy_files_fail_on_the_new_module(self):
        para = "The engine draws each room with the light that the bake keeps in its textures, and the governor keeps the frame time in its limit."
        old = "# Old notes\n\n" + para + "\n"
        t = Tree(base_files(**{"docs/old.md": old, "docs/con_station.md": CONCEPT + "\n" + para + "\n"}))
        try:
            _, digests = t.run()
            results, _ = t.run(legacy={"docs/old.md": digests["docs/old.md"]})
            self.assertTrue(any("docs/old.md" in p for p in results["docs/con_station.md"]), results["docs/con_station.md"])
            self.assertFalse(any("same" in p for p in results["docs/old.md"]))
        finally:
            t.close()

    def test_hidden_comments_in_link_definitions_fail(self):
        for hidden in ["[//]: # (hidden)", "[note]: <> (hidden)", "[note]: #"]:
            files = base_files(**{"docs/con_station.md": CONCEPT + "\n" + hidden + "\n"})
            self.assertProblem(files, "docs/con_station.md", "hidden comment")
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("depends: []", "depends: [glossary.md]") + "\n[g]: ../glossary.md\n"})
        self.assertProblem(files, "docs/con_station.md", "no link uses the link definition [g]")
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("depends: []", "depends: [glossary.md]") + "\nSee [the glossary][g].\n\n[g]: ../glossary.md\n"})
        self.assertEqual(self.problems(files, "docs/con_station.md"), [])
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("depends: []", "depends: [glossary.md]") + "\nSee [g].\n\n[g]: ../glossary.md\n"})
        self.assertEqual(self.problems(files, "docs/con_station.md"), [])

    def test_setext_headings_are_headings(self):
        files = base_files(**{"docs/con_station.md": CONCEPT.replace("# The station\n", "The station\n===========\n")})
        self.assertEqual(self.problems(files, "docs/con_station.md"), [])
        files = base_files(**{"docs/con_station.md": CONCEPT + "\nUse\n---\n\nThe room has a path.\n",
                              "docs/con_b.md": fm("concept", "Beta", "docs/con_station.md") + "See [use](con_station.md#use).\n"})
        files["docs/assembly_index.md"] = INDEX.replace("depends: [glossary.md, docs/con_station.md]", "depends: [glossary.md, docs/con_station.md, docs/con_b.md]") + "- [Beta](con_b.md)\n"
        results, _ = self.check(files)
        self.assertEqual(results["docs/con_b.md"], [])
        files = base_files(**{"docs/con_station.md": CONCEPT + "\nMore\n====\n"})
        self.assertProblem(files, "docs/con_station.md", "exactly one first-level heading")

    def test_concept_steps_in_other_forms_fail(self):
        for extra in ["> 1. Bake the room.", "## Steps\n\nThe room has a path.", "Step 1: bake the room."]:
            files = base_files(**{"docs/con_station.md": CONCEPT + "\n" + extra + "\n"})
            self.assertProblem(files, "docs/con_station.md", "no steps")

    def test_hyphenated_words_need_approved_parts(self):
        t = Tree(base_files(**{"docs/con_station.md": CONCEPT + "\nThe station has a six-room path.\n"}), vale_style=True)
        try:
            results, _ = dc.check(t.root, sorted(t.files), language=True)
            self.assertEqual(results["docs/con_station.md"], [])
        finally:
            t.close()
        t = Tree(base_files(**{"docs/con_station.md": CONCEPT + "\nThe station has a room-xyzzy path.\n"}), vale_style=True)
        try:
            results, _ = dc.check(t.root, sorted(t.files), language=True)
            self.assertTrue(any("'xyzzy' of 'room-xyzzy'" in p for p in results["docs/con_station.md"]), results)
        finally:
            t.close()

    def test_exclusions_are_the_agents_list(self):
        with open(os.path.join(REPO, "AGENTS.md"), encoding="utf-8") as f:
            agents = f.read()
        for p in dc.EXCLUDED + dc.RULE_FILES:
            self.assertIn(BT + p + BT, agents)
        self.assertTrue(dc.in_scope("node_modules/x.md"))

    def test_comment_in_module_fails(self):
        files = base_files(**{"docs/con_station.md": CONCEPT + "\n<!-- more -->\n"})
        self.assertProblem(files, "docs/con_station.md", "comments")

    def test_duplicate_sentence_fails(self):
        sentence = "The station keeps the light of each room in its textures."
        other = fm("concept", "Light") + sentence + "\n"
        files = base_files(**{"docs/con_station.md": CONCEPT + "\n" + sentence + "\n", "docs/con_light.md": other})
        files["docs/assembly_index.md"] = INDEX.replace("depends: [glossary.md, docs/con_station.md]", "depends: [glossary.md, docs/con_station.md, docs/con_light.md]") + "- [Light](con_light.md)\n"
        results, _ = self.check(files)
        self.assertTrue(any("same sentence" in p for p in results["docs/con_station.md"] + results["docs/con_light.md"]))

    def test_near_duplicate_paragraph_fails(self):
        para_a = "The engine draws each room with the light that the bake keeps in its textures, and the governor keeps the frame time in its limit."
        para_b = "The engine draws each room with the light that the bake keeps in the textures, and the governor keeps the frame time in the limit."
        files = base_files(**{"docs/con_station.md": CONCEPT + "\n" + para_a + "\n", "docs/con_light.md": fm("concept", "Light") + para_b + "\n"})
        files["docs/assembly_index.md"] = INDEX.replace("depends: [glossary.md, docs/con_station.md]", "depends: [glossary.md, docs/con_station.md, docs/con_light.md]") + "- [Light](con_light.md)\n"
        results, _ = self.check(files)
        self.assertTrue(any("almost the same" in p for p in results["docs/con_light.md"] + results["docs/con_station.md"]))

    def test_glossary_rules(self):
        bad = GLOSSARY.replace("| bake | verb |", "| zone | verb |")
        self.assertProblem(base_files(**{"glossary.md": bad}), "glossary.md", "alphabetical")
        bad = GLOSSARY.replace("| room | name |", "| room | thing |")
        self.assertProblem(base_files(**{"glossary.md": bad}), "glossary.md", "the kind of")
        bad = GLOSSARY + "| station | name | - | The site. |\n"
        self.assertProblem(base_files(**{"glossary.md": bad}), "glossary.md", "two times")

    def test_rule_files_have_no_module_rules(self):
        files = base_files(**{"AGENTS.md": "# Rules\n\nRead [the glossary](glossary.md).\n"})
        self.assertEqual(self.problems(files, "AGENTS.md"), [])

    def test_out_of_scope_files_are_not_checked(self):
        results, _ = self.check(base_files(**{"data/posts/a.md": "no front matter\n", "tools/testdata/b.md": "x\n"}))
        self.assertNotIn("data/posts/a.md", results)
        self.assertNotIn("tools/testdata/b.md", results)

    def test_legacy_list(self):
        old = "# Old\n\nNo front matter.\n"
        files = base_files(**{"docs/old.md": old})
        t = Tree(files)
        try:
            results, digests = t.run()
            legacy = {"docs/old.md": digests["docs/old.md"]}
            results, digests = t.run(legacy=legacy)
            self.assertEqual(dc.legacy_list.apply(results, digests, legacy, None, "legacy.txt"), [])
            stale = {"docs/old.md": "0" * 16}
            errors = dc.legacy_list.apply(results, digests, stale, None, "legacy.txt")
            self.assertTrue(any("front matter" in e for e in errors))
            grown = dc.legacy_list.apply(results, digests, legacy, [("int.txt", {})], "legacy.txt")
            self.assertTrue(any("must not grow" in e for e in grown))
            strict = [("int.txt", dict(legacy)), ("ws-opt.txt", {})]
            self.assertTrue(any("ws-opt.txt" in e and "must not grow" in e for e in dc.legacy_list.apply(results, digests, legacy, strict, "legacy.txt")))
            changed = [("int.txt", {"docs/old.md": "1" * 16})]
            self.assertTrue(any("may only be removed" in e for e in dc.legacy_list.apply(results, digests, legacy, changed, "legacy.txt")))
            self.assertEqual(dc.legacy_list.apply(results, digests, legacy, [("int.txt", dict(legacy)), ("ws-ui.txt", dict(legacy))], "legacy.txt"), [])
            clean = {"docs/con_station.md": digests["docs/con_station.md"]}
            results, digests = t.run(legacy=clean)
            self.assertTrue(any("obeys the rules now" in e for e in dc.legacy_list.apply(results, digests, dict(clean, **legacy), None, "legacy.txt")))
        finally:
            t.close()

    def test_vocab_entries(self):
        self.assertEqual(dc.vocab_entries([("bake", "verb", ["bakes"]), ("KTX2", "name", []), ("Red Hat", "name", [])]),
                         sorted(["[Bb]ake", "[Bb]akes", "KTX2", "Red", "Hat"]))


@unittest.skipUnless(VALE and os.path.exists(VALE), "VALE does not name a Vale binary")
class ValeTest(unittest.TestCase):
    def problems(self, text, name="docs/con_station.md"):
        files = base_files(**{name: text})
        t = Tree(files, vale_style=True)
        try:
            results, _ = t.run(vale=VALE)
            return results[name]
        finally:
            t.close()

    def test_clean_text_passes(self):
        self.assertEqual(self.problems(CONCEPT), [])

    def test_glossary_words_pass(self):
        self.assertEqual(self.problems(CONCEPT + "\nThe station bakes the light of each room.\n"), [])

    def test_long_sentence_fails(self):
        long = " ".join(["The station has six rooms"] + ["and the room has a path"] * 5) + ".\n"
        got = self.problems(CONCEPT + "\n" + long)
        self.assertTrue(any("more than 25 words" in p for p in got), got)

    def test_non_glossary_word_fails(self):
        got = self.problems(CONCEPT + "\nThe station has a spaceport.\n")
        self.assertTrue(any("'spaceport' is not an approved word" in p for p in got), got)

    def test_passive_fails(self):
        got = self.problems(CONCEPT + "\nThe room is baked.\n")
        self.assertTrue(any("passive" in p for p in got), got)

    def test_passive_with_an_adverb_or_get_fails(self):
        got = self.problems(CONCEPT + "\nThe room was then baked.\n")
        self.assertTrue(any("passive" in p for p in got), got)
        got = self.problems(CONCEPT + "\nThe room gets baked.\n")
        self.assertTrue(any("passive" in p for p in got), got)

    def test_banned_phrase_fails(self):
        got = self.problems(CONCEPT + "\nThe station has six rooms as well as a path.\n")
        self.assertTrue(any("as well as" in p for p in got), got)

    def test_long_paragraph_fails(self):
        got = self.problems(CONCEPT + "\n" + "The room has a path. " * 7 + "\n")
        self.assertTrue(any("six sentences" in p for p in got), got)

    def test_procedure_sentence_limit_is_20(self):
        step = "Bake the room with the light of the station and keep the light in the textures of the room for the station."
        text = fm("procedure", "Bake a room") + "## Prerequisites\n\n- The room has a model.\n\n## Procedure\n\n1. " + step + "\n\n## Verification\n\n- The room has textures.\n"
        got = self.problems(text, "docs/proc_bake.md")
        self.assertTrue(any("more than 20 words" in p for p in got), got)


if __name__ == "__main__":
    unittest.main()