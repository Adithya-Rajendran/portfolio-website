---
title: "Keeping a DGX Spark reachable under memory pressure"
description: "Why model loads made my GB10 host unresponsive, how a memory guard intervenes, and what the tests establish about its limits."
published: 2026-10-21
revised: 2026-10-25
tags: [homelab, infrastructure, gpu, linux, memory, dgx-spark]
image: 0f0e342e068902b2b48d53bc69ae5e04b3bc7579-1200x630.png
image_alt: "Keeping a DGX Spark reachable under memory pressure. An engineering note by Adithya Rajendran."
takeaways:
  - "The GB10 shares memory between the CPU and GPU. In these incidents, model loading left the host unable to respond over SSH."
  - "The guard intervenes against Docker workloads; it does not cover Kubernetes pods or every source of host memory pressure."
  - "Successful tests used older thresholds. The current 3 GiB hard floor and 256 MiB min_free_kbytes defaults have not received the same validation."
changelog:
  - date: 2026-10-25
    kind: correction
    note: "Corrected memory-estimate and Linux-setting explanations, Docker and dry-run behavior, and an inconsistent numerical example; distinguished current defaults from earlier stress tests."
next: kubernetes-on-the-nvidia-dgx-spark
next_reason: "Continue with GPU scheduling on the same hardware. Time-slicing adds scheduling slots; it does not provide memory isolation, and this Docker guard does not protect those pods."
projects: [homelab, gb10-memory-guard]
---
The GB10 in my ASUS Ascent GX10 shares one memory pool between the CPU and GPU, as the NVIDIA DGX Spark does. A large model load can therefore consume memory the host needs for services such as SSH. In my tests, running out of headroom did not always produce a clean allocation failure: the machine could stop responding.

That happened three times in July 2026. Each incident lasted 35 to 65 minutes and ended with a power cycle. I built a guard to stop a workload before the host reaches that state. This post explains the failures, the measurements behind the guard, and the limits of the protection. The scripts are in [gb10-hardening on GitHub](https://github.com/Adithya-Rajendran/gb10-hardening).

## Scope and tested versions

This account concerns one GX10 installation. The repository records Ubuntu, kernel `7.0.0-1019-nvidia`, driver `595.99.02`, systemd, cgroup v2, and Docker as the tested environment. The implementation described here is pinned to [commit af4cd3c](https://github.com/Adithya-Rajendran/gb10-hardening/tree/af4cd3caf53e48e32f82af1ef0d43d0e61b563ef). Behavior on another kernel, driver, or container runtime needs its own check.

The successful over-commit tests used a 4 GiB hard floor and a 1 GiB `min_free_kbytes` setting. The current defaults are 3 GiB and 256 MiB. That distinction matters: the tests support the approach, but do not validate those newer defaults.

## What happened in July

On 2026-07-01 I started Qwen3.5-122B-A10B (NVFP4) in vLLM with `--gpu-memory-utilization 0.85`. About ten minutes into loading, the kernel log filled with about 920 of these lines in one minute:

```text
NVRM: GPU0 nvCheckOkFailedNoLog: Check failed: Out of memory [NV_ERR_NO_MEMORY] ... _memdescAllocInternal(pMemDesc) @ mem_desc.c:1336
```

After that the journal went silent for 39 minutes and SSH stopped responding. The same model failed the same way when I relaunched it that afternoon, and Nemotron-3-Super-120B did it again on 07-07 at `--gpu-memory-utilization 0.70`.

The kernel was still producing hung-task reports while normal services stopped making progress. Those symptoms were consistent with a memory-reclaim livelock, although the logs alone do not establish every part of the failure mechanism. With `panic=0`, `hung_task_panic=0`, and no watchdog configured, this installation had no automatic recovery path for the observed hang.

For these incidents, rsyslog's `/var/log/kern.log` preserved lines missing from the journal. Compare both when debugging a similar failure; which record survives depends on the logging configuration and which processes stall.

## Why nothing stepped in

The kernel OOM killer and earlyoom both failed to stop the workload in time. SSH, which I needed to intervene, was also unusable.

The kernel OOM killer ran, but its victims included `wireplumber`, `pipewire`, and `dbus-daemon`, rather than the model server. The task dump listed `VLLM::EngineCor` at about 32 MB of resident memory (RSS), far below the memory I attributed to the GPU workload. That discrepancy helps explain the poor victim selection; RSS was not a reliable measure of this workload's total impact on the host.

earlyoom was installed by 07-07 and logged this:

```text
17:20:21 earlyoom: mem avail: 11054 of 124546 MiB ( 8.88%), swap free: 13294 of 16383 MiB (81.14%)
17:21:21 earlyoom: mem avail:     0 of 124546 MiB ( 0.00%), swap free: 13233 of 16383 MiB (80.77%)
```

earlyoom saw zero available memory but did not act because I had configured `-m 15 -s 5`: both memory and swap had to fall below their thresholds. Swap remained about 80% free in this incident, so the second condition never became true. I needed a trigger that did not depend on swap filling.

sshd was not OOM-killed either (it already runs at `oom_score_adj -1000`). It was starved: new logins hung for more than two minutes in uninterruptible sleep, waiting for memory.

## Where the memory went

The kernel's OOM report from 07-01 shows the problem in one place:

```text
active_anon:28827 inactive_anon:1132 active_file:803 inactive_file:909 shmem:30076
slab_unreclaimable:402640 free:149983      Free swap = 11559468kB / 16777212kB
Node 0 Normal free:41640kB min:44924kB ... all_unreclaimable
```

The first line reports page counts; the later fields explicitly marked `kB` use a different unit. At 4 KiB per page on this installation, the listed anonymous, file, shared-memory, and unreclaimable-slab counts total about 1.8 GiB. The excerpt shows very little free memory in the Normal zone and an `all_unreclaimable` report. It is not a complete accounting of RAM, so subtracting those few categories from total memory would not, by itself, prove how much the NVIDIA driver held.

My working explanation was that the model load left too little headroom for the host. vLLM's `--gpu-memory-utilization` is a budget based on GPU-visible memory; on this machine the host shares the same physical pool. Loading weights, profiling, repacking, and allocating the KV cache can also create peaks that a steady-state fit estimate misses. The logs establish severe allocation pressure, but they do not isolate the contribution of every loading phase.

## How much memory a model actually gets

Linux reports about 121.6 GiB as `MemTotal` on my GX10. That is the useful starting point for a host-memory budget. My accounting from `/proc/iomem` and the boot log puts roughly 6.5 GiB outside that total:

- 0.37 GiB is never handed to Linux by the firmware.
- 3.55 GiB is reserved by firmware before Linux starts. One block of 2.56 GiB is the largest; `/proc/iomem` only labels it `reserved`.
- 2.10 GiB is the `struct page` array, 64 bytes of bookkeeping for every 4 KiB page.
- About 0.45 GiB for the kernel image and early boot allocations.

These are rounded figures from this installation, not a universal GB10 memory map. A model must fit alongside the operating system, runtime, KV cache, and temporary allocations. Checkpoint size on disk is only a starting estimate: quantization, loading strategy, and offloading change the resident footprint.

## When MemAvailable overstates usable headroom

A guard needs a signal it can act on. During an October vLLM test, `/proc/meminfo` reported 111.5 GiB of `MemAvailable` while `MemFree` was only 7.0 GiB and `KReclaimable` was around 100 GB. Low `MemFree` alone is normal on a cached Linux system; the concern here was the combination of those readings, an active GPU workload, and poor responsiveness.

```text
MemAvailable: 111.5 GiB
MemFree:        7.0 GiB
```

In that run, the growth in `KReclaimable` tracked the GPU workload, yet that apparent reclaimable capacity did not translate into a responsive host. The kernel includes an estimate of reclaimable memory in `MemAvailable`. Treating the latter as immediately usable headroom was therefore too optimistic for my guard. It also dropped briefly during rapid allocation, which explains why earlyoom could act during a ramp while missing the settled state.

The guard uses this alternative signal, with all inputs converted to bytes:

```text
TrueAvailable = MemAvailable - KReclaimable + SReclaimable
```

`KReclaimable` includes `SReclaimable`; subtracting the former and adding back the latter excludes the non-slab component. Despite the name `TrueAvailable`, this is a conservative heuristic for the behavior I observed, not a kernel metric or an exact measure of allocatable GPU memory. It can exclude genuinely reclaimable memory and can go negative. The [kernel's own estimate](https://github.com/torvalds/linux/blob/master/mm/show_mem.c) already discounts some reclaimable capacity, so this subtraction is not an exact reversal of its calculation.

For a reproducible calculation, use all three fields from one /proc/meminfo snapshot and convert them to the same unit. Rounded values gathered at different times cannot establish an exact headroom figure.

To inspect the inputs on another machine, capture them together while the workload is running:

```bash
grep -E 'MemFree|MemAvailable|KReclaimable|SReclaimable' /proc/meminfo
```

A large `KReclaimable` value is a reason to investigate, not proof of a driver fault. Compare idle, loading, steady-state, and post-exit readings with memory-pressure measurements and responsiveness. The relationship may change with the driver or workload.

Two more details matter for anything that measures memory on a GB10:

- After some vLLM exits, a large amount of memory remained in `KReclaimable`. In those observations, writing to `/proc/sys/vm/drop_caches` reduced it sharply. That is a workaround for the behavior I measured; it does not establish that the kernel could never reclaim those pages on its own.
- llama.cpp behaved differently in an October 19 run: `KReclaimable` stayed near 0.3 GiB while the server was active, and its memory appeared as ordinary used memory. The large `KReclaimable` increase came after exit. I have not isolated why the engines differed. The same guard formula remains usable in this case because subtracting the small non-slab component changes little, but it is not an independent validation of the estimate.

## The guard

The main protection is `gb10-memguard`, a Python daemon using only the standard library. It aims to sample `/proc/meminfo` every 100 ms, computes `TrueAvailable` and its recent fall rate, and applies three rules. These are the current defaults; the stress-test results later in this post used an older hard floor.

- If headroom is falling faster than 2 GiB/s and its recent rate projects a drop below 3 GiB within 0.5 s, send SIGKILL.
- If `TrueAvailable` is below 3 GiB, send SIGKILL without waiting for the soft threshold.
- After 2 s accumulated below 8 GiB in one low-memory episode, send SIGTERM. Escalate to SIGKILL after 10 s if the target is still present and the episode has not recovered.

The scan looks for Docker scopes containing a command line with `vllm`, `llama-server`, or `ollama`. It orders matching scopes by their filesystem modification time, using that as a proxy for the newest workload. This is a selection policy, not a measurement of which workload caused the pressure.

### Why a rate rule

During a vLLM load the KV cache allocation drains memory at 17 to 41 GiB/s in my tests, and a killed process takes seconds to give memory back. A rule based only on the level has to sit around 20 GiB to survive that, which is what an early version did, and it kept a sixth of the machine unusable. Projecting the current rate 0.5 s ahead catches the ramp early while still letting a steady workload run closer to the floor.

The 0.5 s horizon is a tuning choice informed by two observed post-kill drops: 0.6 GiB and 14.6 GiB. Sending a signal does not immediately release every allocation, particularly when work remains blocked in the kernel or driver. A longer horizon would intervene earlier but also stop more loads that could have completed. These observations do not prove that 0.5 s covers every overshoot.

This rule has a cost I should be clear about: it fires when `TrueAvailable - rate * 0.5 s` drops under 3 GiB. A vLLM load still allocating at 17 GiB/s is killed once headroom falls below about 11.5 GiB. A config whose KV allocation would finish with 6 GiB free does not survive the load.

### Why the slow rule has hysteresis

Replaying 2.5 days of recordings showed 116 crossings of the 8 GiB line. A workload hovering around that threshold kept resetting the old timers. The current episode starts when a rule trips and ends when headroom reaches at least 9 GiB and the ramp rule is clear. Only time actually spent below the soft threshold counts toward its 2 s dwell. In the replay, 116 crossings became 9 episodes.

The 10 s escalation interval also came from logs: clean exits after SIGTERM took 0.5 to 7.6 s in the observed runs. I use 10 s as a practical cutoff for this workload, rather than a general bound on how long shutdown should take.

### How it kills, and why not through Docker

An early version used the Docker API to kill containers. During a severe pressure test, that call timed out after 3 s and the exception crashed the guard. systemd restarted it twice while the headroom estimate went negative. The machine recovered, but the incident showed why the kill path should not depend on a responsive Docker daemon.

Target discovery and signalling now use cgroups and `/proc` directly. SIGKILL is sent through `cgroup.kill`, while SIGTERM is sent to the scope's processes. The implementation still makes a best-effort Docker API call after signalling to look up a readable container name; its 3 s timeout can delay the next iteration. The important improvement is that Docker is no longer needed to deliver the kill:

```python
def kill_scope(scope, sig):
    if sig == "KILL":
        with open(os.path.join(scope, "cgroup.kill"), "w") as f:
            f.write("1")  # request SIGKILL for the cgroup and descendants
```

Two other rules came out of failures:

- On October 19, a llama.cpp server sat below 8 GiB while an older matcher looked only for vLLM. The matcher now includes `llama-server` and `ollama`. If a hard or ramp kill is required and no eligible inference container matches, the fallback chooses the Docker scope with the largest sum of process RSS, provided that sum is at least 8 GiB. That fallback can kill an unrelated container, and summed RSS can double-count shared pages.
- If a killed container has not disappeared 20 s later and memory is still below 3 GiB, the guard moves on to the next target instead of waiting.

### Cleaning up after a kill

An early version dropped caches 3 s after a kill, before a vLLM process that took about 10 s to exit had released its allocations. The current implementation normally waits for the scope's process list to empty, but it also proceeds after a 60 s timeout. A separate sweep runs every 5 s when non-slab `KReclaimable` exceeds 8 GiB and the matcher finds no inference container. That scan does not prove the GPU is idle: native processes and other cgroup layouts are outside its view.

`drop_caches` is system-wide and can cause extra I/O when useful cache must be rebuilt. I treat it as a targeted workaround to investigate, not routine memory housekeeping. The [kernel documentation](https://docs.kernel.org/admin-guide/sysctl/vm.html#drop-caches) describes what it frees and the performance cost.

### Keeping the guard itself alive

The guard attempts `mlockall()` and records whether it succeeded at startup. Its service uses `OOMScoreAdjust=-1000`, `Nice=-10`, and automatic restarts. Decisions go to an fsync'd file, the journal, and, when available, `/dev/kmsg`. CSV sampling is normally 1 Hz and rises to about 5 Hz during falling memory, low-memory episodes, or stalls. These choices improve resilience and diagnosis; filesystem writes and post-kill lookups can still delay the loop.

### What the tests established

The published test summary reports an 82 GB over-commit run killed at 19.4 GiB of estimated headroom, a minimum of 18.8 GiB, and recovery in 4 s. A fresh SSH login was described as instant in an earlier version of that test, compared with about 50 s without the guard. A more severe 95 GB case bottomed at 3.6 GiB and recovered on its own. A 75 GB model then served for 4.1 hours at 12 to 21 GiB of headroom with no guard actions.

Those are observations from a small set of runs, not a reliability rate. The repository contains the implementation and result summaries, but not the complete raw traces needed to independently reconstruct these comparisons. A useful next result would repeat the same workloads with the current settings and publish the configuration, CSV, action log, and recovery measurement together.

## The other layers

The guard is the main intervention. The supporting settings aim to preserve access, improve logging, and provide recovery options if intervention is late. `apply.sh` groups them into numbered sections.

### sshd

This Ubuntu installation used socket activation for SSH. `apply.sh` keeps `ssh.service` running so the first connection does not also need to start the listening daemon. Authentication and session creation still need resources. It adds this drop-in to SSH and journald:

```text
[Service]
OOMScoreAdjust=-1000
MemoryMin=256M
CPUWeight=1000
IOWeight=1000
```

`MemoryMin` requests protection from reclaim up to a unit's effective limit; it does not preallocate memory for future logins. Parent limits and competing protected units matter. `CPUWeight` and `IOWeight` affect relative service under contention where the controllers support them, but cannot unblock an allocation waiting on memory. `user.slice` gets best-effort `MemoryLow=1G` protection. See the [systemd resource-control reference](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html).

### Kernel settings

```text
vm.min_free_kbytes = 262144
vm.watermark_boost_factor = 0
kernel.sysrq = 1
kernel.hung_task_timeout_secs = 120
kernel.hung_task_warnings = -1
```

`min_free_kbytes` influences the per-zone free-memory watermarks. I increased it from roughly 45 MB on this installation to 1 GiB, then reduced it to 256 MiB after examining the capacity cost. The original measurements suggested that the smaller setting returned about 1 GiB of headroom. It is not a separate, fixed-size emergency RAM pool, and the current setting still needs the same severe over-commit test used for the earlier one.

`watermark_boost_factor=0` disables an additional reclaim boost triggered by fragmentation; ordinary reclaim still runs. This trades some proactive reclaim for retaining more cache during the observed loads. `kernel.sysrq=1` enables SysRq keyboard functions. An administrator's write to `/proc/sysrq-trigger`, such as `echo f > /proc/sysrq-trigger`, is permitted independently of that keyboard setting. See the kernel documentation for [VM controls](https://docs.kernel.org/admin-guide/sysctl/vm.html) and [SysRq](https://docs.kernel.org/admin-guide/sysrq.html).

### earlyoom as a backstop

```text
-r 60 -m 5,3 -s 100,100 -g --prefer '^(vllm|VLLM::.*|llama-server|ollama)$'
```

`-s 100,100` removes the low-swap prerequisite that blocked intervention in July. The memory thresholds request SIGTERM below 5% and SIGKILL below 3%; the actual installer also includes an avoid list. These thresholds use `MemAvailable`, while the guard uses a different estimate, so the numbers cannot be directly ranked as if they measured the same thing. earlyoom remains a backstop for pressure its metric can see.

### Automatic recovery

`apply.sh --auto-recover` adds:

```text
kernel.hung_task_panic = 1
kernel.softlockup_panic = 1
kernel.panic_on_oops = 1
kernel.panic = 20
```

The optional mode also configures `RuntimeWatchdogSec=60s`. The panic settings can turn a detected hung task or other configured kernel failure into a reboot; the hardware watchdog only works if a usable watchdog device exists and systemd stops servicing it. This is a recovery option, not a guarantee that every hang will reboot on a fixed schedule. I enable it for unattended benchmarks, accepting the loss of the interrupted run. See the [systemd watchdog documentation](https://www.freedesktop.org/software/systemd/man/latest/systemd-system.conf.html#RuntimeWatchdogSec=).

### The smaller pieces

The installer enables persistent journaling with a 5 s sync interval and caps journal storage at 2 GB. This reduces the window of unsynced logs while the storage path is working; it cannot guarantee a final record during a stall. `apply.sh --trim` disables the DGX Dashboard services, measured at about 380 MiB on this installation. It leaves `fwupd` and `snapd` enabled. The earlier overhead estimate was about 0.2 GiB of extra kernel headroom plus 36 MiB for the daemons, but the larger capacity tradeoff is the guard's default 8 GiB soft threshold.

## The SSH client side

The server settings only help if the client does not give up first. With `ServerAliveInterval 15`, the default `ServerAliveCountMax 3` drops the connection after 45 s without a reply, and with SSH multiplexing that takes the shared connection with it. A stall can last longer than that. I added:

```text
Host gx10
  ServerAliveInterval 15
  ServerAliveCountMax 12
  ControlMaster auto
  ControlPath ~/.ssh/cm-%r@%h:%p
  ControlPersist 24h
```

On this installation, interactive SSH sessions live under `user.slice`. A benchmark launched there can consume the working set that `MemoryLow=1G` was intended to protect. Running a long job as a system service, for example with `sudo systemd-run --unit=<name> ...`, separates it from that slice. Choose its user and working directory explicitly. Running `systemd-run --user` would keep the job in the user hierarchy.

## Caveats

The current 3 GiB hard floor and 256 MiB watermark setting have not been validated by the same 95 GB over-commit test. Until that comparison exists, the successful older runs should not be read as proof that the current defaults prevent the same failure.

The rate rule can stop a fast load that would have settled safely. At 17 GiB/s, the 0.5 s projection reaches a 3 GiB floor when current headroom is about 11.5 GiB; at 41 GiB/s it does so at about 23.5 GiB. A future guard could use expected allocation sizes, but knowing the planned KV-cache size alone would not account for every temporary allocation.

The default soft rule also stops a workload that stays below 8 GiB even if it appears stable. `MEMGUARD_SOFT_NEEDS_PSI=1` makes that rule require measured memory pressure, but it does not change the hard or ramp rules. I have left it off while collecting a baseline. If PSI cannot be read, the implementation falls back to the plain soft rule.

`MEMGUARD_DRY_RUN=1` suppresses signalling and the loop's cache drops, but the startup cleanup can still write to `drop_caches`. It is not a fully passive observation mode in this revision.

The matcher scans `/sys/fs/cgroup/system.slice/docker-*.scope`. It does not cover native servers, workloads inside VMs, rootless Docker, or Kubernetes/containerd scopes. With several matching containers, selection follows scope modification time, not per-workload GPU usage. The RSS fallback stays within those Docker scopes.

Driver and workload versions matter. In July, the OOM dump showed very little vLLM RSS; in October, with driver 595.99.02 instead of 595.71.05 and a newer vLLM, earlyoom saw a much larger process footprint. I have not isolated the cause, and the llama.cpp accounting difference remains unexplained.

The lesson from this box is to validate a memory signal against the workload and the host's ability to make progress. Record loading peaks, keep recovery access in mind, and separate measured results from tuning assumptions. If another GB10 system shows different accounting, a trace with the driver, kernel, and workload versions would make that comparison useful.
