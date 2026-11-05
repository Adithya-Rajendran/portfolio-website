# Adithya Rajendran writing guide

Version 1.1 · 5 November 2026

Use this guide when drafting, editing, or reviewing my technical posts. It applies to human collaborators and AI assistants. The intended voice is a measured first-person engineering notebook: personal decisions, clear evidence, and occasional dry humor.

## The reader and the promise

Write for technically literate builders who may be new to this particular topic. They can follow a system diagram or read a command, but may not know this platform, acronym, or failure mode. Explain the local context without reteaching the whole field.

Most readers arrive directly at an article from another platform. Each post must stand on its own. Establish the problem, the useful finding, and the limits before asking the reader to explore the rest of the site.

The primary objective is to earn a returning audience. The secondary objectives are to demonstrate engineering judgment to employers and build research credibility. Useful explanations and inspectable work serve all three. Résumé language inside an article usually serves none of them.

The promise: **I will show what I tried, why I chose it, what the evidence supports, and what remains unresolved. You should leave with a better decision or a usable method.**

## Voice

- Use **I** for my actions, observations, and decisions. Use **we** only for a real group whose contribution is identified. Use **you** for reader instructions and consequences.
- Sound like an engineer explaining a decision to another capable builder. Be direct, curious, and specific. Confidence comes from showing the work.
- Include personal judgment: “I chose X because Y mattered more than Z.” State the cost of that choice.
- Admit uncertainty exactly where it matters. “I did not retest this configuration” is more useful than a paragraph of vague caution.
- Use contractions when they sound natural. Formality is optional; precision is not.
- Let rhythm vary. A short sentence can deliver a result. A longer sentence can connect the conditions that make it true.
- Do not use em dashes (Unicode U+2014) in authored writing, including titles, descriptions, body text, takeaways, captions, and alternative text. Rewrite with a full stop, comma, colon, semicolon, or parentheses as the sentence requires. Do not substitute a double hyphen or an en dash as a sentence break. Preserve exact code and command options; paraphrase and cite a quotation rather than silently changing its punctuation.
- Use dry humor sparingly, after the technical point is clear. It should arise from the situation, never ridicule a reader or disguise a limitation. Zero jokes is a valid draft.

Avoid forced enthusiasm, “game-changing,” “seamless,” “unlock,” “delve,” “ultimate guide,” generic technology history, and dramatic openings that delay the actual subject. Do not announce that a result is impressive; give the reader enough evidence to judge it.

Do not fabricate a personal memory, frustration, discovery, motivation, experiment, or quote to make a draft sound more human. Ask for the missing experience or write around it.

## How we use ASD-STE100

This is an **STE-informed house style**, not an ASD-STE100 compliance claim. ASD-STE100 is a controlled language developed for technical documentation, especially maintenance instructions. Its discipline is useful here; its complete vocabulary and procedural constraints are not the voice of this blog.

Borrow these habits:

- Prefer a clear subject and active verb.
- Give a technical term one consistent meaning within the post. Avoid synonyms merely for variety.
- Define unfamiliar terms on first useful use, then use the standard term.
- Keep a paragraph focused on one topic.
- Put conditions before the action they govern. Identify what “it,” “this,” and “they” refer to.
- Separate actions when sequence or failure matters. State the expected result.

Keep necessary technical vocabulary, personal interpretation, equations, and natural prose. Do not replace an established engineering term with an imprecise everyday word. Passive voice is acceptable when the actor is unknown or irrelevant; do not hide responsibility with it.

As a house editing prompt, inspect sentences longer than about 25 words, and inspect procedural steps containing several actions. Split them only when clarity improves. Sentence length is not a quality score, and this guide does not enforce the standard’s dictionary or certify compliance.

Reference: the [official STE FAQ](https://www.asd-ste100.org/STE_faq.html) and [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf). These sources describe the standard; the adaptations above are our editorial decisions.

## Evidence comes before polish

Every consequential claim needs an identifiable basis. Keep these distinctions visible in the wording:

| Claim type           | Wording to prefer                                   | What must support it                                           |
| -------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Observed             | “In these three runs, the host stopped responding…” | Logs, notes, traces, or a clearly identified observation       |
| Tested               | “This configuration passed…”                        | Exact configuration, test, outcome, and relevant sample count  |
| Inferred             | “This suggests…” or “My working explanation is…”    | Evidence and the reasoning connecting it to the interpretation |
| Proposed             | “The next test is…” or “I would try…”               | A question or hypothesis, not an invented outcome              |
| Documented elsewhere | “The documentation specifies…”                      | A direct source that supports this claim                       |
| Unknown              | “I have not measured…”                              | A precise boundary on what can be concluded                    |

A plausible mechanism is not proof of causation. A passing unit test is not a successful deployment. A repository’s first commit is not necessarily the project’s first day. A design intended to be recoverable is not a verified recovery procedure.

State the relevant environment: hardware, software versions, workload, dataset, measurement method, and meaningful settings. Include only the context needed to interpret or reproduce the finding; move exhaustive details to a linked artifact.

Keep a limitation next to the claim it qualifies. Do not put an exciting unconditional result in the title and withdraw it at the bottom. Repeat a limitation only when a later section would otherwise become misleading on its own.

### Numbers and comparisons

- Name the metric and units. Give the denominator for percentages and the baseline for improvements.
- Distinguish percentage points from relative percentage changes. Distinguish peak from sustained performance, a spot reading from an average, and GPU power from whole-system power.
- State sample counts and variation when available. If there was one run, say so. Do not invent uncertainty estimates.
- Use precision justified by the measurement. Keep the original values in the evidence even if the prose rounds them.
- Separate training from inference, throughput from latency, allocated memory from resident memory, and scheduling slots from physical devices when these distinctions affect the result.
- Compare systems under stated conditions. A local experiment does not establish a universal ranking.

## Article structure

Use the following sequence as a default, not as a mandatory set of headings. Keep sections that earn their place. A short field note may need only four paragraphs and a code block.

1. **Title:** the concrete problem, mechanism, or decision. Prefer “Keeping a DGX Spark reachable under memory pressure” to an unsupported promise that crashes are solved.
2. **Description:** one or two sentences explaining the situation and what the reader will learn. Add scope where it changes the promise.
3. **Opening:** establish what happened or what needed deciding, why it matters, and the useful finding. Usually do this within the first 100–150 words. Avoid a generic introduction to AI, containers, or computing.
4. **Key takeaways, when useful:** two to four short statements covering the finding, the important constraint, and the practical consequence. They must remain true when read without the article. Do not repeat the description in bullet form.
5. **Necessary context:** introduce the system and the specific mechanism needed to understand the problem. Define jargon here, close to use.
6. **Investigation or method:** show observations, alternatives, and the decision. Explain why the apparently obvious fix was insufficient if the evidence supports that account.
7. **Result:** report what actually happened, with evidence and scope. Include failures that change the recommendation.
8. **Limits and next question:** explain what is still unknown, and the next test that would reduce that uncertainty.
9. **A useful next step:** choose one relevant article or project and explain why it follows. Let the site’s author/follow component handle the recurring invitation to return.

Use descriptive headings such as “Why the Docker limit did not protect the host.” A heading should tell a scanning reader what the section contributes. Do not make every heading a question or every paragraph a contrast between two slogans.

### Choose the right shape

| Post type                  | Organizing sequence                                                                | Essential detail                                                  |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| How-to                     | Goal → prerequisites → actions → verification → recovery → limits                  | What success looks like and how to reverse a consequential change |
| Experiment                 | Question → hypothesis → setup → results → interpretation → next test               | Baseline, conditions, evidence, and uncertainty                   |
| Incident or debugging note | Symptom → observations → hypotheses → tests → current explanation → remaining gaps | Chronology only where it explains the diagnosis                   |
| Architecture or decision   | Constraint → options → trade-offs → choice → consequences                          | Why the choice fits this workload and when it would not           |
| Short field note           | Observation → explanation → implication → open question                            | One useful idea, honestly bounded                                 |

## Explain for newcomers without losing experts

Give the reader three layers: the practical consequence, the mechanism that causes it, and the evidence needed to inspect it. A specialist can move quickly to the latter two; a newcomer has a reason to keep reading.

Introduce an acronym once if the expansion helps. Explain a mechanism with a concrete example before adding formal notation when possible. Keep the domain’s real terminology so readers can search for it later.

Use an analogy only if it preserves the relationship being explained. Say where it breaks when that boundary matters. Do not turn every system into a brain, orchestra, or traffic network.

Explain commands and settings at the decision level: what they change, why that matters, and the observable result. Avoid narrating obvious syntax line by line.

Use a table for a genuine comparison and a diagram for a relationship that prose makes difficult to track. Prefer prose when a table would contain mostly sentences with no meaningful comparison.

## Code, procedures, and reproducibility

- Identify the tested platform and version near the procedure. A documentation review is not a fresh execution of the commands.
- Keep executable code exact. Editorial simplification must not change an API name, flag, path, unit, or error message.
- Label placeholders clearly. Do not disguise a sample domain, identifier, or credential as a real value.
- State prerequisites and meaningful permissions before the action. Explain commands that delete data, broaden access, restart services, or change host configuration before showing them.
- Use the minimum privileges the procedure requires. Do not add `sudo` or a download-and-execute command merely to make an example shorter.
- After a meaningful step, show how to verify the intended state. Distinguish **observed output** from **illustrative expected output**.
- Include recovery or cleanup where a step has persistent consequences. Do not imply that a reversible configuration change restores lost data.
- Link a pinned commit, release, configuration, or result artifact when the conclusion depends on that exact version. A moving default branch is convenient navigation, but weak evidence for a historical result.

If a command or claim has not been checked, keep an explicit internal marker such as `[VERIFY: version and expected output]` in the draft. Resolve it before publication or turn it into a clear reader-facing limitation. Never silently fill the gap with a plausible value.

## Sources, images, and dates

Prefer primary documentation, papers, source code, logs, and original measurements. Place a source beside the claim it supports. Name what a linked artifact contains: “configuration used for the test” is more useful than “here.”

Distinguish other people’s findings from my results. Credit collaborators and describe my contribution accurately. Cite a paper’s actual finding rather than borrowing its authority for a broader claim.

Use captions to explain what a plot or screenshot shows, under which conditions, and what the reader should notice. Label axes and units. Include useful alternative text for substantive images. Label illustrative diagrams and mockups so they cannot be mistaken for measurements or observed screens.

Keep publication date, substantive revision date, experiment date, and project start date distinct. Use a day only when the evidence warrants that precision. Store exact supported dates when available, but display month or year where that is the meaningful level of precision. Preserve an honest change note when an update changes a conclusion, procedure, or important number.

Do not refresh a post’s date merely to make old work look current. When only the wording changes, do not imply that the experiment was rerun.

## Examples of the voice

These are editorial examples. Statements about actual work must still be checked against its evidence.

| Avoid                                                        | Prefer                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| “This revolutionary setup unlocks seamless GPU sharing.”     | “MicroK8s can advertise several scheduling slots for the GPU. Those slots still share its memory and execution resources.”                 |
| “The guard prevents the machine from running out of memory.” | “The guard targets Docker workloads. I have not validated the current thresholds across workloads, and it does not cover Kubernetes pods.” |
| “We implemented a robust recovery architecture.”             | “I made each layer’s bootstrap dependency explicit. The design still needs a documented recovery test.”                                    |
| “The machine consumes 195.1 W.”                              | “The meter showed 195.1 W at that moment. I did not measure an average over the workload.”                                                 |
| “Obviously, containers provide isolation.”                   | “The container separates application dependencies. Sharing the host’s display sockets gives it access that matters to the trust boundary.” |

An acceptable dry aside might be: “The fourth scheduling slot did not come with a fourth GPU.” Use it only after explaining time-slicing. Avoid inserting a joke into a warning, an error-recovery step, or a claim that is already easy to misunderstand.

## Brief for a collaborator

Before drafting, collect:

- The intended reader and the decision or capability the post should improve.
- One sentence stating the main claim and its scope.
- The author’s actual observations, choices, reasons, and contribution.
- Source material: notes, commands, logs, configurations, commits, measurements, images, and relevant documentation.
- What was tested, what changed afterward, and what remains unknown.
- The required format, approximate length, and publication context.
- A plausible next article or project, if one exists.

Ask a focused question when missing information would change the conclusion, invent an experience, or make a procedure unsafe or misleading. Proceed with minor editorial choices. Do not ask the author to approve every heading.

Draft the argument before polishing sentences. For a long or empirical post, keep a private claim ledger with four columns: claim, supporting artifact, scope, and unresolved question. Remove the ledger from the public article unless it is useful to readers.

## Review before publication

An article is ready when all of these are true:

- A reader arriving directly from a link can identify the problem and useful finding near the beginning.
- The title, description, takeaways, and conclusion make compatible promises.
- First-person statements reflect the author’s real work and judgment.
- Observations, inferences, proposals, and unknowns are distinguishable.
- Important numbers have units, baselines, and enough context to interpret them.
- Instructions identify their environment, expected result, and relevant recovery step.
- Links support the nearby claims; images and code match the described version.
- A technically literate newcomer can follow the mechanism without guessing at unexplained terms.
- An expert can inspect the evidence and identify the limits without hunting for a disclaimer.
- The ending offers a useful continuation. It does not repeat the whole post or stack several competing requests.
- Dates and revision notes describe the actual work. No internal verification markers remain.
- A final search finds no em dashes in the authored prose or publishing fields. Hyphens in technical terms and commands, and en dashes in numeric or date ranges, remain valid.

Then read the opening and ending aloud. Remove sentences that sound like promotion, apologize for ordinary uncertainty, or repeat something the reader already knows.

## Website publishing fields

Keep the article body focused on the story. Use the site’s reusable fields for recurring elements:

- **Description:** the short promise shown in previews and the article header.
- **Key takeaways:** two to four self-contained statements, up to 240 characters each. Optional for short notes. Include the most consequential limitation.
- **Sharing image:** a dedicated 1200 × 630 title card with readable text and alternative text. This is separate from the optional in-article cover image.
- **Read next:** one published, relevant post, plus a short reason to continue. Avoid circular recommendations that offer no new question or capability.
- **Revisions:** record substantive changes accurately. The author and follow section is generated by the template.

Do not duplicate the template’s author biography, follow buttons, or takeaway box inside the article body. Reassess these defaults after observing how real readers use them; more components do not automatically mean more returning readers.

## Reusable drafting prompt

Copy this prompt with the guide and the source material:

> Draft a technical post in Adithya Rajendran’s measured first-person engineering-notebook voice. Write for technically literate builders who may be new to the topic. Follow the attached writing guide.
>
> Reader outcome: [the decision or capability this post should improve].
> Main claim and scope: [one sentence].
> Post type and approximate length: [how-to, experiment, incident, decision, or field note].
> Author’s actual observations and choices: [notes].
> Evidence and references: [artifacts and links].
> Known limitations and untested changes: [list].
>
> First identify any missing facts that would materially change the article. Ask focused questions for those facts; make reasonable minor editorial choices. Do not invent measurements, personal experiences, quotations, test results, or citations. Preserve technical terminology and exact code. Separate observation, inference, proposal, and uncertainty. Use STE’s clarity principles without claiming compliance or flattening the voice. Include occasional dry humor only if it arises naturally. Do not use em dashes in any authored prose or publishing fields. Rewrite the sentence instead of substituting another dash as a sentence break, and check the final draft for Unicode U+2014.
>
> Return a title, description, optional two-to-four key takeaways, article body, and one suggested next read with a reason. Keep unresolved evidence questions separate from the draft. Check that the title and takeaways preserve the result’s most important limits.
