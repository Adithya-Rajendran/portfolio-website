# Original lunar and Mars settlements and the orbital dry dock

`moon-outpost-v3.glb`, `mars-outpost-v3.glb`, `orbital-workshop-v1.glb` and their `-lite` builds are original scene models made for this portfolio with the repository owner's procedural Python modelling toolkit. They are not adapted from any third-party or vendor mesh or texture, and the toolkit and its sources are not part of this repository; the GLB files are the deliverable. They are imagined future hardware, not official NASA/SpaceX designs or engineering plans. All are Draco-compressed.

| File                           | Used for                         | Triangles | Draw calls | Size in bytes |
| ------------------------------ | -------------------------------- | --------- | ---------- | ------------- |
| `moon-outpost-v3.glb`          | Moon settlement, Experience page | 584,062   | 40         | 2,924,620     |
| `moon-outpost-lite-v3.glb`     | the same, lighter                | 162,730   | 39         | 943,572       |
| `mars-outpost-v3.glb`          | Mars settlement, Experience page | 595,522   | 35         | 2,816,936     |
| `mars-outpost-lite-v3.glb`     | the same, lighter                | 165,028   | 31         | 948,592       |
| `orbital-workshop-v1.glb`      | orbital dry dock, Projects page  | 310,256   | 27         | 1,293,640     |
| `orbital-workshop-lite-v1.glb` | the same, lighter                | 118,356   | 27         | 562,000       |

Metres, +Y up, one unit to a metre. The Moon settlement is 191.1 m in radius and 43.3 m high; Mars is 186.7 m in radius and 56.7 m high. The dry dock's keel truss is 94 m long, and its wings reach 33.95 m either side.

Each is exported with named materials and a `COLOR_0` vertex channel: red is ambient occlusion, green is grime (soot and heat on the dock), blue is edge wear. The site gives every material its own finish at load time, chosen by material name (`src/scripts/settlement-finishes.ts`), and uses the channels to place dust and wear. A new material name needs a finish before it will look right.

Fixed hardware is merged into one mesh per material under a `static` node, named `static/static_<material>`. Anything that moves is its own node, named by what it does: `ride_*` (transit pod and its stops), `fly_*` (landers and their engines), `launch_*` (the lunar mass-driver's anchors, sled and payload) and `spin_*` (rotating parts). The dry dock's moving parts are `array_port` and `array_stbd` (the solar arrays, turning about local X), `dish_az` (about Y) and its child `dish_el` (about X). The browser drives them by name.

The `-lite` builds carry the same hardware with fewer small parts, and are loaded in place of the full ones on the Experience page for a narrow screen, a small texture limit, data saver, 4 GB of device memory or less, or a renderer that draws on the processor, and on the Projects page for screens up to 800 px wide.

Each settlement's ground is separate: see `public/terrain/<world>-site-v1/` and the settlement site pipeline in `docs/hero-artwork.md`.

Architectural references:

- NASA, [Mars Surface Habitat Concept Design (2023)](https://ntrs.nasa.gov/citations/20230014593).
- SpaceX, [Mission: Mars](https://www.spacex.com/mars).
- [Gerard O'Neill / SSI mass-driver research](https://nss.org/l5-news-mass-driver-update/).
- SpaceX, [lunar manufacturing and electromagnetic launch concept](https://www.spacex.com/updates).

The lunar rail exports `launch_start` and `launch_exit` anchors for the browser's repeating satellite departure. The deployable satellite and its fading trajectory are original Three.js geometry in `src/scripts/lunar-launch.ts`; the sled and the cargo canister are the model's own (`launch_sled`, `launch_payload`). The browser conforms the models to the Moon/Mars sphere and keeps them attached during the orbital descent. Scale and architecture are illustrative.

The ground under each settlement is drawn in the browser from maps made by `scripts/artwork/make-settlement-ground.mjs`. Its regolith is a tinted adaptation of Poly Haven, [Rocks Ground 06](https://polyhaven.com/a/rocks_ground_06), CC0; originals are in `assets/scenes/textures/`.

The scene geometry follows the repository's MIT license. The bundled Draco decoder is Apache-2.0; see `/draco/LICENSE`.

## Homepage rover

`home-rover-v1.glb` is an adapted, posed and compressed NASA/JPL-Caltech Mars 2020 Perseverance model. It is an illustrative depiction, with no implied affiliation or endorsement. See `assets/scenes/models/README.md` for the source and acknowledgment. The source Blender scene and export script are retained in the repository; the surrounding homepage landscape is original Three.js geometry.

## Homepage built hardware

`home-outpost-v1.glb`, `home-ship-v1.glb`, `home-drone-v1.glb` and `home-yard-v1.glb` are original models made for this portfolio with the repository owner's procedural Python modelling toolkit, not adapted from any third-party or vendor asset. They are illustrative flight-hardware studies, not NASA/SpaceX designs or engineering plans. The outpost is the pressure modules, tunnels and dish; the ship is the launch vehicle; the drone is the survey aircraft; the yard holds two greenhouses with an airlock, a solar field and two guyed masts.

Each is exported as GLB with named materials and a `COLOR_0` vertex channel carrying baked shading (red ambient occlusion, green grime, blue edge wear), then Draco-compressed. The site replaces each named material with its own finish in `src/scripts/home-frontier.ts` and uses the channel to place dust and wear. The browser drives some nodes by name: `dish_az` on the outpost, and `rotor_*`, `gimbal` and `drone_beacon` on the drone.

`home-outpost-lite-v1.glb` (226,718 triangles, against 518,610) and `home-yard-lite-v1.glb` (68,644, against 150,546) are lighter builds of the same hardware, loaded instead of the full ones on coarse-pointer (touch) devices. The toolkit and its sources are not part of this repository; the GLB files are the deliverable.

These models follow the repository's MIT license; the Draco decoder remains Apache-2.0.
