# Rolling Earth: plan (nothing built yet)

Branch `explore/rolling-earth`, cut from `2fc87d9` (blueprint draft 4, the periscope). This is option 3: real windows in a spinning hull, with Earth turning in them.

## 1. Sources read
- **NASA SP-413, Space Settlements: A Design Study (1975)**, chapters 3–5 (nss.org copy). The Stanford torus.
- **Theodore W. Hall, "Inhabiting Artificial Gravity" (AIAA 99-4524)** and **"Gravity as an Architectural Element / space architecture" (2001 prepublication)**. Hall is an architect; these are the closest thing to an architecture guide for spinning habitats.
- Wikipedia: Stanford torus, O'Neill cylinder, Bernal sphere, rotating wheel space station, Cupola, artificial gravity, Kalpana One.
- Not read (worth getting if we go deeper): Häuplik-Meusburger, *Architecture for Astronauts*; NASA-STD-3001 / the Man-Systems Integration Standards (window sizes, sight lines); Hall's 2006 visualization paper (downloaded, text extraction found nothing useful on windows).

What they say that matters here:
- SP-413 sets **1 rpm** as its design limit and derives the 895 m radius from it ("only systems with radii of rotation greater than 895 m can lie on the line g = 1 below 1 rpm"). It notes people "can eventually adapt to rates below 3 rpm".
- SP-413's tube is **130 m across**, bent into a 1.8 km wheel, six spokes of 15 m. Glass covers a third of the tube, on the side facing the hub, with mirrored chevron shields over it against cosmic rays.
- Hall: a spinning habitat has **five principal directions**, not three: up, down, east (prograde), west (retrograde) and axial. Architecture cannot hide the difference, so it should signal it with consistent visual cues and "arrange activities to minimize off-axis motion".
- Hall on *2001*: Discovery's ladder is in the plane of rotation, so Coriolis pulls climbers sideways; it should be turned 90°.
- Hall on Skylab: crews took their "down" from the window view of Earth when it disagreed with the furniture. A window is an orientation device, not decoration.

## 2. The numbers (computed, `g = ω²R`)
| Spin | Gravity | Radius | View turns | Coriolis when walking 1.4 m/s | Deck sag over the 33 m hall |
|---|---|---|---|---|---|
| 2 rpm (today) | 1 g | 224 m | 12°/s, once in 30 s | 6 % of weight | 0.61 m |
| **1 rpm** | **1 g** | **894 m** | **6°/s, once in 60 s** | 3 % | 0.15 m |
| 1 rpm | 0.38 g (Mars) | 340 m | 6°/s | 8 % | 0.40 m |
| 0.5 rpm | 1 g | 3.6 km | 3°/s, once in 2 min | 1.5 % | 0.04 m |

- The view turns at exactly the spin rate. "Slowly" therefore means a bigger wheel; there is no other knob. 6°/s is the speed of a clock's second hand.
- Orbit at 717 km: period 99 min. Earth's disc is 64° in radius, so it covers 128° of sky; the horizon sits 26° below local horizontal.
- Check against the source: SP-413 gives 5.3 cm sideways drift for a 0.55 m jump at 1 rpm; my formula gives 5.1 cm.

**Proposal: grow the ring to the Stanford radius, 894 m at 1 rpm.** It halves the roll rate, and it makes our flat floor more honest (15 cm of sag we ignore instead of 61 cm).

## 3. Where a window can be, and what it shows
A torus tube has four kinds of wall. Only one gives a usable picture.

| Wall | Faces | What you would see |
|---|---|---|
| Floor | outward | Earth sweeps through and is gone; 21 s in every 60. Looking down through a floor. |
| Ceiling | the hub | Spokes and hub, fixed; stars wheeling behind. No Earth. |
| End bulkheads (spinward / antispinward) | the next compartment | Nothing. **This is where the Oculus is today.** |
| **Side walls** | **along the spin axis** | **A steady direction. The scene turns about the centre of the window like a clock face.** |

So the rule is:

> **A room with a view must have its long axis parallel to the spin axis, with the window in the axial hull wall.**

Consequences:
1. **The Atrium turns 90°.** The hall runs across the tube, from the star-side hull to the Earth-side hull. The Oculus wall becomes real hull. The side walls become bulkheads, so **side doors are correct again** and the two doors beside the Oculus must go (they would open onto vacuum). This is largely the layout from before the tube rebuild; the mistake then was the hull, not the doors.
2. **The tube must be about 44 m across** to hold a 33 m hall (today 21 m). With a 22 m tube radius and the deck 6 m below the tube's axis, the deck is 42 m wide and the hull is vertical at Oculus height (5.65 m). That leaves room for decks above and the Ring Line below. Still a third of SP-413's tube. Rooms share this tube; see section 7.
3. **The Atrium's ceiling is no longer hull.** The tube's crown is 28 m above the deck, so there are decks over the hall. The existing ribbed vault can stay as what it would be in a building: the arch that carries the deck above across a 20 m span. Only the Oculus wall is hull.
4. **Walking toward the Oculus is the one direction with no Coriolis force** (motion parallel to the axis). Hall's "minimize off-axis motion" for free: the main promenade is axial.
5. **The Lounge works unchanged in principle**: its far-wall window is an axial hull window showing the same Earth at the same roll angle.
6. Navigation and Fabrication have no windows and can sit anywhere in the row.
7. Hall's cues: mark east and west consistently. We already have two accent colours; amber = spinward, cyan = antispinward on door frames and floor strips.
8. Stairs: ours climb toward the Oculus, so Coriolis is sideways on them (Hall's ladder complaint). At 1 rpm it is about 1 % of weight; I would leave them.

## 4. Where the axis points
The Oculus only sees ±9° from the hero camera (±14° from the dais, ±43° at the foot of the stairs). So what is on the axis decides the picture.

| Attitude | Picture | Cost |
|---|---|---|
| Axis at Earth's centre | Ground filling the Oculus, turning. No horizon, no sunrise. | Axis must turn once per orbit |
| Axis square to the orbit (a wheel rolling along) | Stars only; the horizon is 26° off-centre, outside the frame | Free, and the classic stable attitude |
| Axis fixed among the stars, lying in the orbit plane | Changes over 99 min: Earth, horizon, stars, horizon | Free; gravity-gradient torque averages out, about 0.2° of wobble by my estimate |
| **Axis held on the horizon ahead (26° below horizontal)** | **Half Earth, half sky, the horizon line turning through the centre once a minute** | Axis must turn once per orbit |

**Proposal: horizon-locked.** A gyroscope resists being turned, so this needs the rings in counter-rotating pairs with no net spin (O'Neill's solution for the same problem). The blueprint already has four rings: two each way.

Further consequences:
- **Rings side by side block each other's axial view.** Only the end ring of the stack sees forward. Ring 04 becomes the bow ring; its Earth-side wall is the one with windows, its other side faces ring 03.
- The telescope, derotator and periscope of draft 4 are deleted. The Ark docks at the stern end of the hub.
- **If the sun sits on the axis, its beam does not move.** At orbital sunrise the sun is on the horizon; if that point of the horizon is where the axis aims, the sunbeam lies still down the hall and Earth turns around it. Today the sun is 12.5° off the hall axis, so it would circle. Licence taken: sunrise really lasts seconds; we freeze the orbit and let only the spin run.
- **A 9.2 m pane is not credible.** Cabin pressure on it is about 6.7 MN (680 tonnes). The Cupola's largest pane is 0.8 m. The Oculus should get a frame of panes; a fixed frame also makes the turning Earth easier to read.

## 5. Rework and effort
The engine already has what this needs: the orrery's light is baked at three angles and blended with `(1 + 2cos(φ − p))/3`. Earth-light is the same problem.

| # | Work | Size | Notes |
|---|---|---|---|
| 0 | **Prototype: spin the existing backdrop in today's Atrium** behind a `?roll=<seconds>` switch | Small, no bake | Answers "is it beautiful or nauseating" and 30 s vs 60 s vs 120 s before anything else is spent |
| 1 | Backdrop re-rendered centred on the axis, square, horizon through the middle; shader rotation; stars, Moon, storms, city lights turn with it | Small | Storm points are already projected per frame |
| 2 | Lighting: split the bake into static + direct sun + Earth-light at 3 angles | Medium | Roughly doubles bake time (est. 50 min per windowed room on the 4070). Small extra maps like the `_c0..2` set (tens of kB each) |
| 3 | Sun: on-axis so it is static; or a live floor pool if we keep it off-axis | Small / medium | |
| 4 | Atrium: Oculus wall becomes hull (two doors and the barrel removed, paned Oculus), one side door each way at mid-hall, signs | Medium | The vault, dais, stairs and props stay |
| 5 | Lounge to the same section | Medium | |
| 6 | Navigation, Fabrication: bulkhead doors, new signs | Medium | Needed under any option |
| 7 | Blueprint draft 5: R 894 m, 40 m tube, rooms across the tube, counter-rotating pairs, no telescope | Medium | |
| 8 | `prefers-reduced-motion` stops the roll; a pause control | Small | A large rotating field can make visitors queasy |

Known risks:
- **Sharp reflections of the window in glossy walls are baked.** Blending three angles will cross-fade them instead of turning them. The live floor mirror is unaffected. Fixes: more angles for those surfaces, or less gloss near the Oculus.
- Three more texture reads per pixel on the Atrium, which is already the slowest room (48 ms on the Intel test GPU). Earth-light maps can be low resolution.
- Three angles reproduce a half-lit disc only to its first harmonic. Probably invisible in diffuse light; to be checked against a fourth bake.
- The attitude and gravity-gradient figures are my own estimates, not from a source.

## 6. Assumed until told otherwise
1. Ring 894 m, 1 rpm (view turns once a minute). The prototype in phase 0 can still overrule this.
2. Horizon-locked attitude, sunrise on the axis, rings in counter-rotating pairs.
3. Paned Oculus.
4. Prototype before any rebuild.

## 7. Deck plan (draft 5 proposal): rooms share the tube
Rooms no longer take a whole slice of the tube each. The deck is 42 m wide; a corridor along the ring, the **Midway**, splits it into a bow half (hull with windows, facing Earth's horizon) and a stern half (faces ring 03, no windows). Only the Atrium spans both.

```
                    BOW · hull · windows · toward Earth's horizon
 ┌─────────────┬────────────────────┬─────────────┬────────────────┐
 │  LIBRARY    │   ( Oculus )       │  LOUNGE     │  COMMS         │  19 m
 │  window     │                    │  window     │  window        │
 ├── MIDWAY ───┤      ATRIUM        ├── MIDWAY ───┴────────────────┤   4 m
 │ NAVIGATION  │      · dais ·      │  FABRICATION BAY 02          │  19 m
 │  (round)    │    lift lobby      │  cargo lift                  │
 └─────────────┴──────[SPOKE]───────┴──────────────────────────────┘
                    STERN · faces ring 03 · no windows
  ← antispinward (cyan)                          spinward (amber) →
      18 m             20 m               14 m          18 m
```

| Room | Half | Footprint as built | Fits? | Why here |
|---|---|---|---|---|
| Atrium | both | 20 × 33 m | yes, plus a 9 m lift lobby | The spoke lands at its stern end. You step out of the lift and the whole hall points at the Oculus. Restores the original arrival |
| Lounge | bow | 14 × 15 m, window in far wall | yes | Its window is real hull. Same Earth, same roll angle as the Oculus |
| Fabrication | stern | 16 × 32 m | yes, long side along the ring | No window needed. Next to the spoke, so the cargo lift is the spoke's |
| Navigation | stern | 18 m round | yes (19 m available) | No window. Its dome stays a lining |
| Library (planned) | bow | about 18 × 19 m | | A reading room earns a window |
| Comms (planned) | bow | about 18 × 19 m | | Line of sight toward Earth |

Circulation:
- **Atrium:** two doors only, facing each other across the hall at mid-length, where the Midway crosses. Amber frame spinward (LOUNGE · FABRICATION · COMMS), cyan antispinward (NAVIGATION · LIBRARY). The existing multi-stop door UI handles this.
- **Every other room:** one door onto the Midway, with the Atrium and its neighbours as stops.
- **Ring Line:** stays under the deck for the rest of the ring. Reached from the lift lobby, so it no longer needs a door in the hall.
- The compartment bulkheads now fall at the Atrium's two side walls, with the Midway doors as the pressure doors.

Open point: the Midway itself is never seen. Travel between rooms stays a cut, as today.

## 8. Project plan
Each phase ends with something to look at and a decision. Nothing later starts before the gate before it passes.

| Phase | Work | Output | Gate |
|---|---|---|---|
| 0. Prototype | `?roll=<seconds>` spins the current backdrop in the current Atrium. No Blender, no bake | Three links: 30, 60, 120 s | Go or no-go on rolling at all; pick the period |
| 1. Blueprint draft 5 | Ring 894 m, 44 m tube, the deck plan above, counter-rotating pairs, bow ring, no telescope | `blueprint.html` | Layout agreed in 3D before any room is touched |
| 2. Atrium | Hull wall with paned Oculus, side doors, signs. Backdrop centred on the axis. Bake split into static, sun, Earth-light × 3 angles. Shader blend + rotation | Rebaked Atrium, before/after shots, frame times | Lighting reads as turning; no ghosting on glossy walls; no slower than today |
| 3. Lounge | Same window treatment and bake split; door onto the Midway | Rebaked Lounge | Earth matches the Atrium's angle when travelling between them |
| 4. Fabrication, Navigation | Doors and signs to the new plan; Fabrication's cargo lift named for the spoke | Rebakes | Door travel works both ways from every room |
| 5. Finish | Reduced-motion and pause, captions (`RING 04 · BOW ·…`), `content.json`, `docs/blueprint.md`, perf pass, real Safari check | Commit, merge decision | You choose: merge into the feature branch, or drop the branch and keep the periscope |
| Later | Library, Comms | | |

Machine time on the 4070: about 50 min for each windowed room, 25 min for the others; roughly 2.5 h of baking in total, plus re-bakes.

Fallback at any gate: `feat/arcadia-station-rooms` still holds the periscope version untouched.

## 9. Status
- **Phase 0 done.** Chosen period: **120 s** (0.5 rpm; a 3.6 km ring at 1 g).
- **Atrium lighting done ahead of the geometry** (asked for at the phase 0 review). The room's spin axis is the hall's long axis (`spin` in `scene.json`):
  - `base`: inside lights only.
  - `<group>_s0..5`: light from outside at six angles, 512 px. Earth, Moon, stars direct and bounced; sun bounced only. The two nearest are cross-faded.
  - Direct sun is live: `<group>_a` (diffuse colour) x irradiance x cosine, shadowed by a 2048 px depth map rendered from the sun through the Oculus each frame. The beam in the haze and the dust follow it.
  - Bake: about 50 min on the 4070. Cost on the Intel test GPU: a few ms per frame.
- Found while building it: the axis is level with the deck, but the hero camera looks up at the Oculus, so the sky turns about a point near the bottom of the window, not its centre. With the sun 12.5° off the axis the sunbeam mostly lands on the floor by the camera and the wall behind it; what is seen moving from the entrance is the Earth, the sun's glare and the pool on the platform under the Oculus. A sun further off-axis would put the pool mid-hall but take the sun and the horizon out of the Oculus. Left as is.
- Not done: glossy highlights of the sun (diffuse only); Lounge still uses the phase 0 prototype (sky turns, light does not); phases 1 and 2 geometry (blueprint, hull wall, side doors).
- **Pipeline:** bake -> `assets-src/<room>/` (WebP masters, in git) -> `tools/pack.py` -> `public/assets/<room>/` (KTX2 + meshopt, generated). After a bake on the bake machine, copy `assets-src/<room>` into `assets-src/` (preserving the Atrium's tracked hologram PNGs) then `python3 tools/pack.py <room>`. Deploy: `python3 tools/pack.py && python3 tools/site.py && npx wrangler deploy`.
- **Comms built** (`blender/room_comms.py`, `public/js/comms.js`, content.json `comms`): the bow signal room, 16 × 18 m, vaulted on the 4 m hull frames, with an arched window on the same Earth as the Lounge and Library. Its terminal is a Culture-style field over a plinth, drawn live: the visitor writes on it, socials are glyphs, SEND folds the message into a mote that leaves through the window, and a drone's aura shows its mood. Messages go to `comms.endpoint` if one is set, otherwise into the visitor's mail program (`comms.address`). The Ring Line stop and the Comms door are open. Not done: the blueprint page still shows Library and Comms as planned.
