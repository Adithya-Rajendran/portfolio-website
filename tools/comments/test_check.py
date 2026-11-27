# Unit tests for tools/comments/check.py and the shared legacy list rule.
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = importlib.util.spec_from_file_location("comments_check", os.path.join(HERE, "check.py"))
cc = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cc)
BT = chr(96)


def problems(path, src):
    return cc.check_source(path, src)


class HeaderTest(unittest.TestCase):
    def test_header_only_passes(self):
        self.assertEqual(problems("a.js", "// Room loader for the engine.\nexport const a = 1;\n"), [])
        self.assertEqual(problems("a.py", "# Page generator for the posts.\nimport os\n"), [])
        self.assertEqual(problems("a.sh", "#!/bin/bash\n# Preview server for one branch.\necho hi\n"), [])
        self.assertEqual(problems("a.css", "/* Styles of the reader. */\nbody { color: red; }\n"), [])
        self.assertEqual(problems("a.html", "<!doctype html>\n<!-- The station shell. -->\n<html></html>\n"), [])
        self.assertEqual(problems("a.ps1", "# Bake runner for one room.\nWrite-Host hi\n"), [])
        self.assertEqual(problems("Dockerfile", "# syntax=docker/dockerfile:1\n# Blender image for the bake host.\nFROM ubuntu\n"), [])

    def test_missing_header_fails(self):
        self.assertIn("line 1: the file must start with one header comment line", problems("a.js", "export const a = 1;\n"))
        self.assertIn("line 2: the file must start with one header comment line", problems("a.sh", "#!/bin/bash\necho hi\n"))

    def test_header_with_explanation_fails(self):
        got = problems("a.js", "// Room loader, because the old one was slow.\nexport const a = 1;\n")
        self.assertTrue(any("explanation or a history" in p for p in got), got)
        got = problems("a.js", "// Room loader. It loads rooms.\nexport const a = 1;\n")
        self.assertTrue(any("more than one sentence" in p for p in got), got)
        got = problems("a.js", "// Room loader (D22).\nexport const a = 1;\n")
        self.assertTrue(any("explanation or a history" in p for p in got), got)

    def test_multi_line_header_fails(self):
        got = problems("a.js", "/* Room loader\n   for the engine. */\nexport const a = 1;\n")
        self.assertTrue(any("header" in p for p in got), got)
        got = problems("a.js", "// Room loader.\n// It loads rooms.\nexport const a = 1;\n")
        self.assertIn("line 2: comment // It loads rooms.", got)

    def test_empty_file_passes(self):
        self.assertEqual(problems("a.py", ""), [])


class StrayCommentTest(unittest.TestCase):
    def test_js(self):
        got = problems("a.js", "// Loader.\nconst a = 1; // why\n/* block */\n")
        self.assertEqual(got, ["line 2: comment // why", "line 3: comment /* block */"])

    def test_js_strings_regex_and_templates_are_not_comments(self):
        src = ("// Loader.\nconst u = 'http://x/*y*/';\nconst r = /a\\/\\/b/g;\nconst s = \"//no\";\n"
               "const t = " + BT + "a // b $" "{ x /* c */ } d" + BT + ";\nconst q = a / b / c;\n")
        self.assertEqual(problems("a.js", src), ["line 5: comment /* c */"])

    def test_glsl_in_strings(self):
        src = "// Shaders.\nconst f = " + BT + "\nuniform float t;\nvoid main() {\n  // tint\n  gl_FragColor = vec4(1.0);\n}\n" + BT + ";\n"
        self.assertEqual(problems("a.js", src), ["line 5: comment // tint"])
        src = "// Shaders.\nconst f = 'void main() { gl_FragColor = vec4(1.0); /* x */ }';\n"
        self.assertEqual(problems("a.js", src), ["line 2: comment /* x */"])
        src = "// Links.\nconst f = " + BT + "see http://example.org/a" + BT + ";\n"
        self.assertEqual(problems("a.js", src), [])

    def test_js_directives(self):
        src = ("// Loader.\n// eslint-disable-next-line no-console\nconsole.log(1);\n// @ts-expect-error\nx();\n"
               "import(/* @vite-ignore */ u);\n/// <reference types=\"vite/client\" />\n")
        self.assertEqual(problems("a.ts", src), [])
        got = problems("a.ts", "// Loader.\n// eslint-disable-next-line no-console -- it is fine\nconsole.log(1);\n")
        self.assertEqual(len(got), 1)
        got = problems("a.ts", "// Loader.\n// @ts-expect-error the types are wrong\nx();\n")
        self.assertEqual(len(got), 1)

    def test_python_comments_and_docstrings(self):
        src = '# Generator.\n"""Module doc."""\nimport os  # noqa: F401\nx = "# not a comment"\n\n\ndef f():\n    """Doc."""\n    return 1  # why\n'
        self.assertEqual(problems("a.py", src), ["line 2: docstring", "line 8: docstring", "line 9: comment # why"])

    def test_python_directives(self):
        src = "#!/usr/bin/env python3\n# -*- coding: utf-8 -*-\n# Generator.\nx = 1  # type: int\ny = 2  # pragma: no cover\n"
        self.assertEqual(problems("a.py", src), [])

    def test_shell(self):
        src = ("#!/bin/bash\n# Runner.\necho \"$#\" $" "{#x} 'a # b' \"c # d\"\nx=a#b\n"
               "cat <<'EOF'\n# inside a heredoc\nEOF\necho hi # why\n# shellcheck disable=SC2086\n")
        self.assertEqual(problems("a.sh", src), ["line 8: comment # why"])

    def test_css(self):
        src = "/* Styles. */\na { content: \"/* no */\"; }\n/* stray */\n"
        self.assertEqual(problems("a.css", src), ["line 3: comment /* stray */"])

    def test_html(self):
        src = ("<!doctype html>\n<!-- Shell. -->\n<!--site:head-->\n<!-- stray -->\n<style>/* css */</style>\n"
               "<script>// js\n</script>\n<script type=\"importmap\">{\"a\": \"//b\"}</script>\n")
        self.assertEqual(problems("a.html", src), ["line 4: comment <!-- stray -->", "line 5: comment /* css */", "line 6: comment // js"])

    def test_powershell(self):
        src = "# Runner.\n$a = 'x # y'\n<# block #>\nWrite-Host a # why\n"
        self.assertEqual(problems("a.ps1", src), ["line 3: comment <# block #>", "line 4: comment # why"])

    def test_dockerfile(self):
        src = "# Image.\nFROM ubuntu\n# stray\nRUN echo a#b\n"
        self.assertEqual(problems("Dockerfile", src), ["line 3: comment # stray"])

    def test_exempt_paths(self):
        self.assertTrue(cc.is_exempt("public/vendor/three.module.js"))
        self.assertTrue(cc.is_exempt("public/asset-catalogue/index.html"))
        self.assertFalse(cc.is_exempt("public/main.js"))
        self.assertIsNone(cc.language("README.md"))


class LegacyTest(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="comments-check-test-")
        os.makedirs(os.path.join(self.root, "tools", "ci"))
        self.write("good.js", "// Loader.\nexport const a = 1;\n")
        self.write("bad.js", "export const a = 1; // why\n")

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def write(self, path, text):
        with open(os.path.join(self.root, path), "w", encoding="utf-8") as f:
            f.write(text)

    def run_check(self, *extra):
        cmd = [sys.executable, os.path.join(HERE, "check.py"), "--root", self.root] + list(extra)
        return subprocess.run(cmd, capture_output=True, text=True)

    def seed(self):
        out = self.run_check("--seed").stdout
        self.write("tools/ci/legacy.txt", out)
        return out

    def test_seed_lists_only_failing_files(self):
        out = self.seed()
        self.assertEqual(len(out.strip().split("\n")), 1)
        self.assertIn(" bad.js", out)
        self.assertEqual(self.run_check().returncode, 0)

    def test_changed_legacy_file_is_checked(self):
        self.seed()
        self.write("bad.js", "export const a = 2; // why\n")
        r = self.run_check()
        self.assertEqual(r.returncode, 1)
        self.assertIn("bad.js: line 1", r.stdout)

    def test_compliant_legacy_file_must_leave_the_list(self):
        self.seed()
        self.write("bad.js", "// Loader.\nexport const a = 1;\n")
        r = self.run_check()
        self.assertEqual(r.returncode, 1)
        self.assertIn("obeys the rules now", r.stdout)

    def test_list_must_not_grow(self):
        self.seed()
        base = os.path.join(self.root, "base.txt")
        with open(base, "w") as f:
            f.write("")
        r = self.run_check("--base-legacy", base)
        self.assertEqual(r.returncode, 1)
        self.assertIn("must not grow", r.stdout)

    def test_removed_file_must_leave_the_list(self):
        self.seed()
        os.remove(os.path.join(self.root, "bad.js"))
        r = self.run_check()
        self.assertEqual(r.returncode, 1)
        self.assertIn("not a checked file", r.stdout)

    def test_new_file_is_checked(self):
        self.seed()
        self.write("new.js", "export const b = 1;\n")
        r = self.run_check()
        self.assertEqual(r.returncode, 1)
        self.assertIn("new.js: line 1", r.stdout)


if __name__ == "__main__":
    unittest.main()
