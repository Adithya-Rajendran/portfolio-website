# Optimization pass 2: loading, adaptation, CPU, and lamps

Branch `prog/ws-opt` (integrated via `prog/int`), from `explore/rolling-earth` at `6390b52d` (baseline).
Reference machines (`D13`):

- **Laptop HD 630** — Intel Core i7-7700HQ @ 2.80 GHz (4 cores / 8 threads), 15 GiB RAM, Intel HD Graphics 630 (Kaby Lake-H GT2, Mesa, ANGLE GL backend), Chromium in `mcr.microsoft.com/playwright:v1.64.1-noble`, 1920x1080, `devicePixelRatio` 1. Used for all GPU rankings and optimization report numbers.
- **CI host 1 (`arcadia-ci`)** — Intel Core i9-13900H (14 cores / 20 threads), 62 GiB RAM, Intel Iris Xe Graphics (Raptor Lake-P), same Docker image. All "CI host" tables below were measured on this machine. Used for CPU changes and regression gates (Iris Xe GPU time sits near 16 ms across five of the six rooms regardless of draw load, so it cannot rank GPU work).
- **CI host 2 (`arcadia-ci2`)** — Intel Core i9-12900H, Intel Iris Xe Graphics (Alder Lake), same image. A different machine: its numbers are not comparable with the CI host 1 tables and carry their own label wherever they appear.

## How it was measured

All browser tools live in `tools/docker/` and run behind the `perf` and `bench` tiers of `tools/ci/run.sh` (on the CI host) and `tools/ci/hd630.sh` (on the laptop HD 630):

- **Frame and GPU time (`bench.mjs`, `bench`):** rAF intervals synced per frame with a 1-px `readPixels`, plus a frame-level `EXT_disjoint_timer_query_webgl2` timer query around `draw()`, renderer draw calls/triangles, hooked WebGL memory, and first-frame/complete-frame requests and bytes. Hero baseline runs use each room's path with `?shot=hero&scale=1&tier=0|1` (these runs were made when `?room=<r>` still named a room) at 1920x1080, 3 runs x 8 s in fresh browser contexts.
- **Per-pass GPU and JS (`passes.mjs`, `perf passes`):** hooks `WebGLRenderer.render` with `EXT_disjoint_timer_query_webgl2` (when no outer frame query is active) and `readPixels` sync to attribute GPU ms, render JS ms, render count, draw calls, and triangles to `shadow`, `livecube`, `mirror`, `scene`, `bloom`, `final`, `screens`, and `chart`.
- **Per-frame JavaScript CPU profile (`cpuprof.mjs`, `perf cpuprof`):** V8 CDP `Profiler` at 100 us sampling interval over `secs` after a 4 s settle, reporting wall ms/frame, rAF JS ms/frame, sampled self ms/frame, and top files/functions.
- **Unpinned adaptation (`unpinned.mjs`, `perf unpinned`):** vsync enabled, `?scale` and `?tier` unpinned, polls `window.__lobby.mode()` every 2 s for `secs` (default 30 s, 24 s in baseline traces) and measures 8 s of rAF intervals afterward (`fps`, `med`, `p95`).
- **Throttled first frame (`load.mjs`, `perf load`):** CDP `Network.emulateNetworkConditions` (`0` for unthrottled, `50 Mbit/s` / `20 ms` RTT, `10 Mbit/s` / `40 ms` RTT), reporting cover-lift time `lifted`, resource counts/KB/timing by asset type, and key loading marks.
- **Load bottleneck profile (`loadprof.mjs`, `perf loadprof`):** attaches V8 CDP `Profiler` at 500 us on `/robots.txt` before navigating to the room, recording `LongTask` durations, KTX2 worker `transcode` tasks, and wrapped `WebGL2RenderingContext` call counts and timings until `ready() > 0`.
- **Visual identity (`pictures`, `blurdiff.mjs`):** `tools/ci/run.sh pictures [--against <base>]` checks 34 deterministic states (`tools/ci/pictures.txt`) with `pdiff.mjs --strict --fail-max=0`. "Pixel-identical" means `max == 0` on all 34 states. `blurdiff.mjs` (`perf blurdiff`) computes 8x8 block-averaged RGB diffs where intentional tolerance checks are needed.
- **Evidence rules (§5.5):** every reported number is the median of at least 3 runs with all individual runs listed; before and after are measured in the same session on the same machine; GPU ms from the timer query is primary for GPU work, with frame ms reported beside it.
- **Laptop HD 630 isolation (`tools/ci/hd630.sh`):** takes the exclusive lock `flock -w 3600 /tmp/arcadia-local-hd630.lock` first, so a second run waits before it extracts `<ref>` via `git archive` (never serving a dirty worktree), packs or reuses assets and runs `tools/site.py`; waits (up to 120 s) for the load that preparation caused to settle; then runs the measurement under `timeout -k 10s 300s` (the group is signalled, and the named container is removed), and logs `/proc/loadavg` before and after. Runs with 1-minute load above `HD630_MAX_LOAD` (default `nproc / 2`, i.e., `4` on the 8-thread i7-7700HQ) are marked `"usable": false` / `UNUSABLE`. `INT`, `TERM` and `HUP` stop the run at once: the whole process tree below the script is killed (every slow step runs as a waited-for child, including the lock wait and the preparation), the run is recorded as interrupted and unusable in `result.json` and the script exits 128+signal; a timed-out run is unusable too. The measurement writes its log straight to a file, so a signal loses no output. After a `SIGKILL` of the script the children keep the lock until they end (at the latest at the timeout), and the next run removes the stale `src` folders and containers under its own lock. For a commit whose `run.sh` has no `perf` case, the scripts are taken from the invoking checkout, not from that commit.

## 1. Baseline (`6390b52d`)

### Hero view (§2.2, `bench.mjs`, 1920x1080, `scale=1`, median of 3 x 8 s runs)

Frame ms / GPU ms. Tier 1 is no MSAA with FXAA (`mirror` 1647x927); tier 0 is 4x MSAA (`mirror` 1267x713).

**Laptop HD 630:**

| Room | Tier 1 median | Tier 1 raw `[frame]` / `[gpu]` | Tier 0 median | Tier 0 raw `[frame]` / `[gpu]` | Calls | Tris | First visit download |
|---|---|---|---|---|---|---|---|
| Atrium (`lobby`) | **40.5 / 31.6** | `[40.5, 39.6, 43.4]` / `[31.65, 31.6, 31.19]` | **55.7 / 42.5** | `[55.4, 55.7, 55.9]` / `[41.59, 43.83, 42.5]` | 240 | 908,747 | 33.5 MB (`33,516 KB`) |
| Lounge (`about`) | **30.6 / 25.4** | `[30.6, 30.6, 30.6]` / `[25.45, 25.44, 25.67]` | **36.8 / 30.8** | `[36.3, 37.2, 36.8]` / `[30.77, 30.84, 30.8]` | 94 | 564,504 | 39.2 MB (`39,246 KB`) |
| Fabrication (`projects`) | **57.8 / 50.8** | `[58, 57.6, 57.8]` / `[50.97, 50.73, 50.76]` | **68.1 / 60.7** | `[68.7, 65, 68.1]` / `[61.02, 60.34, 60.72]` | 111 | 502,344 | 24.2 MB (`24,241 KB`) |
| Navigation (`experience`) | **42.7 / 33.6** | `[43, 42.3, 42.7]` / `[33.59, 33.42, 33.6]` | **48.0 / 39.7** | `[49.3, 48, 47.1]` / `[40.06, 39.41, 39.71]` | 166 | 390,112 | 12.2 MB (`12,175 KB`) |
| Library (`writing`) | **67.6 / 51.4** | `[67.8, 67.6, 66.9]` / `[51.29, 51.38, 51.38]` | **81.6 / 64.4** | `[81.6, 82.2, 80.2]` / `[64.42, 64.43, 65.43]` | 273 | 1,381,546 | 34.7 MB (`34,669 KB`) |
| Comms (`comms`) | **27.4 / 20.6** | `[27.4, 27.1, 27.8]` / `[20.68, 20.41, 20.57]` | **28.4 / 22.1** | `[28.1, 28.9, 28.4]` / `[22.05, 22.22, 22.04]` | 92 | 145,032 | 19.6 MB (`19,627 KB`) |

**CI host 1 (`arcadia-ci`, i9-13900H, Raptor Lake Iris Xe):**

| Room | Tier 1 median | Tier 1 raw `[frame]` / `[gpu]` | Tier 0 median | Tier 0 raw `[frame]` / `[gpu]` | Tier 1 first frame (`load.ms`) | Tier 0 first frame (`load.ms`) |
|---|---|---|---|---|---|---|
| Atrium (`lobby`) | **28.1 / 16.9** | `[28.1, 28.9, 27.5]` / `[16.85, 17.36, 15.4]` | **29.0 / 16.8** | `[29, 29.9, 28.2]` / `[16.75, 17.47, 16.4]` | **1324 ms** (`1.3 s`; `[1952, 1324, 1302]`) | **1400 ms** (`1.4 s`; `[2172, 1400, 1375]`) |
| Lounge (`about`) | **18.4 / 11.4** | `[18.4, 17.7, 18.5]` / `[11.43, 10.8, 12.09]` | **21.2 / 15.0** | `[19.4, 21.9, 21.2]` / `[12.41, 15.82, 15.03]` | **1385 ms** (`1.4 s`; `[1812, 1385, 1303]`) | **1364 ms** (`1.4 s`; `[1868, 1364, 1236]`) |
| Fabrication (`projects`) | **22.2 / 15.4** | `[19.7, 22.7, 22.2]` / `[12.47, 15.69, 15.37]` | **23.0 / 16.5** | `[22.8, 23, 23.2]` / `[15.83, 16.49, 16.98]` | **900 ms** (`0.9 s`; `[1261, 900, 814]`) | **954 ms** (`1.0 s`; `[1383, 895, 954]`) |
| Navigation (`experience`) | **26.2 / 16.7** | `[25.4, 26.2, 26.6]` / `[16.48, 16.69, 17.14]` | **25.4 / 16.2** | `[26.6, 25.1, 25.4]` / `[17.48, 15.64, 16.23]` | **871 ms** (`0.9 s`; `[1451, 871, 787]`) | **873 ms** (`0.9 s`; `[1452, 873, 727]`) |
| Library (`writing`) | **29.2 / 16.0** | `[29.2, 29.8, 29.2]` / `[15.89, 16.02, 15.97]` | **29.8 / 16.3** | `[30.7, 29.6, 29.8]` / `[16.27, 15.58, 16.27]` | **1207 ms** (`1.2 s`; `[1836, 1149, 1207]`) | **1320 ms** (`1.3 s`; `[2044, 1320, 1166]`) |
| Comms (`comms`) | **20.4 / 13.1** | `[19.1, 20.4, 21.2]` / `[11.6, 13.07, 14.52]` | **20.7 / 13.7** | `[20.7, 22.1, 19.4]` / `[13.74, 15.68, 12.22]` | **1009 ms** (`1.0 s`; `[1568, 1009, 992]`) | **1075 ms** (`1.1 s`; `[1737, 1075, 1025]`) |

### Reproduction on CI host 1 (`arcadia-ci`), Atrium tier 1

All runs below are `ci <ref> bench '?shot=hero&scale=1&tier=1' <runs> 8` on CI host 1 only (exclusive `quiet.lock`), frame ms and GPU ms as the bench reports them. Every run taken is listed below; none was dropped.

**The recorded baseline, re-measured on the base commit `6390b52d`** (every Atrium tier 1 job on `6390b52d` taken on CI host 1 today; the job folders are under `/srv/arcadia/jobs/`):

| Measurement | Per-run frame ms | Median frame ms | Per-run GPU ms | Median GPU ms |
|---|---|---|---|---|
| `baseline.md` (3 runs) | 28.1, 28.9, 27.5 | 28.1 | 16.85, 17.36, 15.4 | 16.85 |
| `20261125-061303-6390b52d-bench-826752` | 27.9, 26.0, 25.8 | 26.0 | 15.57, 15.01, 14.29 | 15.01 |
| `20261125-062457-6390b52d-bench-849481` | 27.2, 28.2, 27.8 | 27.8 | 14.71, 16.18, 15.58 | 15.58 |
| `20261125-073439-6390b52d-bench-982325` (5 runs) | 26.3, 27.5, 27.2, 22.6, 26.4 | 26.4 | 15.17, 15.56, 14.95, 10.77, 14.38 | 14.95 |
| `20261125-083731-6390b52d-bench-1116256` | 28.9, 28.1, 27.5 | 28.1 | 16.92, 15.96, 15.52 | 15.96 |
| **All 14 runs pooled** | | **27.35 (-2.7%)** | | **15.34 (-9.0%)** |

The pooled frame ms median of all 14 runs is within 5% of the recorded 28.1, so the "within 5%" line is met on frame ms on CI host 1. GPU ms is 9% under the recorded 16.85, inside the roughly 12% run-to-run spread seen on this host. (The first two jobs were taken by other tasks on the same host and are included so that nothing is selected; a tier 0 job `20261125-062622-6390b52d-bench-851031` is a different configuration and is not pooled.)

**The clean "the tools change nothing" check: `prog/ws-opt` (`e036e938`) against the O0 head (`04755104` = `prog/ws-opt` plus the tools and docs), interleaved, 3 runs per job:**

| Job | Ref | Per-run frame ms | Median | Per-run GPU ms | Median |
|---|---|---|---|---|---|
| 1 | `prog/ws-opt` | 25.2, 26.9, 27.3 | 26.9 | 14.27, 15.5, 16.73 | 15.5 |
| 1 | head | 25.6, 25.7, 25.4 | 25.6 | 14.4, 14.41, 15.52 | 14.41 |
| 2 | `prog/ws-opt` | 23.8, 25.7, 25.4 | 25.4 | 12.49, 14.36, 14.35 | 14.35 |
| 2 | head | 22.9, 11.1, 11.2 | 11.2 | 13.23, 7.75, 7.99 | 7.99 |
| 3 | `prog/ws-opt` | 11.6, 10.5, 10.9 | 10.9 | 8.01, 7.47, 7.76 | 7.76 |
| 3 | head | 21.9, 26.8, 24.6 | 24.6 | 10.51, 15.53, 14.29 | 14.29 |

Draw calls are 240 in every run. The host changed state during the series: runs near 11 ms frame / 8 ms GPU appear in both refs (head job 2, `prog/ws-opt` job 3) while the neighbouring jobs sit near 25 ms / 14.5 ms, so run-to-run and job-to-job variation on this host (up to a factor of two) is larger than any difference between the two refs; the pairs show no systematic difference. The first pair, taken before the change of state, differs by 4.8% in median frame ms (26.9 against 25.6). Because the host's state moves during a series, a single run or job is not a safe basis for a regression gate; compare interleaved jobs on the same ref. CI host 2 (`arcadia-ci2`, i9-12900H) is a different machine and is not used for this comparison.

### Time to first frame (`load.mjs`, §2.2)

- **Unthrottled (`0 Mbit/s`):** 2.9–6.1 s on the laptop HD 630 (`experience` median 2.9 s to `lobby` median 5.3 s in `bench.mjs`, `load.mjs` `lobby` 6.1–6.7 s); 0.9–1.4 s on the CI host (`experience` 871 ms to `about` 1385 ms).
- **50 Mbit/s, 20 ms RTT (laptop):** Atrium 11.1 s, Lounge 10.2 s, Library 10.1 s, Comms 7.5 s, Fabrication 6.4 s, Navigation 4.8 s.
- **10 Mbit/s, 40 ms RTT (laptop):** Atrium 32.7 s, Navigation 12.7 s.

### Where the time goes (§2.3, HD 630, tier 1 unless noted)

**Per-pass GPU ms (`passes.mjs`):**

| Room | `scene` | `mirror` | `final` | `shadow` | `bloom` | other | `gpu_sum` | `js_in_render` |
|---|---|---|---|---|---|---|---|---|
| Atrium (`lobby`) | 16.4 | 8.2 | 5.0 | 2.8 | 1.5 | `livecube` 1.3, `screens` 0.3 | 35.6 | 11.2 |
| Lounge (`about`) | 13.1 | 4.5 | 4.7 | 2.0 | 1.4 | — | 25.7 | 3.3 |
| Fabrication (`projects`) | 32.9 | 11.9 | 5.0 | — | 1.3 | — | 51.1 | 3.2 |
| Navigation (`experience`) | 22.0 | 6.6 | 4.8 | — | 1.4 | `chart` 0.3 | 35.1 | 6.3 |
| Library (`writing`) | 35.3 | 7.9 | 4.9 | 2.0 | 1.3 | — | 51.5 | 6.9 |
| Comms (`comms`) | 10.0 | 3.9 | 4.7 | 1.2 | 1.4 | — | 21.1 | 3.0 |
| Atrium (`lobby`, tier 0) | 28.2 | 9.6 | 2.8 | 2.8 | 1.4 | `livecube` 1.5, `screens` 0.4 | 46.7 | 12.0 |
| Library (`writing`, tier 0) | 50.9 | 8.0 | 2.8 | 1.9 | 1.4 | — | 65.1 | 7.3 |

- **Lamp highlights (`lampLobe`, `reflections.js:125`):** with `?skip=lamps`, GPU ms drops 62% in Fabrication (50.8 to 19.3 ms, 15 lamps), 47% in the Library (8 lamps), and 42% in Navigation (9 lamps) — roughly 2 ms per lamp.
- **Environment lobes:** `?env=0` saves 4.1 ms (Atrium), 9.6 ms (Library), and 10.2 ms (Fabrication) — an upper bound, not removable.
- **Mirror and final pass:** at tier 1 the floor mirror renders at 1647x927 (0.858 of the view per side, 18–26% of frame GPU ms) vs 1267x713 at tier 0; the FXAA final pass takes 4.7–5.0 ms at tier 1 vs 2.8 ms at tier 0.
- **JavaScript per frame (`cpuprof.mjs`, HD 630 tier 1):** Atrium 12.3 ms (240 calls), Library 9.0 ms (273 calls), Navigation 6.7 ms (166 calls), Fabrication 4.4 ms (112 calls, inspect), Comms 4.7 ms (88 calls, field). The site's own JS is under 0.5 ms; the rest is three.js draw submission. Atrium issues 9 `render()` calls per frame (6 for the orrery's `CubeCamera`: 3.2 ms JS for 24 draw calls); `updateMatrixWorld` / `multiplyMatrices` / `projectObject` take 2.5 ms. Library's drone accounts for ~100 of 143 scene draw calls and ~75 of 86 shadow draw calls.
- **Loading (`loadprof.mjs`, HD 630, unthrottled):** `basis_transcoder.wasm` is requested after the first texture and arrives last (at 50 Mbit/s: requested at 1.2 s, finished at 6.0 s), delaying 2.2 s of worker transcodes (`lobby` 54 tasks, 7.9 s worker time). Then a single ~4.0 s main-thread long task (3.2 s in `writing`) stalls on `getProgramInfoLog` (2.1 s across 35 programs in `lobby`) and `compressedTexSubImage2D`/`3D` uploads (1.4 s).
- **Adaptation (`unpinned.mjs`, HD 630, 24 s):** Fabrication stayed at `tier=0, scale=1` for the full 24 s at 16.2 fps (`p95=683.3 ms`) and Library at `18.5 fps` (`p95=466.7 ms`) because `frame()` clamped `dt` to 50 ms before feeding `Governor`, preventing its `>250 ms` guard from firing while headless Chromium delivered bursty frames.

### Already tried in the planning session: do not repeat (§2.4)

| Tried | Result |
|---|---|
| Frustum culling for baked meshes | 0 ms (large merged groups); changed Library's picture |
| No depth pre-pass in the mirror | Worse by 1.4 ms (Atrium) and 6.5 ms (Library) |
| 1024 px shadow map | 1.3 ms at most, 0 ms in Library |
| 64 px orrery cube | 0 ms |
| Orrery cube every other frame | 0 ms GPU; ~1.6 ms less JS (estimate; see `O6a`) |
| Skip lamps with baked visibility 0 or `< 1e-4` bound | 0 ms (pictures identical; tests still walk every lamp) |
| No lamps and no clear coat in the mirror | Fabrication −7.7 ms, but 10% of pixels change by `> 2/255` |
| UASTC RDO at lambda 0.5–2 | 8–19% fewer bytes for ~2x texel error |
| Removing the depth pre-pass itself | Depth pre-pass still earns 10.6 ms (Atrium) and 41 ms (Fabrication); keep it |
| Lamp grid (`O4a` prototype) | Pixel-identical (`max 0`); GPU 50.8 -> 26.8 ms (Fabrication), 33.4 -> 19.5 ms (Navigation) |
| Load-path overlap (`O1` prototype) | Pixel-identical; first frame 16–23% sooner at 50 Mbit/s |

## 2. Optimizations tried

*To be populated as `O1`–`O7` are recorded and summarized by `O8`.*

## 3. Final

*To be populated by `O8` once all `O*` tasks have landed.*

## 4. Later pass (§12)

*To be populated with `O4a` point-lamp measurements and deferred §12 items by `O8`.*

## Reproduce

On the CI host 1 (`arcadia-ci`):

```sh
ssh arcadia-ci '/srv/arcadia/bin/ci 6390b52d bench "?shot=hero&scale=1&tier=1" 3 8'
ssh arcadia-ci '/srv/arcadia/bin/ci <ref> perf passes "?shot=hero&scale=1&tier=1" 6'
ssh arcadia-ci '/srv/arcadia/bin/ci <ref> perf cpuprof "?shot=hero&scale=1&tier=1" 6'
ssh arcadia-ci '/srv/arcadia/bin/ci <ref> perf unpinned "?" 30'
ssh arcadia-ci '/srv/arcadia/bin/ci <ref> perf load "?shot=hero" 50 20'
ssh arcadia-ci '/srv/arcadia/bin/ci <ref> perf loadprof "?shot=hero"'
ssh arcadia-ci '/srv/arcadia/bin/ci <ref> pictures --against 6390b52d'
```

On the laptop HD 630 (clean archive, exclusive lock, load check):

```sh
tools/ci/hd630.sh 6390b52d bench "?shot=hero&scale=1&tier=1" 3 8
tools/ci/hd630.sh <ref> passes "?shot=hero&scale=1&tier=1" 6
tools/ci/hd630.sh <ref> cpuprof "?shot=hero&scale=1&tier=1" 6
tools/ci/hd630.sh <ref> unpinned "?" 30
tools/ci/hd630.sh <ref> load "?shot=hero" 50 20
tools/ci/hd630.sh <ref> loadprof "?shot=hero"
```