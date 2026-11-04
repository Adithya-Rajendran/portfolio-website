# Scroll-driven orbital experience

The approved reference puts a large, detailed planet beside a readable experience timeline, with a wide heading, quiet controls and open space. The current `/resume` implementation follows that composition and makes page scrolling drive the journey.

## Behavior

- Earth appears automatically; the remaining worlds preload after the first scene. Two original satellites orbit on different inclinations, with solar cells, thermal foil, antennas and instrument bodies. Their size is deliberately exaggerated for readability.
- Native page scrolling drives Earth → Moon → Mars → Jupiter → Saturn. The camera pulls back, brings both worlds into view, then approaches the next one. Reverse scrolling reverses that path.
- Journey positions derive from the actual timeline. Buttons jump to the corresponding scroll position. These worlds illustrate exploration; they do not represent factual places of employment or education.
- Moon and Mars arrivals reveal original surface-scale architectural studies. Moon has thirteen pressure habitats, greenhouses, a geodesic observatory, fabrication hall, rover plaza, power arrays and an electromagnetic cargo launch rail. Mars has pressure habitats, gardens, a science district, rover facilities, ISRU storage and a Starship-inspired transport.
- The surface camera visits four districts with smooth ten-second legs. Drag, arrow keys or the +/- controls immediately hand over to free exploration. It stays there until Reset/Home or travel to a different world. Reset restores the guided tour. The wheel continues to scroll the page; mobile keeps one-finger scrolling and two-finger orbit controls.
- Pause or reduced-motion preferences disable travel and spin; scrolling then switches directly to a static world.
- Desktop keeps the planet beside the record. Mobile uses a compact view above the entries. The record, résumé links, chapter links and credentials remain readable without JavaScript.

## Rendering

`src/scripts/experience.ts` owns scrolling, camera motion, lifecycle and controls. `src/scripts/planet-materials.ts` owns planetary geometry and materials. Earth combines an 8K surface on suitable desktops, 4K cloud and night-light layers, a normal map, an ocean reflectance map, displaced cloud shadows and a thin atmospheric rim. Small, low-memory and data-saving devices use 2K Earth layers. Texture-size limits are checked. Pixel ratio is capped at 2. Saturn retains textured rings and shadows.

`src/lib/scene-time.ts` reads the visitor's local device clock: dawn 06:00–08:59, day 09:00–16:59, dusk 17:00–19:59, night 20:00–05:59. Four authored lighting treatments change direction, warmth, the terminator and visible city lights. The page checks each minute and when a tab becomes visible. It makes no time-zone, geolocation or weather request. These are illustrative lighting treatments, not an astronomical ephemeris.

The full-page Milky Way is a perspective projection of ESO/S. Brunier's photographic celestial panorama. The source is projected with JavaScript, rather than rotating a rectangle with visible empty corners. Credit is always visible beside the scene. The foreground remains dark enough to read.

`src/scripts/orbital-satellites.ts` contains the original satellite geometry. `src/scripts/planetary-outposts.ts` loads compressed original Blender models and defines the district camera paths. Surface models share a bounded environment map and are disposed on exit, including embedded textures and Draco workers. Draco's local JavaScript decoder needs no extra evaluation privileges. `/resume` alone allows local blob fetches for embedded GLB images; other page policies stay unchanged.

Four GPU-rendered Earth posters match the lighting treatments during loading or a graphics failure. Blender/Cycles successfully used the laptop's NVIDIA GTX 1050 Ti via CUDA. The live page uses real Three.js geometry, not the Blender preview renders.

A failed initial load leaves the poster and retry button. If a later globe fails, the last available world remains visible and its selector can retry. A missing surface model leaves its globe usable. Rendering pauses when hidden or offscreen; graphics resources, timers and listeners are disposed on page exit. Pause and reduced motion also stop satellite, cloud and guided-camera movement. Ordinary articles load neither the renderer nor its maps or models.

## Reproduction and references

Run `node scripts/artwork/prepare-orbit-assets.mjs` for the new planet layers and sky. Run `node scripts/artwork/prepare-outpost-ground.mjs`, then `blender -b --python scripts/artwork/build-outposts.py` to export the two Draco-compressed GLBs. Adding `-- --render` makes GPU previews. `scripts/artwork/render-earth-posters.py` renders the four fallback planets on CUDA; `scripts/artwork/encode-earth-posters.mjs` prepares their web deliveries.

The settlements are original, imagined future architecture informed by [NASA's Mars Surface Habitat concept study](https://ntrs.nasa.gov/citations/20230014593), [SpaceX's Mars program](https://www.spacex.com/mars), [O'Neill/SSI mass-driver research](https://nss.org/l5-news-mass-driver-update/) and [SpaceX's lunar manufacturing concept](https://www.spacex.com/updates). They are not official NASA/SpaceX designs or engineering plans. Ground material is a tinted adaptation of Poly Haven's CC0 [Rocks Ground 06](https://polyhaven.com/a/rocks_ground_06).

## Visual system

Manrope headings, DM Mono annotations, charcoal and cream, amber `#DFA05D`, brick `#AC5045`, and muted green `#658761`. Planet colors retain natural variation. The heading and timeline sit in the same composition as the visual, without a boxed control panel.

## Verification

Review actual desktop/mobile screenshots and forward/reverse scroll states, including the middle of a transition. Browser contracts cover automatic start, scroll pullback, reverse travel, manual controls, pause, reduced motion, one-finger page scrolling, context loss/retry, article isolation and no-JavaScript reading. Fixture runs explicitly select `tests/v2/browser/worker.env` so a developer's live CMS settings cannot replace the test data.

Map provenance and adaptations are recorded in `public/images/trajectory/README.md`. The planning reference is `assets/artwork/experience-flow-v1.png`.
