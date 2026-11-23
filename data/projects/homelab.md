---
title: "Rebuildable OpenStack homelab"
name: "Homelab"
summary: "A personal cloud with PXE bare-metal provisioning, segmented networking, and a NAS whose lifecycle stays independent of the OpenStack cluster."
order: 2
status: active
types: [infrastructure]
technologies: ["MAAS", "Ubuntu Core", "MicroCloud (LXD)", "Landscape", "Juju", "Canonical OpenStack", "Ceph", "VLANs", "PXE"]
role: "Owner and operator"
started: 2022-01-01
date_precision: year
dates_approximate: false
problem: "I wanted a homelab where I could experiment and break things without worrying about how long it would take to rebuild. Reinstalling an OS across three MS-01s every time got old, and MAAS and Landscape, which manage the machines, need a place to run too."
approach: "A three-tier bootstrap chain. Three Raspberry Pi 5s, the only machines installed by hand, run MAAS and Landscape on Ubuntu Core with MicroCloud. MAAS provisions a Dell Inspiron, which hosts the Juju controller, and three Minisforum MS-01s over PXE."
outcome: "The x86 OpenStack tier can be reprovisioned over PXE. Keeping the NAS outside Ceph separates its lifecycle from cluster redeployments; this is not a measured disaster-recovery or availability result."
highlights:
  - "Built a three-tier provisioning chain: Raspberry Pi services bootstrap PXE provisioning of the x86 OpenStack nodes."
  - "Separated management and Ceph replication traffic with VLANs; configured link aggregation and jumbo frames for the relevant network paths."
  - "Kept the NAS outside the redeployable cluster so routine cloud rebuilds do not require rebuilding personal storage."
lessons:
  - "Most of the failures in this lab have started at Layer 2."
  - "The interesting work is not making the cluster bigger; it is making the existing pieces fit together better and contributing what I learn back to the projects that power it."
next_steps:
  - "Measure a clean PXE rebuild: record starting state, elapsed time, manual steps, and services that remain available."
  - "Run a bounded node-failure and restore exercise, with explicit recovery checks and separate NAS backup verification."
links:
  - label: "A Homelab Built to Be Rebuilt"
    kind: article
    post: my-homelab
  - label: "Talos deployment configuration"
    kind: repo
    url: "https://github.com/Adithya-Rajendran/homelab-talos"
  - label: "GB10 memory-pressure notes"
    kind: article
    post: dgx-spark-unified-memory-oom-hardening
---
The OpenStack deployment uses three Raspberry Pi 5s to host the bootstrap services. MAAS provisions a Dell Inspiron and three Minisforum MS-01s over PXE; the Dell hosts the Juju controller used to build the cloud.

The NAS has an independent lifecycle outside Ceph. That helps protect it from intentional cloud redeployments; it does not substitute for backups or establish recovery time after a failure.

The GPU tier includes an ASUS Ascent GX10, based on NVIDIA GB10. My [MicroK8s write-up](/blog/kubernetes-on-the-nvidia-dgx-spark/) describes its GPU time-slicing setup. The separate [memory-pressure guard](/portfolio/gb10-memory-guard/) targets Docker workloads on the GX10.

## Related infrastructure experiments

A separate [Talos-on-Proxmox configuration repository](https://github.com/Adithya-Rajendran/homelab-talos) records a three-node Kubernetes deployment using OpenTofu, talhelper, Cilium, and Argo CD. It is a separate deployment from the OpenStack bootstrap chain described here. Cluster upgrades still require an operator; Argo CD reconciles the in-cluster platform.

The [full OpenStack write-up](/blog/my-homelab/) documents the bootstrap chain, network failures, and limits of the current setup.
