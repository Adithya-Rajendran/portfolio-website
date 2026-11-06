# Article drafting templates

Use these with [the writing guide](writing-style.md). Choose the shape that matches the work, then remove unused headings and every bracketed instruction. The templates are prompts for evidence, not a requirement to make every post the same length.

Do not use em dashes in the draft or its publishing fields. Rewrite with ordinary punctuation, then search the final text for Unicode U+2014. Preserve exact code and command options.

## Brief and publishing fields

```text
Reader outcome:
Main claim and scope:
Author's observations, decisions, and contribution:
Evidence: logs / measurements / commits / papers / documentation
Tested environment and date:
Untested changes or unresolved questions:

Title:
Description: [one or two sentences; maximum 300 characters]
Key takeaways: [optional; 2–4 statements, maximum 240 characters each]
Sharing image: [1200 × 630 title card and useful alternative text]
Suggested next article:
Reason to read it next: [maximum 220 characters]
```

Keep the takeaways in the CMS field, not duplicated in the article body. The site supplies the author biography and follow links. Publication and revision dates describe editorial history; put experiment dates beside the experiment.

## Experiment or engineering investigation

```text
[Open with the specific problem, the useful finding, and its scope.]

## The question
[What did I need to learn, and what would change my decision?]

## Setup and baseline
[Hardware, software, workload, versions, controls, and measurement method.
Link the configuration or commit. Explain only the context needed to read
the result.]

## What I tried
[Show the important alternatives and why I chose this test. Separate
observations from hypotheses.]

## Results
[Report the actual values, units, sample counts, and variation. Identify
failed runs and unexpected outcomes when they affect the conclusion.]

## What the result supports
[Interpret the evidence. State what it cannot establish and whether any
settings changed after the test.]

## The next test
[Name the remaining question and the experiment that would reduce it.]
```

## How-to

```text
[State what the reader will make work, on which environment, and the most
important limitation.]

## Before starting
[Prerequisites, versions, permissions, and the relevant trust boundary.
Identify whether the procedure was executed or checked against docs.]

## Configure [the specific component]
[Explain why this change is needed. Put conditions and consequences before
commands. Make placeholders explicit.]

[Exact command or configuration]

[Verification step and observed or illustrative expected output]

## Check the complete path
[Verify the user's intended outcome, not merely a running process.]

## When it fails
[Known failure modes, useful diagnostics, and recovery or cleanup.]

## Limits
[What this setup does not provide, and when to choose another approach.]
```

## Architecture or decision note

```text
[Open with the constraint that drove the decision and the choice made.]

## The constraints
[Workload, resources, operating assumptions, and the priority order.]

## The options
[Compare only meaningful alternatives. Include operating cost and
complexity, not just feature lists.]

## Why I chose [the option]
[Explain the mechanism, the trade-off accepted, and my contribution.]

## What I have verified
[Separate implementation, tests, and design intentions. Link evidence.]

## What would change the decision
[Name a threshold, new requirement, or result that would justify revisiting
the choice.]
```

## Short field note

Use four paragraphs when that is enough: what I noticed; how the mechanism works; what this changes for a builder; what remains unknown. Add a command, figure, or source only when it helps. A small useful observation does not need to masquerade as a comprehensive tutorial.

## Maintaining article sharing images

Export published post metadata with `_id`, `title`, `slug`, and `tags` to a local JSON array, then run:

```sh
node scripts/generate-article-cards.mjs posts.json article-cards
```

Review the generated PNGs at a small preview size. Upload each to the corresponding post's **Sharing Image** field in Sanity, supply its alternative text, and publish. The image is separate from the optional in-article cover. Regenerate it if the title changes. The site uses a sharing image first, then the cover, then the site-wide fallback.

The **Suggested Next Article** field is optional. Public pages link only to an available published post; missing, draft, future-dated, deleted, or self references fall back to the existing topic-based recommendation. Use the reason field to explain the connection rather than repeating the next title.
