---
title: "Local coding agents: task success and resource use"
name: "Local coding-agent benchmarks"
summary: "Seven model/server configurations on one GX10, measured by completed bug fixes, task time, GPU energy, and memory use. The October 25 snapshot includes 18 fresh-PR tasks and 11 SWE-bench Pro tasks."
order: 7
status: active
status_note: "October 25, 2026 data release. Execution-harness release remains incomplete."
types: [research, software]
technologies: ["Python", "Docker Sandboxes", "vLLM", "llama.cpp", "Ollama", "NVIDIA GB10"]
role: "Benchmark design, runs, telemetry, and analysis"
started: 2026-01-01
date_precision: year
dates_approximate: false
featured: 3
cover: 098eccdc6efeb653e079afec9c050554ce6eb959-1036x650.png
cover_alt: "Scatter plot of resolved coding tasks out of eighteen against median task time."
cover_caption: "October 25 snapshot: small task samples and mostly one primary attempt per configuration."
problem: "Do faster local models finish more useful coding work when they share a memory-constrained machine?"
approach: "I recorded test-graded patches, server settings, timings, and telemetry, including failed attempts and parallel-agent runs."
highlights:
  - "Published per-attempt results, server manifests, task definitions, and telemetry for coding-agent experiments on one GX10."
  - "Compared seven model/server configurations on 18 fresh-PR tasks and an 11-task SWE-bench Pro subset."
  - "Measured task completion alongside time, GPU energy, memory, and parallel-agent behavior."
parameters:
  - label: "Hardware"
    value: "ASUS GX10 · GB10"
  - label: "Unified memory"
    value: "128 GB"
  - label: "Task sets"
    value: "18 fresh PR / 11 Pro"
results:
  - metric: "Fresh-PR tasks resolved"
    value: "8–13 / 18"
    note: "Range across seven configurations in the Oct 25 snapshot. Small, mostly single-attempt samples; not a general leaderboard."
  - metric: "SWE-bench Pro subset"
    value: "2–7 / 11"
    note: "Same snapshot; errors count as unresolved. This is an 11-task subset, not the full benchmark."
links:
  - label: "Benchmark repository"
    kind: repo
    url: "https://github.com/Adithya-Rajendran/dgx-spark-benchmarks"
  - label: "Released dataset v0.3.0"
    kind: dataset
    url: "https://doi.org/10.5281/zenodo.23539595"
---
## What the record supports

The released tables let a reader trace aggregate results back to attempts, server manifests, and telemetry. Errors count as unresolved tasks. GPU-energy readings cover the GPU sensor rather than whole-system power; overlapping attempts need run-level accounting.

The comparison is between complete model/server configurations. Engines, quantization, and settings vary, so differences cannot be attributed to model weights alone.

## Limits and next run

Most primary tasks have one attempt per configuration, and both task sets are small. A difference of one or two completed tasks is too fragile for a broad ranking. Recently merged PRs also cannot prove absence of training contamination.

The data and report are public, but the missing execution-harness components prevent a complete independent rerun. Releasing those components and repeating selected comparisons are the next steps.

## Evidence sources

[Study report](https://github.com/Adithya-Rajendran/dgx-spark-benchmarks/tree/f69a046e4b43c5f477f42e59debdbe3aca20edd7/report/REPORT.md)

[Versioned data snapshot](https://github.com/Adithya-Rajendran/dgx-spark-benchmarks/tree/f69a046e4b43c5f477f42e59debdbe3aca20edd7/data)
