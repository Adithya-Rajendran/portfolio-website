# Recorded Performance Baseline (`6390b52d`)

Recorded against `explore/rolling-earth` at commit `6390b52d` on **2026-11-24** (`docs/program-plan.md` §2.2).
Raw benchmark outputs and logs from the planning session are preserved on the CI host under
`/srv/arcadia/seed/baseline-ci-host/` and `/srv/arcadia/seed/baseline-hd630/`.

## Reference Machines and Role Split (`D13`)

| Machine | OS | CPU | RAM | GPU (Chromium EGL) | Toolchain |
|---|---|---|---|---|---|
| **CI host** (`arcadia-ci`) | Ubuntu 26.04.1 LTS | Intel Core i9-13900H (14 cores / 20 threads) | 62 GiB | Intel Iris Xe Graphics (Raptor Lake-P) | Docker 29.1.3 (`playwright:v1.64.1-noble`), Node 24.22.3, pnpm 12.23.0, Python 3.14.4 |
| **Laptop (HD 630)** | Ubuntu 26.04.1 LTS | Intel Core i7-7700HQ @ 2.80 GHz (4 cores / 8 threads) | 15 GiB | Intel HD Graphics 630 (Kaby Lake-H GT2) | Docker 29.9.1, Node 24.22.3, Python 3.14.4 |

**Interpretation rule (`D13`):** On the CI host, Iris Xe GPU time sits near `16 ms` in five of the six rooms regardless of draw load, with roughly one-third to one-half of each frame in CPU work. Therefore:

- **CI host (`arcadia-ci`)** tracks **CPU changes and regression gates**.
- **Laptop HD 630** ranks **GPU work** (with GPU ms from `EXT_disjoint_timer_query_webgl2` primary and frame ms alongside it).

## Hero View Baselines (§2.2)

All hero measurements use `tools/docker/bench.mjs` at `1920x1080`, `deviceScaleFactor: 1`, `shot=hero`, `scale=1` (resolution pinned), `8` seconds per run, median of `3` runs.
Tier `1` is no MSAA with FXAA (`mirror` `1647x927`); Tier `0` is 4x MSAA (`mirror` `1267x713`).
Values are **frame ms / GPU ms**.

### Laptop HD 630 (`/srv/arcadia/seed/baseline-hd630/A.jsonl`)

| Room | Tier 1 median (§2.2) | Tier 1 raw `[frame]` / `[gpu]` | Tier 0 median (§2.2) | Tier 0 raw `[frame]` / `[gpu]` | Calls | Tris | First visit download |
|---|---|---|---|---|---|---|---|
| Atrium (`lobby`) | **40.5 / 31.60** (`40.5 / 31.6`) | `[40.5, 39.6, 43.4]` / `[31.65, 31.6, 31.19]` | **55.7 / 42.50** (`55.7 / 42.5`) | `[55.4, 55.7, 55.9]` / `[41.59, 43.83, 42.5]` | 240 | 908,747 | 33,516 KB (`33.5 MB`) |
| Lounge (`about`) | **30.6 / 25.45** (`30.6 / 25.4`) | `[30.6, 30.6, 30.6]` / `[25.45, 25.44, 25.67]` | **36.8 / 30.80** (`36.8 / 30.8`) | `[36.3, 37.2, 36.8]` / `[30.77, 30.84, 30.8]` | 94 | 564,504 | 39,246 KB (`39.2 MB`) |
| Fabrication (`projects`) | **57.8 / 50.76** (`57.8 / 50.8`) | `[58, 57.6, 57.8]` / `[50.97, 50.73, 50.76]` | **68.1 / 60.72** (`68.1 / 60.7`) | `[68.7, 65, 68.1]` / `[61.02, 60.34, 60.72]` | 111 | 502,344 | 24,241 KB (`24.2 MB`) |
| Navigation (`experience`) | **42.7 / 33.59** (`42.7 / 33.6`) | `[43, 42.3, 42.7]` / `[33.59, 33.42, 33.6]` | **48.0 / 39.71** (`48.0 / 39.7`) | `[49.3, 48, 47.1]` / `[40.06, 39.41, 39.71]` | 166 | 390,112 | 12,175 KB (`12.2 MB`) |
| Library (`writing`) | **67.6 / 51.38** (`67.6 / 51.4`) | `[67.8, 67.6, 66.9]` / `[51.29, 51.38, 51.38]` | **81.6 / 64.43** (`81.6 / 64.4`) | `[81.6, 82.2, 80.2]` / `[64.42, 64.43, 65.43]` | 273 | 1,381,546 | 34,669 KB (`34.7 MB`) |
| Comms (`comms`) | **27.4 / 20.57** (`27.4 / 20.6`) | `[27.4, 27.1, 27.8]` / `[20.68, 20.41, 20.57]` | **28.4 / 22.05** (`28.4 / 22.1`) | `[28.1, 28.9, 28.4]` / `[22.05, 22.22, 22.04]` | 92 | 145,032 | 19,627 KB (`19.6 MB`) |

*(Minor rounding note: `25.45` in Lounge tier 1 rounds half-to-even to `25.4` in §2.2, and `22.05` in Comms tier 0 rounds to `22.1`.)*

### CI Host (`/srv/arcadia/seed/baseline-ci-host/bench.txt`)

| Room | Tier 1 median (§2.2) | Tier 1 raw `[frame]` / `[gpu]` | Tier 0 median (§2.2) | Tier 0 raw `[frame]` / `[gpu]` | Tier 1 first frame (`load.ms`) | Tier 0 first frame (`load.ms`) |
|---|---|---|---|---|---|---|
| Atrium (`lobby`) | **28.1 / 16.85** (`28.1 / 16.9`) | `[28.1, 28.9, 27.5]` / `[16.85, 17.36, 15.4]` | **29.0 / 16.75** (`29.0 / 16.8`) | `[29, 29.9, 28.2]` / `[16.75, 17.47, 16.4]` | **1324 ms** (`1.3 s`; `[1952, 1324, 1302]`) | **1400 ms** (`1.4 s`; `[2172, 1400, 1375]`) |
| Lounge (`about`) | **18.4 / 11.43** (`18.4 / 11.4`) | `[18.4, 17.7, 18.5]` / `[11.43, 10.8, 12.09]` | **21.2 / 15.03** (`21.2 / 15.0`) | `[19.4, 21.9, 21.2]` / `[12.41, 15.82, 15.03]` | **1385 ms** (`1.4 s`; `[1812, 1385, 1303]`) | **1364 ms** (`1.4 s`; `[1868, 1364, 1236]`) |
| Fabrication (`projects`) | **22.2 / 15.37** (`22.2 / 15.4`) | `[19.7, 22.7, 22.2]` / `[12.47, 15.69, 15.37]` | **23.0 / 16.49** (`23.0 / 16.5`) | `[22.8, 23, 23.2]` / `[15.83, 16.49, 16.98]` | **900 ms** (`0.9 s`; `[1261, 900, 814]`) | **954 ms** (`1.0 s`; `[1383, 895, 954]`) |
| Navigation (`experience`) | **26.2 / 16.69** (`26.2 / 16.7`) | `[25.4, 26.2, 26.6]` / `[16.48, 16.69, 17.14]` | **25.4 / 16.23** (`25.4 / 16.2`) | `[26.6, 25.1, 25.4]` / `[17.48, 15.64, 16.23]` | **871 ms** (`0.9 s`; `[1451, 871, 787]`) | **873 ms** (`0.9 s`; `[1452, 873, 727]`) |
| Library (`writing`) | **29.2 / 15.97** (`29.2 / 16.0`) | `[29.2, 29.8, 29.2]` / `[15.89, 16.02, 15.97]` | **29.8 / 16.27** (`29.8 / 16.3`) | `[30.7, 29.6, 29.8]` / `[16.27, 15.58, 16.27]` | **1207 ms** (`1.2 s`; `[1836, 1149, 1207]`) | **1320 ms** (`1.3 s`; `[2044, 1320, 1166]`) |
| Comms (`comms`) | **20.4 / 13.07** (`20.4 / 13.1`) | `[19.1, 20.4, 21.2]` / `[11.6, 13.07, 14.52]` | **20.7 / 13.74** (`20.7 / 13.7`) | `[20.7, 22.1, 19.4]` / `[13.74, 15.68, 12.22]` | **1009 ms** (`1.0 s`; `[1568, 1009, 992]`) | **1075 ms** (`1.1 s`; `[1737, 1075, 1025]`) |

## Time to First Frame and Functional Suite (§2.2, §6)

- **Unthrottled (`0 Mbit/s` limit):**
  - CI host (`bench.txt`, tier 1 median `load.ms`): **0.9–1.4 s** (`experience` `871 ms`, `projects` `900 ms`, `comms` `1009 ms`, `writing` `1207 ms`, `lobby` `1324 ms`, `about` `1385 ms`).
  - Laptop (`A.jsonl` tier 1 `load.ms` / `E.jsonl` `load.mjs`): **2.9–6.1 s** (`experience` median `2914 ms` to `lobby` median `5322 ms` in `A.jsonl`; `E.jsonl` `lift.base.lobby` `[6087, 6199]` ms = `6.1 s`; `G.jsonl` `lift.base.lobby` `6673` ms).
- **Throttled `50 Mbit/s, 20 ms` RTT (laptop `load.mjs`):**
  - §2.2 recorded medians: Atrium `11.1 s`, Lounge `10.2 s`, Library `10.1 s`, Comms `7.5 s`, Fabrication `6.4 s`, Navigation `4.8 s`.
  - Seed raw logs (`F.jsonl` / `G.jsonl`): `net50.base.lobby` `10714` ms (`F.jsonl`), `11091` ms (`G.jsonl`); `net50.base.about` `10347` ms (`F.jsonl`). (Remaining base rooms were measured in the planning session before `seed/baseline-hd630/` log capture.)
- **Throttled `10 Mbit/s, 40 ms` RTT (laptop `load.mjs`, §2.2):**
  - Atrium `32.7 s`, Navigation `12.7 s`.
- **Full functional suite (`suite`, CI host):**
  - `ci suite 6390b52d PASS 3033s  /srv/arcadia/jobs/20261124-064208-6390b52d-suite-23347` (all 50 steps passed, ~51 min).

## Exact Reproduction Commands

### CI Host (`arcadia-ci`)

Hero benchmark across all 6 rooms and both quality tiers (`1920x1080`, `scale=1`, `3` runs x `8` s):

```sh
for r in lobby about projects experience writing comms; do
  for t in 1 0; do
    ssh arcadia-ci "/srv/arcadia/bin/ci 6390b52d bench '?room=$r&shot=hero&scale=1&tier=$t' 3 8"
  done
done
```

Full 50-step functional suite on `6390b52d`:

```sh
ssh arcadia-ci '/srv/arcadia/bin/ci 6390b52d suite'
```

### Laptop HD 630 (Local)

Run only one HD 630 measurement at a time, serialized with `flock` and bounded by `timeout`, after packing rooms (`python3 tools/pack.py`) and generating pages (`python3 tools/site.py`):

```sh
for r in lobby about projects experience writing comms; do
  for t in 1 0; do
    flock -w 600 /tmp/arcadia-local-hd630.lock timeout 300s \
      tools/dbench.sh "?room=$r&shot=hero&scale=1&tier=$t" 3 8
  done
done
```

*(Once `O0` imports `/srv/arcadia/seed/perf-tools/` and adds `tools/ci/hd630.sh`, run local HD 630 checks through `tools/ci/hd630.sh`, which also wraps `load.mjs` for throttled `50 Mbit/s, 20 ms` and `10 Mbit/s, 40 ms` first-frame timings.)*
