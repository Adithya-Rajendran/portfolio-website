# Optimization pass: rolling-Earth rooms (`lobby`, `about`)

Branch `opt/rolling-pass`, from `bd54399` (baseline). Target: Intel HD 630 (Mesa, ANGLE GL backend), Chromium in the
Playwright Docker image, 1920x1080, devicePixelRatio 1.

## How it was measured

- **State, always pinned:** `?shot=hero&scale=1&tier=0|1` (the governor cannot change resolution or tier). The sky
  rolls at the room's own 120 s period and the orrery turns, as on the live page.
- **Frame time (`tools/dbench.sh`):** the method of `tools/dperf.sh`, i.e. rAF intervals with a 1-px `readPixels` per
  frame, so each frame is waited for. The median and p95 are over 8 s, in a fresh browser context per run.
  - Two additions. Every frame is synced from page start, not only while measuring. Otherwise a fast room (`about`)
    queues seconds of unsynced frames while loading, and the first synced frame waits for all of them. Two of the
    first three baseline `about` runs measured 8 s per frame because of this. `dperf.sh` still has the problem.
  - The second addition is one GPU timer query (`EXT_disjoint_timer_query_webgl2`) around the whole frame. It is much
    less noisy than frame time, which also contains ~6-8 ms of CPU work, so it is reported alongside.
- **Runs:** at least 3 per variant, 5 for every frame-time decision and for both tables. The value given is the
  median of the run medians, with the per-run values or their range.
- **GPU memory:** every WebGL allocation is hooked (`texStorage2D`, `texImage2D`, renderbuffers, minus deletions).
  Read after one full turn of the sky (`?roll=3`, 5 s), so all sky layers the code ever uploads are counted.
  "Baked textures" are the mipmapped RGBA8 lighting atlases. RSS is the Chromium renderer process (decoded images
  live there; an integrated GPU shares that RAM).
- **Load:** requests and bytes from Resource Timing. "Cover lifts" is the first interactive frame (`ready() > 0`).
  "First complete frame" is the first frame in which every texture the room uses is on the GPU. The baseline lifted
  the cover before its textures had arrived (see 6 below), so both are given.
- **Picture (`tools/detsnap.sh`, `tools/pdiff.sh`):** 24 fixed states at 1920x1080.
  - Lobby and about: hero at roll 0, 45, 90, 180 and 300°; close shot at 90°; tier 1 at 45°; rolling sky (time-based);
    fast roll `?roll=6` with layer switches during the run; two inspect poses (`?focus=0`, `?focus=1`).
  - Projects and experience: hero, once each. The orrery is pinned with `?chand=30`.
  - Time is Playwright's fake clock, stepped 1/60 s per frame, and `Math.random` is seeded per calling file. So grain,
    storms, dust, screens and the hologram are reproducible: two runs of the same code differ by exactly 0. Any
    difference is therefore a real one.
- **Noise:** the machine was shared (other agent sessions, MAAS), so expect ±1-3 ms between runs of lobby frame time.
  The GPU time spread is usually ±0.3 ms.

## 1. Baseline (`bd54399`)

| room | tier | frame ms, median [runs] | p95 ms | GPU ms | draw calls | triangles | textures | GPU memory (baked textures) | renderer RSS | cover lifts: ms / req / KB | first complete frame: ms / req / KB |
|---|---|---|---|---|---|---|---|---|---|---|---|
| lobby | 0 | **53.1** [53.1 53.0 50.5 54.3 53.6] | 130.2 | 41.9 | 182 | 337,625 | 78 | 1070 MB (871) | 846 MB | 2313 / 109 / 10,863 | 3768 / 109 / 10,863 |
| lobby | 1 | **39.2** [37.2 39.2 38.2 39.9 39.3] | 91.2 | 26.9 | 182 | 337,625 | 78 | 984 MB (881) | 847 MB | (as tier 0) | (as tier 0) |
| about | 0 | **33.6** [32.8 33.8 33.4 33.9 33.6] | 48.5 | 27.6 | 63 | 89,948 | 46 | 926 MB (743) | 710 MB | 652 / 58 / 4,808 | 3021 / 81 / 6,775 |
| about | 1 | **24.0** [24.6 24.2 23.6 23.8 24.0] | 27.5 | 18.4 | 63 | 89,948 | 46 | 831 MB (743) | 710 MB | (as tier 0) | (as tier 0) |

Load timings are measured at tier 0 (5 runs, medians); loading does not depend on the tier.

**Lobby tier 0, where the GPU time went** (per-pass timer queries, medians):

| pass | GPU ms |
|---|---|
| scene pass | 24.6 |
| floor mirror | 10.8 |
| final pass | 2.9 |
| sun shadow map | 2.1 |
| bloom | 1.4 |

Tier 1 has the same passes with a scene pass of 11.3 ms, a 7.0 ms mirror and a final pass of 4.9 ms (FXAA). The
p95 was set by a 120-260 ms frame once a second (see 2 below).

## 2. Optimizations tried

Before → after are medians over 5 runs (3 where noted), measured against the previous commit; `[a-b]` is the
run-to-run range. "GPU" is the whole-frame timer query. Every kept change is pixel-identical (max 0, mean 0) to the
baseline in all 24 states, except where stated.

| # | what | measured before → after | kept? | commit |
|---|---|---|---|---|
| 1 | **Mirror pass drawn only where the floor can read it.** A floor point is its own mirror image, so the floor samples the mirror only inside its own screen footprint, padded by its blur reach (±5 lobe widths, mip footprints up to 2^(lod+3) px). The floor's bounding box is projected and clipped at the near plane, then used as a scissor. | GPU: lobby t0 41.9 [41.8-43.0] → 40.4 [39.6-40.8]; lobby t1 26.6 [26.4-27.9] → 25.7 [25.3-26.5]; about t0 27.6 [27.6-27.9] → 26.1 [26.0-26.3]; about t1 18.4 [18.3-18.5] → 17.8 [17.8-18.0]. Frame: lobby t0 53.6 → 51.3, t1 39.0 → 35.9; about t0 34.2 [33.4-34.3] → 31.2 [31.2-32.0], t1 24.2 → 23.6 | kept | `1b9e5f6` |
| 2 | **Wall screens: no more 20 ms sRGB canvas uploads.** Chrome/ANGLE takes ~20 ms to upload a canvas into an `SRGB8_ALPHA8` texture; RGBA8 takes ~2 ms. The lobby redraws 4-5 screens every second, which gave a 120-260 ms hitch each second. Now one shared RGBA8 staging texture is used, and one draw decodes it into the screen's sRGB render target (the hardware re-encodes). That is 3.2 ms for upload, decode and mipmaps. All 256 codes round-trip exactly, and every screen texture equals its canvas byte for byte. | lobby t0: p95 125.0 [118.9-176.3] → 64.0 [61.3-64.6], worst frame ~230 → ~80 ms, median 48.9 → 45.7. lobby t1: p95 85.3 [80.5-96.6] → 47.9 [47.6-48.3], median 37.5 → 35.4. about: unchanged (its placards are drawn once). +2.7 MB | kept | `2941bbc` |
| 3 | **Depth pre-pass for the baked surfaces.** Measured overdraw is 1.9 (lobby) and 2.1 (about) shaded baked fragments per pixel. Each baked mesh gets a depth-only child (same vertex code, so identical depths; `renderOrder` −1). It is drawn in the same `render()` call, because a separate pass would cost a second MSAA resolve. | GPU: lobby t1 25.8 [25.5-26.5] → 23.0 [22.7-23.6]; about t1 18.0 [17.8-18.1] → 15.0 [14.9-15.0]; about t0 26.2 [26.1-26.5] → 25.2 [25.0-25.6]; lobby t0 39.9 [39.0-40.2] → 38.8 [37.5-39.9]. Frame: lobby t1 36.7 → 33.8, about t1 23.7 → 21.0, about t0 31.9 → 31.0; lobby t0 47.7 → 48.9 (within spread). +18 / +14 draw calls (depth-only) | kept | `9eda65b` |
| 4 | **MSAA targets resolve colour only** (`resolveDepthBuffer: false` on the scene and mirror targets). By default three also blits the multisampled depth out on every resolve; nothing reads it, and here it cost ~5 ms per frame. | GPU: lobby t0 38.4 [37.8-39.5] → 33.4 [32.9-35.2]; about t0 25.1 [25.1-25.6] → 19.2 [19.1-19.5]. Frame: lobby t0 47.7 [45.5-49.6] → 42.0 [41.2-45.8]; about t0 30.7 [29.8-31.0] → 24.9 [24.6-25.8], p95 47.3 → 29.3. Tier 1 (no MSAA): unchanged, as expected | kept | `bd01cf9` |
| 5 | **Shadow map: one-byte colour attachment that is never cleared** (only its depth is used). | GPU memory −16 MB in each spinning room. Frame time within spread in all four configurations (e.g. lobby t0 42.4 [42.1-42.8] → 41.9 [40.3-42.2]) | kept (memory) | `6428284` |
| 5b | 16-bit shadow depth on top of 5. | Shadow pass 2.14 → 1.83 ms (lobby), −8 MB; but ~90 pixels per frame flip at shadow edges (max diff up to 103) | **reverted** | |
| 6 | **Bug fix: the room really waits for its textures.** `LoadingManager` has no `itemsLoaded`/`itemsTotal` properties, so the wait compared `undefined === undefined` and the cover lifted on an untextured room. In about only 16 of 81 files had arrived. Each texture now has a promise. | First complete frame: lobby 3633 [3453-5135] → 3256 [3188-4449] ms, about 2785 [2573-3398] → 2402 [2309-2934] ms, because the render loop no longer competes with decoding and upload. The cover now lifts on a complete room | kept | `2ab530b` |
| 7 | **Close each decoded ImageBitmap once its texture is on the GPU.** Otherwise a 4096 px atlas keeps 64 MB of decoded copy in RAM for the room's lifetime. | Renderer RSS: lobby 849 → 221 MB, about 711 → 186 MB (3 runs each, within 5 MB). Frame time and GPU memory unchanged (3 runs) | kept | `26f91ca` |
| 7b | Upload each texture as soon as it arrives (`initTexture`). | No load-time gain (lobby first complete frame 3256 → 3284 ms, about 2402 → 2549 ms), and all 48 sky layers would sit on the GPU from the start | **not kept** | |
| 8 | **Sky layers on demand.** Of the 6 baked angles, only the pair either side of the sky's angle is drawn, and the sky moves one angle per 20 s. So 3 per group are kept (the pair and the next, fetched a whole step ahead), and the one behind is freed. `4efc18b` adds a guard: switch only once both layers of the new pair have arrived, else hold the last baked angle. | GPU memory after a full turn: lobby 1067 → 1024 MB, about 913 → 871 MB. To first complete frame: lobby 109 → 85 requests, about 81 → 57 requests, −140 KB each; load time within spread. Frame time unchanged (3 runs). Identical also in the two states with layer switches during the run | kept | `d2fd9cb`, `4efc18b` |
| 9 | **three.js loaded minified.** The vendored `three.core.js`/`three.module.js` are byte-identical to the npm 0.181.2 build, so its `.min.js` files are the same code; the readable files stay alongside. | Bytes to first complete frame: lobby 10.48 → 9.24 MB, about 6.48 → 5.24 MB. Time: lobby 3249 [2910-3975] → 3179 [3045-3875] ms, about 2780 [2714-2901] → 2547 [2421-2823] ms | kept | `519a65c` |
| 10 | Shaders compiled behind the cover (`renderer.compileAsync`). | Worst frame after reveal: lobby 258 → 298 ms, about 29 → 59 ms (within spread; the post-reveal stall is texture upload on the GPU, not compilation) | **reverted** | |
| 11 | Floors excluded from the shadow casters. | Shadow pass −0.35 ms (lobby), −0.13 ms (about); anything below floor level could be lit wrongly at untested sun angles | **not kept** | |

## 3. Final (`4efc18b`)

| room | tier | frame ms, median [runs] | p95 ms | GPU ms | draw calls | triangles | textures | GPU memory (baked textures) | renderer RSS | cover lifts = first complete frame: ms / req / KB |
|---|---|---|---|---|---|---|---|---|---|---|
| lobby | 0 | **43.5** [42.5 44.1 43.5 41.9 45.6] (−18%) | 62.3 (−52%) | 33.8 (−19%) | 200 | 489,491 | 79 | 1024 MB (839) | 197 MB | 3315 / 85 / 9,466 |
| lobby | 1 | **32.0** [30.4 34.1 26.8 32.0 32.5] (−18%) | 48.1 (−47%) | 22.7 (−15%) | 200 | 489,491 | 79 | 928 MB (839) | 188 MB | (as tier 0) |
| about | 0 | **25.4** [24.1 25.3 25.7 25.4 25.4] (−24%) | 28.8 (−41%) | 19.1 (−31%) | 77 | 145,352 | 47 | 870 MB (700) | 160 MB | 2688 / 57 / 5,371 |
| about | 1 | **21.1** [20.7 21.6 21.1 21.0 21.1] (−12%) | 24.5 (−11%) | 15.0 (−18%) | 77 | 145,352 | 47 | 775 MB (700) | 160 MB | (as tier 0) |

Baseline and final were measured in the same session, interleaved, with the same command.
- **Draw calls and triangles** rose because of the depth-only pre-pass (item 3), which is the cheapest geometry in the frame.
- **First complete frame:** lobby 3768 → 3315 ms (−12%), about 3021 → 2688 ms (−11%). The cover now lifts later than
  in the baseline (lobby 2313 → 3361 ms, about 652 → 2715 ms), but the baseline lifted it on an untextured room.
  About's worst frame after the reveal went from 412 to 59 ms.

**Cross-check with the unchanged `tools/dperf.sh`** (3 runs each, median/p95 ms; it has the backlog problem described above):

| room | tier | baseline | final |
|---|---|---|---|
| lobby | 0 | 50.1/194 · 53.5/151 · 49.3/114 | 42.3/62 · 40.1/56 · 42.6/63 |
| lobby | 1 | 36.0/79 · 35.9/82 · 37.3/79 | 28.5/49 · 33.6/48 · 28.6/46 |
| about | 0 | 32.9/49 · 33.5/48 · 32.8/49 | 25.0/32 · 24.0/29 · 24.6/29 |
| about | 1 | 23.6/27 · 24.6/29 · 23.7/27 | 21.7/25 · 20.7/24 · 20.1/25 |

**Where the GPU time goes now** (ms per frame):

| room, tier | scene pass | mirror | final pass | shadow map | bloom |
|---|---|---|---|---|---|
| lobby, tier 1 | 9.2 | 5.0 | 4.9 | 2.2 | 1.5 |
| lobby, tier 0 | 20.3 | 6.3 | 2.9 | 2.2 | 1.4 |

**Visual diff, baseline vs final.** Every one of the 24 states compares at **max 0, mean 0, 0% of pixels off by more
than 2**:

| room | states (max 0, mean 0 each) |
|---|---|
| lobby | hero at roll 0, 45, 90, 180 and 300°; close shot at 90°; tier 1 at 45°; rolling sky; fast roll (`?roll=6`); `focus=0`; `focus=1` |
| about | the same 11 states as lobby |
| projects | hero |
| experience | hero |

The four screen textures are checked separately: each equals its canvas byte for byte. Room changes
(lobby → about → lobby → about) produce no errors and no growth in texture memory or RSS.

## 4. Not done, and what would need a re-bake or a tooling change

**Rejected because the picture would change, even slightly:**
- **Tone mapping and look through a 3D LUT.** AgX alone costs 1.1 ms of the 2.9 ms final pass (measured by removing
  it). A LUT replacing AgX, contrast, saturation and the sRGB encode would save an estimated ~1 ms on both tiers, at a
  maximum error of about 1/255.
- **Light shaft added after the MSAA resolve.** Its blend into four samples costs ~1.5 ms more at tier 0 than at
  tier 1. Adding it after the resolve is equal in maths, but rounds differently in R11G11B10.
- **A cheaper NaN guard.** `safe()` on the nine FXAA taps costs 1.2 ms at tier 1. Any faster form relies on NaN
  comparisons that drivers may optimise away, and the guard exists for WebKit.
- **Rendering the shadow map at half rate.** The sun moves 0.05° per frame, so a shadow 30 m away would step about
  5 cm every other frame.
- **Items 5b and 11 above.**

**Needs a re-bake or a tooling change** (estimates):
1. **GPU-compressed lighting textures.** This is by far the largest remaining item. Baked RGBA8 atlases are 839 MB
   of lobby's 1024 MB and 700 MB of about's 870 MB, and the six 4096² atlases alone are 512 MB. The HD 630 samples
   BC7/BC6H and ASTC natively (both are exposed here).
   - **Gain:** at 8 bpp with pre-built mipmaps, lobby would need about 210 MB instead of 839 MB (−630 MB), and about
     about 175 MB instead of 700 MB (−525 MB).
   - **Load:** the ~2.3 s main-thread upload and mipmap stall at load (one long task in lobby) and the ~300 ms GPU
     stall after the reveal would shrink roughly 4×, for an estimated 1.5-2 s earlier first frame here.
   - **Tooling:** BC6H would also make the sqrt/`dec()` encoding unnecessary. It needs an encoder step in `bake.py`
     (toktx/basisu/Compressonator) and KTX2 loading (three's KTX2Loader; with zstd supercompression, its zstd
     decoder).
   - **Cost:** download size grows. Lossy WebP is about 0.1 bpp here; even UASTC with RDO and zstd is several times
     larger. Worth doing at least for the 4096² atlases, measuring the byte cost first.
2. **Bake the smooth layers at lower resolution.** The orrery phase layers (24 × 1024² = 134 MB in lobby) and the sky
   layers hold indirect light only. At 512², lobby would save about 100 MB, which a diff of a re-bake must confirm.
3. **Pack layers into fewer files.** Combining the six sky angles and the three orrery phases per group into one
   file each would cut lobby from 85 to about 40 requests and about from 57 to about 30. This matters on
   high-latency links over HTTP/1.1.
4. **Smaller `room.glb`.** It is 4.6 MB in lobby and 1.6 MB in about.
   - `KHR_mesh_quantization` (GLTFLoader reads it natively, no decoder): about −40-50%.
   - meshopt (needs three's `meshopt_decoder` addon): about −70%.
5. **HTTP compression.** The dev server sends everything uncompressed. gzip/brotli on the host would shrink the
   ~1 MB of JS by ~70% and the glb by ~30%.
6. **Dead file:** `assets/about/lobby.glb` (1 MB) is never requested.

**Headroom for animated characters with dynamic reflections:** a character is drawn three times per frame (scene,
floor mirror, sun shadow map). Items 1, 3 and 4 make the first two passes cheaper for everything in them. A character
should get the same depth-only child (item 3) and enable layer 1 to cast sunlight shadows.

## Reproduce

```
tools/dbench.sh "?room=lobby&shot=hero&scale=1&tier=1" 5          # frame / GPU / memory / requests
ORIGIN=http://<host>:<port> tools/detsnap.sh base                  # 24 deterministic states of some other checkout
tools/detsnap.sh final && tools/pdiff.sh base final                # max / mean pixel difference per state
```

## Follow-up: compressed textures, packed layers, compressed geometry (items 1, 3, 4 above)

Done after the pass above, by `tools/pack.py` (bakes now land in `assets-src/<room>/`; the script writes `public/assets/<room>/`,
which is generated and not in git; `tools/get-pack-tools.sh` fetches the three tools it needs).

- **Textures are KTX2** (UASTC + Zstandard; the surface-colour atlases BasisLZ), transcoded in workers to ASTC/BC7 and
  left compressed on the GPU, with mipmaps from the file. BasisLZ was tried for everything: a fifth of the download, but
  it showed as coloured blocks in dark, smooth light.
- **Layers are array textures:** one file per group for the three orrery phases and one for the six sky angles
  (replaces the on-demand loading of item 8).
- **Geometry is meshopt-compressed** (16-bit positions, float lightmap UVs).
- **Hosting:** `wrangler.jsonc` and `public/_headers` for Cloudflare Workers static assets. Everything under `/assets/`
  is requested with the bake's version and cached as immutable.

Same benchmark, same machine, 3 runs each (tier 0, pinned), before -> after:

| room | GPU memory (WebGL) | frame ms | GPU ms | requests | download |
|---|---|---|---|---|---|
| lobby | 1024 -> 391 MB | 40.4 -> 39.6 | 32.0 -> 31.0 | 85 -> 61 | 9.5 -> 25.0 MB |
| about | 870 -> 341 MB | 24.5 -> 24.0 | 18.7 -> 18.1 | 57 -> 49 | 5.4 -> 15.8 MB |
| projects | 631 -> 275 MB | 25.8 -> 25.3 | 20.4 -> 19.3 | 24 -> 32 | 4.1 -> 15.3 MB |
| experience | 606 -> 270 MB | 27.8 -> 25.1 | 19.2 -> 18.1 | 22 -> 30 | 2.5 -> 7.3 MB |

`room.glb`: lobby 4.8 -> 0.95 MB, about 1.6 -> 0.37, projects 1.6 -> 0.39, experience 0.79 -> 0.20.

The picture is no longer bit-identical: over the 24 states the mean difference is about 1/255 (0.1-1.2), with 2-14 % of
pixels off by more than 2 and about 1 % by more than 8, concentrated on edges. Side by side it is not visible.

Costs: the download is 2.7-3.7x larger, and load time over a real network was not measured. The memory counter in
`tools/docker/bench.mjs` did not know compressed formats or array textures; it does now. Not done: smaller smooth
layers (item 2), which would take about 4 MB off the lobby's download.
