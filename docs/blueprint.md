# Arcadia Station — blueprint (draft 2)

Interactive 3D model: `public/blueprint.html` (served at `/blueprint.html`), built by `public/js/blueprint.js` from the real room models.

## The station
- **Arcadia Station**: four spinning rings (01–04) on a central spine, 717 km above Earth. Ring radius 224 m at 2 rpm gives 1 g at the rim.
- The rim is the floor; "up" points at the spine. Windows are in a ring's outer face and look at Earth.
- **Ark Aurora** (1,480 m) is berthed alongside on a docking arm, boarding.
- Every room on the site is on one patch of Ring 04, the **Commons deck**.

## Deck layout (draft 3)
The ring is a circular pressure tube (12.6 m radius) with the main deck as a chord. Compartments sit in a row along it, antispinward to spinward, each closed by pressure bulkheads:

1. Navigation (Experience)
2. Fabrication Bay 02 (Projects) — cargo lift at its far end
3. Spoke core — lifts to the hub
4. Atrium (Home) — arrival from the lift; the Oculus on its spinward bulkhead
5. Optics bay — relay for the de-spun view from the hub telescope
6. Observation Lounge (About) — faces the Atrium across the optics bay
7. Library (Writing, planned)
8. Comms (Contact, planned)

Below deck: the Ring Line (tram + walkway through every compartment) and water tanks (shielding, ballast).

Reasons: round hull for pressure; compartments limit a breach to one room and give two exits; ships dock on the non-spinning hub axis, so arrivals and cargo come down the spoke; no rim windows because the ring turns at 2 rpm, so views are relayed from the hub; rings counter-rotate in pairs to cancel angular momentum.

## Atrium interactables
- Hologram: the mission globe.
- Doors: four stair doors in the side bays down to the Ring Line, each signed for a destination.

## Consequences for the built rooms (not done)
- Atrium: gates become four signed stair doors in the fifth and seventh bays (the ones visible from the arrival point); the back wall becomes the lift lobby. Re-bake.
- Lounge window and Atrium portal are relay optics, not hull windows.
- Fabrication's bay door is the cargo lift.
