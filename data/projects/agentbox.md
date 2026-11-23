---
title: "Agentbox: local agent work as a reviewable branch"
name: "Agentbox"
summary: "A local coding-agent runner that starts from a scratch checkout and returns a branch, diff, and report. The agent container has constrained access; the launcher and model gateway remain trusted."
order: 10
status: active
status_note: "Implementation and automated test tooling are public. Adversarial containment validation remains open."
types: [software, infrastructure]
technologies: ["Python", "Docker", "MCP", "gVisor", "vLLM", "Ollama", "Git"]
role: "Runner, launcher boundaries, and result-collection workflow"
started: 2026-01-01
date_precision: year
dates_approximate: false
highlights:
  - "Accepts one owned repository per request and returns agent work on a separate branch."
  - "Launches agent containers with no network interface, a read-only root filesystem, dropped capabilities, and a task-scoped model gateway."
  - "Collects results through a trusted shadow Git directory and provides a check-running tool for review."
parameters:
  - label: "Result"
    value: "Reviewable Git branch"
  - label: "Agent network"
    value: "No network interface"
  - label: "Optional isolation"
    value: "gVisor"
links:
  - label: "Project repository"
    kind: repo
    url: "https://github.com/Adithya-Rajendran/agentbox"
---
## How a task comes back

I built the runner, launcher boundaries, and result collection. The agent works in a container with no network interface, a read-only root filesystem, dropped capabilities, and access to a task-scoped model gateway.

A trusted shadow Git directory collects the result without executing Git hooks from the agent-controlled checkout. A separate tool runs checks on the returned branch.

## The trust boundary

The Docker launcher and model bridge are trusted components. gVisor is optional and changes the kernel boundary only when installed and selected. Public smoke tests do not establish resistance to every escape or replace an independent security assessment. Returned patches still require review.

## Evidence sources

[Launcher implementation](https://github.com/Adithya-Rajendran/agentbox/tree/951e3771780f2dbb7ccf8d56c2b16dddee257cc4/agentbox/launcher.py)
