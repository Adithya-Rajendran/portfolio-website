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
2. **The tube must be about 40 m across** to hold a 33 m hall (today 21 m). With a 20 m tube radius and the deck 6 m below the tube's axis, the deck is 38 m wide and the hull is vertical at Oculus height (5.65 m). That leaves room for a deck above and the Ring Line below. Still a third of SP-413's tube.
3. **The hull frames now run along the hall** instead of arching across it. In the hero view they become lines converging on the Oculus.
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
| 4 | Atrium turned 90°: hull at the Oculus end, bulkhead sides with doors, longitudinal frames, paned Oculus | Large | Third pass on this room; most props survive |
| 5 | Lounge to the same section | Medium | |
| 6 | Navigation, Fabrication: bulkhead doors, new signs | Medium | Needed under any option |
| 7 | Blueprint draft 5: R 894 m, 40 m tube, rooms across the tube, counter-rotating pairs, no telescope | Medium | |
| 8 | `prefers-reduced-motion` stops the roll; a pause control | Small | A large rotating field can make visitors queasy |

Known risks:
- **Sharp reflections of the window in glossy walls are baked.** Blending three angles will cross-fade them instead of turning them. The live floor mirror is unaffected. Fixes: more angles for those surfaces, or less gloss near the Oculus.
- Three more texture reads per pixel on the Atrium, which is already the slowest room (48 ms on the Intel test GPU). Earth-light maps can be low resolution.
- Three angles reproduce a half-lit disc only to its first harmonic. Probably invisible in diffuse light; to be checked against a fourth bake.
- The attitude and gravity-gradient figures are my own estimates, not from a source.

## 6. Decisions needed before building
1. Ring size: stay 224 m / 2 rpm (turn in 30 s) or go 894 m / 1 rpm (60 s)?
2. Attitude: horizon-locked with the sun on the axis, as proposed?
3. Paned Oculus instead of one sheet?
4. Run step 0 first and decide on the evidence?
