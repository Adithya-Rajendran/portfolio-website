# Migration research: Solid 2.0, or Rust (2026-11-22)

The question: should the site move to Solid 2.0, or to something written in Rust? The site is currently plain ES modules with three.js vendored, no build step, no framework and no dependencies.

All the facts below were checked on 2026-11-22, against npm, crates.io, GitHub and caniuse. Sizes were measured, not quoted.

## What the site actually is

| | |
|---|---|
| Own JavaScript | 2,600 lines in 14 files; 73 KB gzipped |
| three.js r181, vendored (latest is r187) | 86 KB gzipped |
| A room's assets (KTX2 + meshopt) | 18 to 32 MB |
| Lines that touch the DOM | about 60: `main.js` 31, `blueprint.js` 15, `comms.js` 10, a few elsewhere |
| Custom GPU work | 29 hand-written fragment shaders (23 `ShaderMaterial`s, 1 `onBeforeCompile`), plus probes, mirror, post and sun shadow |
| Frame cost (HD 630) | 26 to 60 ms. It is bound by the GPU (fill, lamp lobes, reflections); JavaScript is a small fraction |

So the site is a renderer with a thin page layer: header and nav, hero text, footer, the inspect bar and the blueprint page. Any migration has to say which of those two parts it replaces.

## Option A: Solid 2.0

- **Status:** `solid-js` 2.0.0 was released on 2026-11-17 and is at 2.0.3 today (three patch releases in two days). 1.9.x is still maintained under the `v1-latest` tag. The migration guide is `documentation/solid-2.0/MIGRATION.md` in `solidjs/solid`.
- **Works with no build step:** `@solidjs/html` 2.0.1 parses tagged templates at runtime ("no `new Function`/`eval`, CSP-safe"). The package's own README says it is "slightly less efficient than JSX" and "not treeshakeable", and that expressions must be wrapped by hand.
  - Measured: a minimal HUD (nav list, a `<Show>`, a signal) bundled with `solid-js` + `@solidjs/web` + `@solidjs/html` is **61 KB minified, 24 KB gzipped**.
  - It would be vendored as one pre-bundled file next to three.js. The npm `@solidjs/signals` package alone is 45 separate modules, so serving it unbundled is not practical.
- **What it would replace:** `fillHud()` (which builds HTML strings into `innerHTML`), the nav, the inspect bar with its door and option buttons, and the blueprint page. That is roughly 60 to 100 lines.
  - It does not touch the renderer. The frame loop, picks and camera glide stay imperative three.js.
  - Solid's signals could hold the shared state (room, focus, mode), but that state is small today.
- **Pros:**
  - Declarative page layer.
  - A natural home for more real HTML: accessible text versions of what is drawn on canvases (the Library's pages, the terminal), SEO, and forms.
- **Cons:**
  - The project's "no framework, no dependencies" rule.
  - A major version that is five days old; its own RFC index lists many behaviour changes (microtask batching, split effects, `onSettled`, draft-first stores).
  - Full speed needs JSX, and JSX needs a build step.
- **Verdict:** low risk, low reward today. It becomes worth doing if the page layer grows, for example real article pages in the Library or an accessible HTML mirror of the 3D content. If so, wait a few weeks for 2.0.x to settle, and use `@solidjs/html` to keep the no-build rule.

## Option B: Rust

| Crate | Version (2026-11-22) | Notes |
|---|---|---|
| Leptos | 0.8.23 (0.9.0-rc1) | fine-grained signals, like Solid |
| Dioxus | 0.7.10 (0.8.0-alpha.3) | |
| Sycamore | 0.9.4 (0.10.0-beta.1) | |
| Yew | 0.23.0 | |
| Bevy | 0.20.1 | game engine; WebGL2 and WebGPU builds |
| wgpu | 30.0.2 | the GPU layer under Bevy |
| three-d | 0.19.0 | |
| wasm-bindgen | 0.2.130 | |
| workers-rs (`worker`) | 0.9.0 | Cloudflare Workers in Rust |

- **B1. A Rust UI framework for the page layer only:**
  - Not recommended. It would replace about 100 lines of DOM code with a WASM binary, a Rust toolchain (`cargo`, `trunk` or `cargo-leptos`), and `wasm-bindgen` glue for every call between the page and three.js.
  - The Leptos book says WASM binaries "are significantly larger than the JavaScript bundles you'd expect for the equivalent application". I did not compile a Leptos build to measure it, because no Rust toolchain is installed here.
- **B2. Rewriting the renderer in Rust (Bevy, or raw wgpu):**
  - Not recommended. It is a full rewrite:
    - KTX2/Basis and meshopt loading;
    - all 29 shaders ported to WGSL;
    - the probes, mirror reflections, sun shadow and post-processing;
    - the picking and the camera glide.
  - Measured: Bevy's own hosted "3D scene" example (`bevy-webgl2-examples.pages.dev`) downloads **7.6 MB of gzipped WASM (24 MB unpacked)**, about 90 times three.js.
  - WebGPU support (caniuse): **86.8 %** of users, with Firefox only on Windows and macOS 26, Safari only on macOS 26, and Chrome on Linux depending on drivers. A WebGL2 fallback build would still be needed.
  - The frame time is set by the GPU, so moving the CPU side to Rust would not make the slow rooms faster.
- **B3. Rust where it fits: the Comms endpoint:**
  - The terminal posts to `comms.endpoint` when one is set. The site already deploys as a Cloudflare Worker (`wrangler.jsonc`), and workers-rs (0.9.0, maintained by Cloudflare) builds Workers in Rust.
  - A small Rust Worker could:
    - accept the JSON message;
    - limit how often one sender can post, and filter spam;
    - forward it by email.
  - The static site and its no-build rule stay as they are. This is the one place where adding Rust gives the site something it lacks.

## Also on the table: stay in JavaScript, move to WebGPU in three.js

- three.js r187 has `WebGPURenderer`, which falls back to WebGL2 by itself.
- It does not run `ShaderMaterial`, so the 29 hand-written shaders would have to be rewritten in TSL (three.js's node shader language).
- Of the GPU options, it is the cheapest. Whether it is faster on the HD 630 is unmeasured.

## Recommendation

1. **Don't migrate the renderer.** Neither Solid nor Rust speeds up the slow part, the GPU, and a Rust renderer costs about 7.6 MB of WASM before any room loads.
2. **If you want Rust in the project:** write the Comms message endpoint as a Rust Cloudflare Worker (B3).
3. **If the page layer is going to grow** (article pages, an accessible HTML mirror): adopt Solid 2.0 for that layer only, through `@solidjs/html` and a vendored bundle, once 2.0.x has settled.

Each of these changes the "no framework, no dependencies" rule, so it is your decision.
