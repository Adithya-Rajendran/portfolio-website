# Arcadia Station: scene asset catalogue

Start with the [as-built parts and motion inspector](../public/asset-catalogue/parts.html) (`/asset-catalogue/parts.html`). It accounts for **all 16,897 Blender scene objects** before baking: **16,851 meshes, 40 lights, five cameras and one empty**. Of the meshes, 15,473 are inside named builders; **1,378 are not**. Expand any assembly or inline room section to see its constituent mesh names and counts. Each room also has a downloadable exact object list, including FX placeholders and exterior geometry. See [room totals](scene-parts.tsv).

The [studio gallery](../public/asset-catalogue/index.html) and [builder matrix](asset-placements.tsv) answer a different question: which reusable builders exist and where are they used? Neither a named builder nor a mesh is necessarily a mechanism. Shader effects and three.js-only assemblies (e.g. the drone) have a separate [source-based motion inventory](room-motion.json).

| Scene / source | Architecture and fittings | Furniture, exhibits and hero assets | Live elements |
|---|---|---|---|
| Atrium · `build_scene.py` | Vault and ribs, mezzanines, steps, Oculus barrel and baffles, pressure doors | Dais, reception desk, hologram projector, chandelier rings, planters, alcove seating, concourse benches, pylons, luggage trolleys, barriers, deck hatches | Earth and mission holograms, screens, window sky, sun and reflections |
| Lounge · `room_about.py` | Panoramic window, bookcase wall, wainscot, pictures and picture lights, drapes, pressure door | Sofas and throws, wing chairs, coffee table, books, drinks tray, glasses and decanters, sideboard, shelving ladder, floor lamp, tripod telescope, planters and rug | Window sky and sun, ambient displays, book inspection |
| Fabrication · `room_projects.py` | Bay door, steel frames, gantry, hoist, service ducts, cabinets and grilles, pressure door | Satellite and solar arrays; rover, manipulator, engine stand and lattice on plinths; workbenches, tool chests, pegboard, pallet loads, drums, extinguishers, stepladder, barriers and deck hatches | Project placards, focus targets and floor reflection |
| Navigation · `room_experience.py` | Ribbed dome, star studs and oculus, wall bays, pressure door, radial floor inlays | Projection table and dial, operator consoles, task chairs, built-in seats, wayfinding pylons and vent grilles | Six station models and route, projection, labels and data sheets |
| Library · `room_writing.py` | Bow window, bookcase bays, gallery, balusters, ceiling coffers, framed panels, sconces, pressure door | Reading table, chairs, banker’s lamps, pendants, stacks, open books, blotters, rolling ladders, card catalogue, book cart, globe, wing chair, floor lamps, catalogue terminal and charging cradle | Retrieval drone, hinged book, printed index and window sky |

## Kit already shared in the built rooms

- **Pressure door:** `pressure_door()` in `build_scene.py`, used in all five rooms. Vary the surround and signs per room; retain door dimensions, gaskets, hardware and pick target.
- **Civil furnishings:** `assets_reading.py` supplies `a_bay`, `a_ladder`, `a_armchair`, `a_stack`, `a_openbook`, `a_closed_book`, `a_shelf_volume` and `a_bookend` to the Lounge and Library. Neither room reads snippets out of the other generator. About used to advertise 15 unplaced Library-only keys on its bench; it now registers its own furniture and the shared reading kit.
- **Station hardware:** `assets_tech.py` supplies pylons to Atrium and Navigation, barriers and hatches to Atrium and Fabrication, and grilles and extinguishers to Navigation and Fabrication. Navigation task chairs and Fabrication tool chests live in the kit but are not currently multi-room placements.
- **Shared but not counted as object families:** the Atrium, Lounge and Library reuse the exterior Earth scene and rolling-sky system. The five rooms use the wall-screen and floor-reflection systems. These are not additional pieces of furniture. The two ring-themed projectors share an optical vocabulary but are distinct physical bodies and distinct live effects.
- **Upholstery:** `boxed_cushion()` in the shared kit builds the wing-chair seat/back and the Lounge sofa seat pads. Dimensions, orientation and finish change at placement. Shared material recipes live in `surface_finishes.py`; they affect Blender bakes, not the moving three.js book or drone.

## How much overlap?

We traced `a_*` builder calls and `pressure_door` during five **normal Blender builds**, not during studio renders. A family is a distinct named builder; a pair overlaps only if both rooms actually call it. Nested uses are identified by parent in the TSV. Mesh primitives, upholstery construction helpers, shelf dressing without its own builder, room-specific inline objects, and runtime JS models are **outside this denominator**.

| Named families in common | Atrium | Lounge | Fabrication | Navigation | Library |
|---|---:|---:|---:|---:|---:|
| Atrium | **10** | 1 | 3 | 2 | 1 |
| Lounge | 1 | **18** | 1 | 1 | **9** |
| Fabrication | 3 | 1 | **21** | 3 | 1 |
| Navigation | 2 | 1 | 3 | **9** | 1 |
| Library | 1 | **9** | 1 | 1 | **24** |

**65 named families; 14 shared** (11 of 60 if considering direct room calls only). The previous reported 53 were studio families, not a count of everything modelled. The actual room builds now make 238 top-level and 4,800 nested builder calls. A `shelf_volume` call makes one upright book plus zero or two gilt bands; it does not make a new book design. A shell can be a single mesh; a single console can contain dozens. The parts inspector keeps the levels separate.

- Lounge / Library: eight reading-kit families plus the pressure door. The shelf bays contain **973 / 3,765 upright books** respectively; there are also flat books and bookends. The closer, case-bound table/cart book is called **9 / 19** times. The five live volume choices still use three.js and do not remove any mesh from the shelf.
- Atrium / Fabrication: door, deck hatch and stanchion. A stanchion call builds **a belt span with two posts**, not one post; `posts=` lists which of the two (0 at the start, the span length at the end) it builds, so two spans that meet share one post instead of two posts in the same place. Atrium / Navigation: door and kiosk. Fabrication / Navigation: door, grille and extinguisher. All other off-diagonal ones are the door alone; it has six total placements across five rooms.

## Objects promoted to studio assets

The census at `383154b` added **12 previously embedded families**: Fabrication gantry, satellite, solar wing and cargo bulkhead; Atrium orrery and gimbal ring; Navigation perimeter seat and dome rib; Lounge sideboard and sofa body; shared upright shelf volume and bookend. They are real calls in the rooms, not extra geometry or speculative scene dressing. After the realism pass the one static satellite contains **234 mesh objects**, 168 in its two wings. The chandelier contains 17 mesh objects; its three rings use two counter-rotating pivots in the browser. Labels in the parts inspector (e.g. `sat_cell#`) describe name patterns, **not more asset families**.

The preceding extraction (`dfb8e62`):

| Source | Newly independent | Deliberately kept out of the asset |
|---|---|---|
| `blender/assets_projection.py` | One reception desk arc (placed twice), static Atrium projector pedestal, Navigation map table with dial and clamps | Dais and floor inlay, hologram, chart animation, map lights and pick metadata |
| `blender/assets_lounge.py` | Coffee table including rails/legs, tripod telescope with a target in local coordinates | Tray and books on the table, book focus sphere, window sightline |
| `blender/assets_exhibits.py` | Display plinth (placed four times), engine display and wire lattice (with modifiers and its own point light) | Numbered placards, screen UVs, spotlights, room focus spheres |
| `blender/assets_reading.py` | Closed book with original simple and page-block variants | Bulk distant shelf fill and animated drone book. That extraction preserved the old shapes. The later realism pass replaced them with bindings, boards and paper edges. |

Each extracted builder takes a Blender placement matrix `M` first. The room supplies its existing `MAT`/`EM` palette before loading the module: e.g. the reading kit uses `BOOKS`, timber, paper and shelf-light keys; `map_table` needs Navigation's `EM_core`. Pass local dimensions/aim where they vary, and keep room anchors, wall-mounted labels and interaction metadata in the generator. The canonical studio is the supported material environment—not a claim that every builder can run in any unprepared room.

Nine newly independent objects/families. The already shared pressure door also has a studio adapter; it is **not** a tenth newly extracted model. The Atrium studio now runs before the room is constructed. Shared furniture is authored once in Python but baked per room into its original lightmap atlas; this isn't a new runtime instancing or download optimization.

## Remaining inline work and lookalikes

| Room | Candidates if another pass is wanted | Do not conflate |
|---|---|---|
| Atrium | Alcove sofa / side table, grove and screen planters, Oculus assembly | Garden seat ≠ concourse bench. Keep orrery groups A/B and phase-light contracts. `PEOPLE=False`: no figure placements. |
| Lounge | Arched reading lamp, potted plants on and beside furniture, window surround and ceiling slats | Different stand, shade, mounting and light power from Library lamps. Local `armchair()` is an unused legacy definition; only `a_armchair` is placed. |
| Fabrication | Slings from payload to hook, racks/workbenches and cargo stacks | Cargo door ≠ Midway pressure door. Satellite and manipulator are static exhibits, not runtime machines. |
| Navigation | Wall/screen bays, dome shell and oculus | Built-in bench ≠ task chair ≠ Atrium platform bench. The six projected stations live in `public/js/routemap.js`, not in the table mesh. |
| Library | Runner, ladder rail and ceiling beams; nearly all furniture already has builders | No placed bust or freestanding monitor lecterns. `FX_screen0`, terminal, drone dock, slot and delivery poses must stay aligned. |

## Actual motion: checked in the running preview

Source audit plus a [Chromium sample from the five relit, packed rooms](motion-sample.jsonl) (`tools/docker/motion-audit.mjs URL`, 960×540, tier 1, scale 0.7, hero shot, no reduced-motion preference). In one 30-frame idle sample, the number of scene nodes with a **changing local transform** was **14 / 1 / 0 / 14 / 2** in table order. During a Library request, from selection until the pages started bending, it was **13**, plus **two morphing pages**. Samples are observations, not a guaranteed number of animations. The probe watches nodes with visible-flag drawable descendants (including groups, not just meshes), not per-pixel visibility. It excludes the camera and does not count inherited transforms, moving vertices/particles without a node transform, shader-only motion, canvas redraws or post effects. For example the sky group rolls, and infinity is rendered from the active camera (including the mirror). That is not a moving piece of lounge furniture.

If what feels missing is **mechanical activity**, Fabrication is the clearest gap: the arm, gantry, suspended satellite and cargo doors are modelled in detail but static. To make a mechanism work, its moving members and lighting/reflection treatment would need to be separated from the room bake; splitting source builders alone doesn't animate anything.

## Audit plan and division of work

| Stage | Owner / thinking | Evidence required before moving on |
|---|---|---|
| Parallel read-only inventory | GPT-6.2 Sol, **high**, one worker for Atrium/Fabrication/Navigation and one for Lounge/Library | Actual placement loops and live JS call sites; separate missing, unused and similar objects |
| Extract from room scripts | GPT-6.2 Sol, **medium** for bounded Lounge and Fabrication edits; **high** for projection/bench isolation and the two-room reading kit | Isolated worktrees, one owner per file per stage; scene assembly must call the same builder as the studio |
| Integrate and count | Coordinator, actual Blender builds | Baseline and after traces; nested counts retained by parent. Registries aren't a substitute for calls |
| Independent review | GPT-6.2 Sol, **high**, read-only | Review the matrix, comparison logs and a studio contact sheet. Verify arithmetic against the traces rather than taking an agent estimate |

The expanded census used additional GPT-6.2 Sol workers at **high** for the machinery/architecture, furnishing subassemblies and runtime-motion source audit. The coordinator verified the counts against linked scene objects, and motion against a live browser probe. All substantive agent jobs used `openai/gpt-6.2-sol`; no Terra or Claude fallback was used. Next model-design work can use the extracted builders without rerunning the census by hand.

## Reproduce the evidence

1. In a scratch checkout (generators save local `.blend` files), create a trace directory. For each of `lobby about projects experience writing`, run `blender/run.sh -b --python-exit-code 2 -P blender/audit_assets.py -- ROOM /path/to/traces/ROOM.json` with `ASSET` unset. Then `python3 tools/asset-inventory.py /path/to/traces > docs/asset-placements.tsv` and `python3 tools/scene-parts.py /path/to/traces`. The latter includes objects emitted outside any traced builder. `#` name groups are display shorthand only; the gzipped TSVs preserve exact names and the observed builder instance paths.
2. `python3 tools/review-models.py --list` lists canonical studios. `python3 tools/review-models.py telescope closed_book` renders just those; omit names for all families. Two full views per asset go into `blender/out/model-review/`. `python3 tools/asset-catalogue.py` makes the web page and small WebP thumbnails from a representative angle and the measured placements.
3. To refresh the browser evidence, run `node motion-audit.mjs URL` alongside Playwright in the existing Docker QA environment. Save its six JSON lines to `docs/motion-sample.jsonl` on success, then regenerate the parts inspector. This samples the packed rooms currently served by `URL`, not studio models.
4. Regression: for the historical extraction compare `dfb8e62` and `383154b` (the subsequent realism pass intentionally changes geometry) on the same Blender version; run `blender/run.sh -b --python-exit-code 2 -P blender/compare_rooms.py -- /before/ROOM.blend /after/ROOM.blend`. All five matched: 927 / 2,775 / 1,772 / 930 / 10,105 named objects (table order). Max coordinate/matrix delta **0.000000954** in the Library, **0.000000477** in the Lounge, zero in the others. The comparison includes evaluated mesh positions, polygon connectivity/materials/smoothing, UVs, tags, lights and exported camera/interaction metadata. Exterior UV-spheres have nondeterministic face enumeration; their oriented faces are compared without requiring the same list order. This is not a pixel-equivalence claim or a comparison against the older live bakes.

## Visual review gate

Studio A/B: identical camera, exposure and samples. Inspect the highlight, silhouette and middle-distance variation, not just the number of nodes. Also compare the **packed** room at an actual inspect position: atlas resolution, mipmaps and indirect lighting can erase thread or pore detail. Keep the current published bakes until that test passes. Shared recipes add no browser texture requests by themselves; rebake time and compressed atlas size still need measurement.
