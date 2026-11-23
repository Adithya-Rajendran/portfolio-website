---
title: "A memory-pressure guard for GB10 Docker workloads"
name: "GB10 memory guard"
summary: "A Linux guard built after large model loads left my GX10 unresponsive. It estimates memory headroom and stops selected Docker workloads when pressure or allocation rate crosses configured limits."
order: 8
status: active
status_note: "Implemented for Docker workloads. Current thresholds still need the earlier stress-test sequence."
types: [infrastructure, software]
technologies: ["Python", "Linux", "systemd", "cgroup v2", "Docker", "NVIDIA GB10"]
role: "Failure analysis, guard implementation, and documentation"
started: 2026-01-01
date_precision: year
dates_approximate: false
highlights:
  - "Reads Linux memory counters and pressure signals to detect low headroom and fast allocation ramps."
  - "Stops selected Docker cgroups through cgroup v2 and records actions and memory telemetry."
  - "Documents protected host services, recovery settings, cache cleanup, and the guard’s coverage limits."
parameters:
  - label: "Current soft threshold"
    value: "8 GiB"
  - label: "Current hard threshold"
    value: "3 GiB"
  - label: "Covered runtime"
    value: "Docker scopes"
links:
  - label: "Guard implementation"
    kind: repo
    url: "https://github.com/Adithya-Rajendran/gb10-hardening"
  - label: "Memory-pressure investigation"
    kind: article
    post: dgx-spark-unified-memory-oom-hardening
---
## The intervention

The guard reads Linux memory counters and pressure signals, tracks rapid allocation ramps, and stops selected cgroup v2 workloads. I added host-service protections and telemetry to help diagnose the failure and recovery sequence.

## What remains untested

The documented stress observations used a 4 GiB hard floor and 1 GiB kernel reserve. Current defaults use 3 GiB and 256 MiB; the same stress sequence has not been repeated with them, and raw traces are not public.

The scan covers selected Docker workloads. Native processes, rootless Docker, and MicroK8s/containerd pods are outside its scope. The headroom calculation is a heuristic, and startup cache dropping also occurs in dry-run mode.
