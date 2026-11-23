---
title: "Gmail filter with an experimental spam classifier"
name: "Gmail spam filter"
summary: "A Gmail API tool that reports suspected spam and can apply a label, with a TF-IDF pipeline comparing classifiers across multiple public email datasets."
order: 1
status: completed
status_note: "Training pipeline revised in October 2026; historical 2025 results are labeled separately."
types: [software]
technologies: ["Python", "Gmail API", "scikit-learn", "TF-IDF", "Logistic regression", "ComplementNB", "Docker"]
role: "Team member (2022); classifier and evaluation (2025–26)"
started: 2022-12-01
ended: 2026-10-03
date_precision: month
dates_approximate: false
cover: 6fe542e74604f9d619cf2856d74d17a377efd37b-1536x1024.webp
cover_alt: "A wooden mail-sorting cabinet; a robotic gripper pulls one orange envelope from its slot."
cover_caption: "Illustration"
highlights:
  - "Built the original Dockerized Gmail API filter with a student team in 2022."
  - "Extended the classifier in October 2026 with six public email sources, seeded train/validation/test splits, model comparisons, and precision-based threshold selection."
  - "The current application reports suspected spam by default; applying a Gmail label is optional."
lessons:
  - "A strong random-split score can hide sensitivity to the source of the email."
  - "False positives and the decision threshold matter more to an inbox tool than headline accuracy alone."
next_steps:
  - "Publish a versioned evaluation artifact with saved outputs, split hashes, threshold-selection boundaries, and examples of false positives."
parameters:
  - label: "Current data sources"
    value: "6 public email corpora"
  - label: "Current split"
    value: "60 / 20 / 20"
  - label: "Default action"
    value: "Report only"
results:
  - metric: "2025 CEAS-08 MLP accuracy"
    value: "99.55%"
    note: "Historical run: 7,831 held-out messages; one unseeded stratified split, no baseline. Not current or live-inbox performance."
  - metric: "2025 legitimate mail flagged"
    value: "15 / 3,462"
    note: "False positives in that same saved CEAS-08 test split."
  - metric: "2025 spam missed"
    value: "20 / 4,369"
    note: "False negatives in that same saved CEAS-08 test split."
links:
  - label: "Current repository"
    kind: repo
    url: "https://github.com/Adithya-Rajendran/Gmail-Filter"
---
## From sender rules to a classifier

The original December 2022 student-team tool used the Gmail API to quarantine messages from blocklisted senders. I later extended it with a text classifier. The current application reports suspected spam by default and can optionally apply a Gmail label.

## October 2026 evaluation pipeline

The revised notebook combines six public email sources, removes exact-text duplicates, and uses seeded 60/20/20 train, validation, and test splits stratified by source and label. TF-IDF feeds logistic regression and ComplementNB comparisons; an MLP is optional. The validation split is used to select a decision threshold for a precision target.

The repository README reports random-split and source-holdout results. The current notebook has no saved output cells, so I keep those reported figures separate from the historical result whose output is preserved. Source-holdout conclusions also need a clear boundary between threshold selection and the held-out source.

## Historical result: August 2025

The [saved 2025 notebook](https://github.com/Adithya-Rajendran/Gmail-Filter/blob/2e90bf4ae9b13ec3474ce5df1015ad3256795001/train-model.ipynb) records a TF-IDF model with 5,000 terms and an MLP with hidden layers of 100 and 50 units. On one unseeded, stratified 80/20 CEAS-08 split, it correctly classified 99.55% of 7,831 held-out messages: 15 legitimate messages were flagged and 20 spam messages were missed.

That number describes one public-corpus experiment. It does not estimate performance on a modern personal inbox or the revised October 2026 pipeline.

## Evidence sources

[2025 notebook with saved results](https://github.com/Adithya-Rajendran/Gmail-Filter/blob/2e90bf4ae9b13ec3474ce5df1015ad3256795001/train-model.ipynb)

[October 2026 training pipeline](https://github.com/Adithya-Rajendran/Gmail-Filter/blob/8d255114c5369e50a63d66cee5c5b8dcc825d972/train-model.ipynb)
