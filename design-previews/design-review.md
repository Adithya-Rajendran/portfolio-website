# Living Future — design iteration and independent reviews

Chosen direction: **A living future + Quiet stars**.

This remains a local homepage concept on `redesign/editorial-rebuild`, not a published replacement. Original production application code and Sanity content are unchanged.

## Review brief

Prioritize writing and an online voice around robotic vision, robotics, AI, and humanity's next steps. Preserve a subtle, optimistic sci-fi atmosphere with architectural scale, charcoal/navy/cream/copper colors, and stars across the background. Keep LinkedIn and RSS as follow routes. Make work and résumé accessible for future internship and full-time applications, without claiming unconfirmed education, availability, or experience.

Three independent subagents reviewed the previous design: editorial/reader experience; technical recruiting; and founder/CEO/investor communication. The founder review also considered explicitly hypothetical Musk- and Huang-inspired engineering questions grounded in public primary sources.

## Critique and implementation

| Finding                                                                        | Implemented response                                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Background picker interrupts the first impression after a direction was chosen | Archive the comparison in `observatory-variations.html`; open the current preview directly on the chosen scene.     |
| Hero gives more space to the atmosphere than to identity and writing           | Reduce headline to two lines and shorten the opening; retain the scale and human context of the habitat.            |
| Introductory copy is too broad                                                 | State the published Canonical role and describe robotic vision as an area of exploration.                           |
| Resume and work require hunting                                                | Place Work and Résumé in the header, with a compact experience/code section below the writing.                      |
| No obvious first article for a new reader                                      | Curate the actual DGX Spark article under “Start here,” preserving its March 6 date and accurate technical summary. |
| Small-screen summaries are hidden                                              | Keep summaries readable on mobile; preserve chronological dates for the remaining recent notes.                     |
| Following is buried at the end                                                 | Surface RSS in navigation and writing links; include LinkedIn in the hero and final follow section.                 |
| Image caption competes with content                                            | Move the concept-art disclosure into a discreet footer credit.                                                      |

## Audience assessment

- **Readers:** The site explains what interests Adithya and gives an immediate published article to read, with a clear way to follow subsequent writing.
- **Recruiters:** Canonical, concrete systems work, résumé, and code are easy to find. Existing material demonstrates Linux/cloud/GPU systems; future published vision experiments should establish robotics ability.
- **Technical CEOs:** The publication should reveal how its author frames problems, understands constraints, tests approaches, and explains decisions. The design now gets readers to that evidence sooner.
- **Investors meeting a potential future founder:** Distinctive observations earned through experiments will matter more than startup language or unsupported market claims. This remains a personal publication.

## Public-leader lenses: interpretation, not predicted personal reactions

Neither Elon Musk nor Jensen Huang has reviewed this site. These are useful hypothetical questions inferred from public priorities; they are not quotes, endorsements, or claims about aesthetic preferences.

**Musk-inspired engineering lens:** Connect ambition to specific constraints, tested work, and an execution path. His historical 2016 roadmap connects its larger mission to staged products, manufacturing, and scale. For future posts, identify the constraint tackled, the experiment performed, and the next change the evidence suggests.

Source: [Elon Musk, Master Plan, Part Deux (2016)](https://www.tesla.com/master-plan-part-deux).

**Huang-inspired computing/robotics lens:** Explain how perception, computing, simulation, and deployment fit into a working system. NVIDIA's March 2026 robotics announcement discusses that full-stack connection. For future vision notes, useful evidence includes actual inputs/outputs, evaluation, failure cases, and code. The DGX Spark article is a genuine infrastructure starting point; it is not proof of an unbuilt robotics system.

Source: [NVIDIA and Global Robotics Leaders Take Physical AI to the Real World (March 16, 2026)](https://nvidianews.nvidia.com/news/nvidia-and-global-robotics-leaders-take-physical-ai-to-the-real-world).

## Verification and second reviews

- Browser checked at widths 320, 390, 768, 1120, 1440, and 1920 px.
- No horizontal overflow; headline fits; article summaries remain visible.
- At 1120 × 900, the featured article title appears at approximately y=677–752 in the opening viewport.
- Chosen artwork loads; stars span the page; writing anchor, résumé URL, and reduced-motion behavior checked.
- No JavaScript page errors.
- Independent editorial, recruiter, and founder/CEO/investor second reviews found no material visual blocker. All identified future content depth as the next priority.

Article, archive, work, and résumé links currently open the live site as part of this standalone preview. They should become normal same-tab internal navigation in the completed rebuild.
