# Arcadia Station — blueprint (draft 2)

Interactive 3D model: `public/blueprint.html` (served at `/blueprint.html`), built by `public/js/blueprint.js` from the real room models.

## The station
- **Arcadia Station**: four spinning rings (01–04) on a central spine, 717 km above Earth. Ring radius 224 m at 2 rpm gives 1 g at the rim.
- The rim is the floor; "up" points at the spine. Windows are in a ring's outer face and look at Earth.
- **Ark Aurora** (1,480 m) is berthed alongside on a docking arm, boarding.
- Every room on the site is on one patch of Ring 04, the **Commons deck**.

## Deck layout (draft 4)
The ring is a circular pressure tube (10.5 m radius, its axis 2.3 m above the deck) with the main deck as a chord. Compartments sit in a row along it, antispinward to spinward, each closed by pressure bulkheads:

1. Navigation (Experience)
2. Fabrication Bay 02 (Projects) — its big door is the cargo lift down to the Ring Line
3. Atrium (Home) — the Oculus and both doors are in its spinward bulkhead
4. Spoke core — lifts to the hub, stair to the Ring Line, and the foot of the periscope
5. Observation Lounge (About) — its window is the periscope's other eyepiece
6. Library (Writing, planned)
7. Comms (Contact, planned)

Below deck: the Ring Line (tram + walkway + freight track through every compartment) and water tanks (shielding, ballast).

### The view (draft 4 change)
Draft 3 put an "optics bay" between the Atrium and the Lounge and had each room's window face the other, which made no sense: there was nowhere for the light to come from. Now the spoke sits between them. A telescope on the non-rotating hub looks at Earth; its light comes down the hollow spoke through a derotator; at the foot two mirrors, back to back, turn it horizontally into the two rooms. Oculus and Lounge window are two eyepieces of one periscope.

Precedents: the Stanford torus (NASA SP-413, 1975) lights its rim with a non-rotating primary mirror and secondary mirrors at the hub rather than with rim windows; O'Neill cylinders use external mirrors and counter-rotating pairs; astronomical telescopes steady a rotating field with a derotator (Dove prism or K-mirror at half rate). Direct windows such as the ISS Cupola work because the ISS does not spin.

Honest limit: a mirror relay 200 m long with a 9 m opening only passes a narrow field of view. A panorama as wide as the one shown would need large relay optics along the spoke. A display wall fed by hub cameras would be the cheap real-world answer.

Not rebuilt yet: the Lounge still has a flat-walled room with a mullioned window; signs still number the Lounge as compartment 6.

## Atrium (as built)
- Cross-section: the hull itself. Ring frames (the ribs) are true circles about the tube axis at 4 m pitch; the lining above the balcony follows them. Below the balcony, flat service walls stand in front of the hull.
- No doors in the side walls: behind them is the hull. The only ways on are in the spinward bulkhead, either side of the stair: a door to the next compartment (Lounge) and a stair down to the Ring Line (every compartment).
- The big ring in that bulkhead is the Oculus, not a window: the wall faces the next compartment and the ring turns twice a minute. It shows the de-spun view relayed from the hub telescope, through a baffled barrel.
- Antispinward bulkhead (behind the visitor): the lift lobby from the spoke.
- Interactables: the hologram and the two doors. The Ring Line door offers a list of stops.
- Simplification: the deck is flat. Over the hall's 33 m a real ring deck would rise about 0.6 m at each end.
