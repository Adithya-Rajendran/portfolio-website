# Rules for this repository

This file gives the rules for work in this repository.
Only this file states these rules.
Other files can link to a section of this file.

## Program work

Read the program plan and your task card before you change a file.
The plan is `/srv/arcadia/work/orch/program-plan.md`.
Sections 5 and 6 of the plan give the rules for branches, pull requests, commits, evidence, file owners and stop conditions.

- Do not merge into `v2-rewrite` or `main`. These branches contain a different site.
- Do not write a network address, a host name, a token or an email address in a file, a commit or a pull request. Write "the CI host".
- Keep the plans, the status, the decisions and the reports out of the repository. Keep them in `/srv/arcadia/work/orch/`.

## Code comments

1. Start each source file with one header comment on one line.
2. In the header, tell what the file contains. Do not give an explanation, a reason, a decision or a history.
3. Do not write other comments.
4. Put reasons and evidence in the pull request.

The rule applies to these files:

- JavaScript and TypeScript: `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts` and `.tsx`, with the GLSL in their strings.
- Python: `.py`, with docstrings.
- Shell: `.sh` and `.bash`. PowerShell: `.ps1`.
- CSS: `.css`. HTML: `.html` and `.htm`, with their scripts and styles.
- Dockerfiles.

These items are not comments for the rule:

- A shebang on line 1, and `<!doctype html>` before the header.
- Text in a string that is not GLSL, and text in HTML attributes.
- The marks that `tools/site.py` replaces: `<!--site:head-->` and `<!--site:page-->`.
- These tool directives, with only rule names after them:
  `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line`, `eslint-enable`,
  `@ts-expect-error`, `@ts-nocheck`, `@ts-check`, `@vite-ignore`, `@__PURE__`, `#__PURE__`,
  `/// <reference ... />`, `prettier-ignore`, `stylelint-disable`, `stylelint-enable`,
  `# noqa`, `# type:` with a type or `ignore`, `# pragma: no cover`, `# -*- coding: ... -*-`, `# fmt: off`, `# fmt: on`, `# fmt: skip`,
  `# shellcheck disable=`, `#Requires` with `-Version`, `-Modules`, `-RunAsAdministrator` or `-PSEdition`, and the Dockerfile directives `# syntax=`, `# escape=` and `# check=`.

The rule does not apply to these files:

- The files in `public/vendor/`.
- The files that a tool makes: the files in `public/asset-catalogue/`, and `public/lighting-review/index.html`.
- Empty files.

## Documentation

Write the product documentation in Markdown.
The rules apply to each Markdown file in the repository, with these exceptions:

- `AGENTS.md` and `CLAUDE.md`: only the language rules apply.
- The posts and the projects in `data/posts/` and `data/projects/`.
- The test data in `tools/testdata/`, and the files in `public/vendor/`.

### Modules

The modules follow the Red Hat modular documentation guide.

1. Put one module in each file.
2. Give each module one type: concept, procedure, reference or assembly.
3. Start the file name with the prefix of its type: `con_`, `proc_`, `ref_` or `assembly_`. Use the name `glossary.md` for the glossary, which is a reference.
4. Start each module with a front matter block. Use only the keys `type`, `title` and `depends`.
5. Use one first-level heading, at the start. Make it the same as the title.
6. In a concept, tell what a thing is and how it works. Do not write steps in a concept.
7. In a procedure, write the section "Procedure". You can also write these sections, in this sequence: "Prerequisites" before it, and "Verification", "Troubleshooting", "Next steps" and "Additional resources" after it.
8. In the "Procedure" section, write only a numbered list of steps. You can put a code block under a step. Write one action in each step, in one sentence. Do not put "and" or "then" between two actions.
9. In a reference, give the facts in tables or lists. Use only one sentence in a paragraph.
10. In an assembly, write the title, one sentence that tells the purpose, and a list of links to modules. Do not add other text.
11. Do not write comments in a module.

This block is an example of front matter:

```markdown
---
type: procedure
title: Remove a file from the legacy list
depends: [AGENTS.md, docs/ref_doc-checks.md]
---
```

### Dependency graph

1. Write each fact in one module only. In other modules, link to that module.
2. In `depends`, write the path of each Markdown file that the module links to, and no other path. Use paths from the root of the repository.
3. Do not make a cycle in the `depends` graph.
4. Make each module available through links from [the documentation index](docs/assembly_index.md).
5. Make sure that each link goes to a file and a heading that exist.
6. Do not write the same sentence or paragraph in two modules. The check also finds sentences and paragraphs that are almost the same.

### Language

Write in ASD-STE100 Simplified Technical English (STE), with the project glossary.
These rules are a subset of STE that a tool or a review can check.

1. Use only approved words. The approved words are the general words in `.vale/styles/config/dictionaries/ste.dic` and the terms in [the glossary](glossary.md).
2. Use each word with its one meaning.
3. Before you use a new technical name or technical verb, add it to the glossary with one meaning.
4. Write a maximum of 20 words in a sentence of a procedure. Write a maximum of 25 words in a sentence of other text.
5. Write a maximum of six sentences in a paragraph.
6. Write one instruction in each sentence.
7. Use the active voice.
8. Use the imperative in the steps of a procedure.
9. Do not use idioms or slang.
10. Use a maximum of three nouns in a noun cluster.
11. Use only the simple tenses: the past, the present and the future.
12. Write about one topic in each paragraph.

### Checks

The `static` tier runs the checks.
This table shows the rules that a tool checks and the rules that a review checks.

| Rule | Check |
|---|---|
| Code comments 1 and 3, the file types, the directives and the exceptions | `tools/comments/check.py` |
| Code comments 2 | Review. `tools/comments/check.py` finds some words of explanation and history. |
| Modules 1 to 11 | `tools/docs/check.py` |
| Dependency graph 2 to 6 | `tools/docs/check.py` |
| Dependency graph 1 | Review. `tools/docs/check.py` finds the duplicates that rule 6 tells about. |
| Language 1, 4, 5 and 9 | Vale, with the rules in `.vale/` |
| Language 7 | Vale finds some forms of the passive. Review finds the other forms. |
| Language 6 and 8, in the steps of a procedure | `tools/docs/check.py` |
| Language 2, 3, 10, 11 and 12 | Review |

### Legacy list

The file `tools/ci/legacy.txt` lists the files that do not obey these rules yet.
The checks do not examine a file on the list while its hash agrees with the hash on the list.

1. Do not add a line to the list, and do not change a line.
2. When you change a file on the list, make the file obey the rules, and remove its line.
3. When a file on the list obeys the rules, remove its line. If you do not remove the line, the check fails.