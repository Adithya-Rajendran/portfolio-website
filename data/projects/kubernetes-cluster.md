---
title: "Kubernetes cluster with NFS and OIDC"
name: "Kubernetes cluster"
summary: "A three-node Kubernetes lab with Okta OIDC and NFS-backed persistent storage."
order: 3
status: completed
types: [infrastructure]
technologies: ["Kubernetes", "NFS", "Okta OIDC"]
role: "Built and configured the cluster in my homelab"
started: 2024-01-01
ended: 2025-12-31
date_precision: year
dates_approximate: true
quiet: true
cover: d7a7285e833b459e195bf5eb5cff66de0ca12aba-1536x1024.webp
cover_alt: "Three small black computers in a row on a dark shelf, linked by orange cables."
cover_caption: "Illustration"
highlights:
  - "Built a three-node Kubernetes cluster in my homelab."
  - "Integrated Okta OIDC authentication and NFS-backed persistent storage; configured security controls for the lab."
parameters:
  - label: "Nodes"
    value: "3"
  - label: "Identity"
    value: "Okta OIDC"
  - label: "Persistent storage"
    value: "NFS"
---
This lab brought together a three-node Kubernetes cluster, Okta OIDC authentication, and NFS-backed persistent storage. It gave me a place to work through cluster administration and access control.

The published record does not include a versioned compliance scan or an instrumented upgrade test. I therefore describe the configuration without claiming complete CIS Level 1 compliance or a measured zero-downtime result.
