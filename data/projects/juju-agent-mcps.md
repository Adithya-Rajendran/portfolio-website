---
title: "Juju tools with server-enforced limits"
name: "Juju agent MCP servers"
summary: "MCP servers for Juju operations, documentation, and metrics. The operations server checks allowed targets, configuration keys, scaling limits, and dry-run policy before acting."
order: 9
status: completed
status_note: "Implementation and fixture tests are public; earlier model runs used a previous backend."
types: [software, infrastructure]
technologies: ["Python", "MCP", "python-libjuju", "Juju", "Prometheus", "pytest"]
role: "Server implementation, policy design, and evaluation"
started: 2026-01-01
ended: 2026-01-01
date_precision: year
dates_approximate: false
highlights:
  - "Implemented separate operations, documentation, and metrics servers, with mutation decisions enforced in server code."
  - "Added configuration allowlists, declared-app restrictions, unit-count bounds, forced dry-runs, and audit logging."
  - "Built an in-process TLS Juju controller fixture for tests and documented failures from small live and fixture-based model runs."
parameters:
  - label: "MCP servers"
    value: "3"
  - label: "Controller interface"
    value: "python-libjuju"
  - label: "Test fixture"
    value: "In-process TLS server"
links:
  - label: "Project repository"
    kind: repo
    url: "https://github.com/Adithya-Rajendran/juju-agent-mcps"
---
## Why the checks are in the server

In the May 2026 trials, models sometimes retried a dry-run operation as a live call or tried to assemble a forbidden action from allowed tools. Those observations motivated explicit checks in the operations server rather than relying on tool descriptions.

I implemented the servers and a TLS controller fixture for tests. The current operations server uses python-libjuju.

## Evaluation limits

The May trials mixed fixture and live-cluster runs, used one attempt per prompt, and predate the current backend. They explain the design but do not validate this implementation. A final model response was not a correctness score.

The policy permits some bounded scaling actions. HTTP transport needs authentication before use beyond localhost. Tests check enforcement behavior; operational decisions still need review.

## Evidence sources

[Evaluation findings](https://github.com/Adithya-Rajendran/juju-agent-mcps/tree/7923390de074af49f5276f10f70fb3e4e72a5ac3/eval/FINDINGS.md)

[Mutation policy implementation](https://github.com/Adithya-Rajendran/juju-agent-mcps/tree/7923390de074af49f5276f10f70fb3e4e72a5ac3/juju_ops/tools/mutate.py)
