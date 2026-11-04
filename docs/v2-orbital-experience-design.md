# Orbital experience: design and implementation brief

The user rejected the abstract line-and-dot experience visual and asked for high-fidelity, recognizable planets that the visitor can orbit. GPT-6.1-Terra implements this brief; the parent reviews screenshots and camera interaction before deployment on `v2-rewrite`.

## Visual direction

Build a restrained orbital observatory. The main view is a large, textured planet with a clear day/night boundary, lit surface detail and depth against almost-black space. Use a thin atmospheric edge on Earth, separate drifting clouds, and restrained night lights on the dark hemisphere. Saturn needs a tilted, finely textured transparent ring plane with visible gaps and planet/ring occlusion. Moon and Mars surfaces must have readable relief; Jupiter should show distinct cloud bands. Keep the planets' natural colors; the supplied amber #DFA05D, brick #AC5045 and green #658761 belong primarily to controls, selection indicators and typography.

A close-up planet should occupy roughly half to two-thirds of the scene height on entry. The current tiny glowing nodes and decorative wavy path are replaced. Use a dark, quiet background, a faint Milky Way and sparse stars with varied brightness. Avoid dense particle noise, giant glow halos, decorative HUD gauges, invented telemetry, or excessive bloom.

Use one strong sun direction and low fill so the surface remains dimensional. Tone mapping and texture color spaces must be correct. Surface quality and camera framing matter more than rendering every planet at once. Let visitors choose Earth, Moon, Mars, Jupiter and Saturn; the active world gets high-quality maps while other resources load on demand. A system overview is optional only if it does not compromise the close-up experience.

## Reference board

1. [NASA atmospheric limb photograph](https://www.grc.nasa.gov/WWW/k-12/airplane/atmosphere.html), [direct image](https://www.grc.nasa.gov/www/k-12/airplane/Images/atmosphere.jpg): thin blue atmospheric edge and cloud-layer depth. Borrow the edge thickness and surface-to-space contrast.
2. [NASA Earth airglow photograph](https://www.nasa.gov/image-article/wispy-atmospheric-layer-of-air-glow-crowns-earths-horizon/): subtle horizon illumination against black, with warm night-side lights. Keep glow restrained.
3. [NASA/JPL-Caltech/SSI: The Day the Earth Smiled](https://svs.gsfc.nasa.gov/30520), [reference image](https://svs.gsfc.nasa.gov/vis/a030000/a030500/a030520/PIA17172_labels_print.jpg): ring-plane tilt, fine concentric gaps, lighting and silhouette. Our default should expose more lit surface than this dramatic backlit photograph so the planet reads clearly.
4. [NASA Eyes](https://science.nasa.gov/eyes/) and [Eyes on the Solar System](https://eyes.nasa.gov/apps/solar-system/): camera orbit around a focused target, direct target selection, and inspectable surface scale. Borrow the navigation concept, not the site's branding or its full science interface.
5. [Solar System Scope maps](https://www.solarsystemscope.com/textures/): equirectangular day, night, cloud and ring maps. These are CC BY 4.0, with some artistic enhancement; do not claim a scientifically accurate orbital simulation.

Use the existing optimized files in `public/images/trajectory/`. Their README documents NASA and Solar System Scope provenance. Preserve visible credit links and update the now-obsolete renderer references there. The reference photographs are design references; do not hotlink them as product dependencies or download unrelated search-engine thumbnails into the site.

## Composition and interaction

- `/resume` remains the canonical experience route. Introduce the scene with a short heading and one line explaining orbit controls. Keep the actual CV content below, always server rendered.
- Give the scene a generous desktop height (roughly 600–720 px where space allows). Frame the planet with breathing room. Put concise factual entry information in an adjacent panel or unobtrusive lower corner, not across the planet. On mobile, use a shorter scene and place details below it.
- The latest user instruction requires automatic startup and the visual as the default experience. Initialize Three.js automatically on /resume and show the orbital hero immediately; keep an attractive existing-asset poster only while loading or as the no-JavaScript/error fallback. No initial start button is required. Other routes still must not download Three.js.
- Drag genuinely moves the camera around the active planet. Wheel/pinch zoom approaches and retreats with sensible collision and distance bounds. Use OrbitControls or equivalent, damping and a reset-view action. Keyboard arrows orbit; plus/minus zoom; Home resets. Touch interaction should be obvious and contained to the scene.
- Choose a world directly, plus previous/next controls where helpful. Smoothly reframe the selected world; respect reduced motion by switching without travel animation. Keep the active target identifiable. A slow optional auto-orbit may be paused; do not force continuous camera movement on reduced-motion users.
- Associate work/education entry details only with real CMS data. Planet selection must work independently of how many CV entries exist; do not invent an employer or achievement to fill a planet. A short note can explain that this is a visual journey through the experience record, with illustrative scale.
- Controls use plain labels: Earth, Moon, Mars, Jupiter, Saturn, Reset view, Pause motion, Resume motion, Close visual and Reopen visual when appropriate. Provide focus states, real buttons, pressed/selected state and accessible current-target information. Keep mobile touch targets at least 44 px.

## Engineering and acceptance

Use the installed Three.js version and existing textures. Load 2k planetary maps on suitable desktops and 1k maps on small/constrained devices; cap device pixel ratio and avoid full-resolution postprocessing. At most the active planet needs high mesh detail. Use deterministic star placement, pause when hidden/offscreen, dispose geometries/materials/textures/controls/listeners and handle texture/context failures with a helpful fallback. No-JS paths retain the CV and poster. Reduced-motion users get an automatically rendered static planet with manual orbit controls; disable automatic spin/camera travel, not the entire visual.

Review actual rendered Earth and Saturn screenshots at desktop and mobile, not only code or a successful canvas creation. Verify pointer orbit changes the viewpoint, zoom has bounds, planet selection updates the visible world, reset works, pause/reduced-motion behave, and closing/reopening leaves one renderer. Check console and shader errors. Measure the activated scene load and report limits honestly. Keep normal articles free of Three.js downloads. Add or adapt only meaningful interaction tests; then build, typecheck and run the relevant browser checks before deployment.
