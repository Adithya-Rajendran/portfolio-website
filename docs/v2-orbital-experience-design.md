# Scroll-driven orbital experience

The approved reference puts a large, detailed planet beside a readable experience timeline, with a wide heading, quiet controls and open space. The current `/resume` implementation follows that composition and makes page scrolling drive the journey.

## Behavior

- Earth appears automatically; the remaining worlds preload after the first scene.
- Native page scrolling drives Earth → Moon → Mars → Jupiter → Saturn. The camera pulls back, brings both worlds into view, then approaches the next one. Reverse scrolling reverses that path.
- Journey positions derive from the actual timeline. Buttons jump to the corresponding scroll position. These worlds illustrate exploration; they do not represent factual places of employment or education.
- The wheel always scrolls the page. Drag or arrow keys orbit; plus/minus deliberately zoom; Home resets the current view. Mobile keeps one-finger scrolling and two-finger orbit controls.
- Pause or reduced-motion preferences disable travel and spin; scrolling then switches directly to a static world.
- Desktop keeps the planet beside the record. Mobile uses a compact view above the entries. The record, résumé links, chapter links and credentials remain readable without JavaScript.

## Rendering

`src/scripts/experience.ts` owns scrolling, camera motion, lifecycle and controls. `src/scripts/planet-materials.ts` owns the planetary geometry and materials. Earth combines a 4K day map on suitable desktops, NASA clouds and night lights, an ocean mask, directional lighting and a thin atmosphere. Small devices use 1K maps. Saturn has textured radial rings and shadows. Pixel ratio is capped at 1.5.

A failed initial load leaves the poster and retry button. If a later world fails, the last available world remains visible and its selector can retry. Rendering pauses when hidden or offscreen; all graphics resources and listeners are disposed on page exit. Ordinary articles load neither the renderer nor its maps.

## Visual system

Manrope headings, DM Mono annotations, charcoal and cream, amber `#DFA05D`, brick `#AC5045`, and muted green `#658761`. Planet colors retain natural variation. The heading and timeline sit in the same composition as the visual, without a boxed control panel.

## Verification

Review actual desktop/mobile screenshots and forward/reverse scroll states, including the middle of a transition. Browser contracts cover automatic start, scroll pullback, reverse travel, manual controls, pause, reduced motion, one-finger page scrolling, context loss/retry, article isolation and no-JavaScript reading. Fixture runs explicitly select `tests/v2/browser/worker.env` so a developer's live CMS settings cannot replace the test data.

Map provenance and adaptations are recorded in `public/images/trajectory/README.md`. The planning reference is `assets/artwork/experience-flow-v1.png`.
