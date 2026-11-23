---
title: "When should a robot look again?"
name: "Robot scene-memory pilot"
summary: "A first camera pilot for checking whether a remembered object has been removed or is hidden. Capture and verification code is built; comparison of view-selection policies is the next experiment."
order: 6
status: active
status_note: "Development pilot: four objects, twelve query images, one camera position. Held-out evaluation is pending."
types: [research, hardware, software]
technologies: ["Python", "NumPy", "OpenCV", "YOLO-World", "DINOv2", "Raspberry Pi"]
role: "Capture tooling, verification, and study design"
started: 2026-09-08
date_precision: month
dates_approximate: false
featured: 2
cover: 12840419b409b9b20e54683e668a4d2a76e26f67-1536x864.jpg
cover_alt: "Four shelf views showing a reference, two occlusions, and a removed chess clock."
cover_caption: "First development pilot: one viewpoint and lighting condition. The evidence code was adjusted on these images."
problem: "A missed detection is ambiguous: the object may have moved, become hidden, or simply been missed by the detector."
approach: "I combine reference-image matching, image-quality checks, and obstruction cues. The planned study will vary the next camera view while keeping the verification rule and sensing budget fixed."
highlights:
  - "Built Raspberry Pi capture tooling, registration checks, an offline verification core, and synthetic tests."
  - "Analyzed four targets across twelve query images at one viewpoint; adjusted the evidence checks after observing failures."
  - "Designed an arrangement-separated evaluation of view selection; held-out results are still pending."
links:
  - label: "Project repository"
    kind: repo
    url: "https://github.com/Adithya-Rajendran/cmpe249-active-verification"
---
## What the first pilot changed

The verifier initially called two book occlusions removals. Adding a novelty cue and changing the sharpness check moved the development score from 45/48 to 48/48 target-query decisions on the same photos. Those decisions share images and objects; they are not 48 independent tests.

The public pilot notes show examples and explain the changes. Raw captures and the full analysis table are currently local.

## The next experiment

Freeze the evidence code, capture unseen arrangements, and compare fixed-order and geometric view selectors before adding a learned ranker. Report false removals, decision coverage, and views used under the same budget.

The current pilot uses one viewpoint, so it cannot yet answer whether adaptive view selection helps. The planned replay study measures geometric travel cost; it will not establish robot energy use or closed-loop navigation performance.

## Evidence sources

[First real pilot notes](https://github.com/Adithya-Rajendran/cmpe249-active-verification/tree/ab4d7131d334b0675a5443256af75a14feae5a4f/notes/2026-10-17-first-real-pilot.md)

[Experiment protocol](https://github.com/Adithya-Rajendran/cmpe249-active-verification/tree/ab4d7131d334b0675a5443256af75a14feae5a4f/docs/EXPERIMENT_PLAN.md)
