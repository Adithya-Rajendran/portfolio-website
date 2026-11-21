# Arcadia Station: scene asset catalogue

Use the [visual object catalogue](../public/asset-catalogue/index.html) (preview URL: `/asset-catalogue/`) or the [complete placement matrix with source symbols](asset-placements.tsv). The room generators are authoritative. The table below includes **inline and live assets as well**; those are not silently folded into the builder counts.

| Scene / source | Architecture and fittings | Furniture, exhibits and hero assets | Live elements |
|---|---|---|---|
| Atrium · `build_scene.py` | Vault and ribs, mezzanines, steps, Oculus barrel and baffles, pressure doors | Dais, reception desk, hologram projector, chandelier rings, planters, alcove seating, concourse benches, pylons, luggage trolleys, barriers, deck hatches | Earth and mission holograms, screens, window sky, sun and reflections |
| Lounge · `room_about.py` | Panoramic window, bookcase wall, wainscot, pictures and picture lights, drapes, pressure door | Sofas and throws, wing chairs, coffee table, books, drinks tray, glasses and decanters, sideboard, shelving ladder, floor lamp, tripod telescope, planters and rug | Window sky and sun, ambient displays, book inspection |
| Fabrication · `room_projects.py` | Bay door, steel frames, gantry, hoist, service ducts, cabinets and grilles, pressure door | Satellite and solar arrays; rover, manipulator, engine stand and lattice on plinths; workbenches, tool chests, pegboard, pallet loads, drums, extinguishers, stepladder, barriers and deck hatches | Project placards, focus targets and floor reflection |
| Navigation · `room_experience.py` | Ribbed dome, star studs and oculus, wall bays, pressure door, radial floor inlays | Projection table and dial, operator consoles, task chairs, built-in seats, wayfinding pylons and vent grilles | Six station models and route, projection, labels and data sheets |
| Library · `room_writing.py` | Bow window, bookcase bays, gallery, balusters, ceiling coffers, framed panels, sconces, pressure door | Reading table, chairs, banker’s lamps, pendants, stacks, open books, blotters, rolling ladders, card catalogue, book cart, globe, wing chair, floor lamps, catalogue terminal and charging cradle | Retrieval drone, hinged book, printed index and window sky |

## Kit already shared in the built rooms

- **Pressure door:** `pressure_door()` in `build_scene.py`, used in all five rooms. Vary the surround and signs per room; retain door dimensions, gaskets, hardware and pick target.
- **Civil furnishings:** `assets_reading.py` supplies `a_bay`, `a_ladder`, `a_armchair`, `a_stack`, `a_openbook` and `a_closed_book` to the Lounge and Library. Neither room reads snippets out of the other generator. About used to advertise 15 unplaced Library-only keys on its bench; it now registers its own furniture and the shared reading kit.
- **Station hardware:** `assets_tech.py` supplies pylons to Atrium and Navigation, barriers and hatches to Atrium and Fabrication, and grilles and extinguishers to Navigation and Fabrication. Navigation task chairs and Fabrication tool chests live in the kit but are not currently multi-room placements.
- **Shared but not counted as object families:** the Atrium, Lounge and Library reuse the exterior Earth scene and rolling-sky system. The five rooms use the wall-screen and floor-reflection systems. These are not additional pieces of furniture. The two ring-themed projectors share an optical vocabulary but are distinct physical bodies and distinct live effects.
- **Upholstery prototype:** `boxed_cushion()` in the shared kit builds the wing-chair seat/back and the Lounge sofa seat pads. Dimensions, orientation and finish change at placement. Shared material recipes live in `surface_finishes.py`; they affect Blender bakes, not the moving three.js book or drone.

## How much overlap?

We traced `a_*` builder calls and `pressure_door` during five **normal Blender builds**, not during studio renders. A family is a distinct named builder; a pair overlaps only if both rooms actually call it. Nested uses are identified by parent in the TSV. Mesh primitives, upholstery construction helpers, bulk shelf filler, room-specific inline objects, and runtime JS models are **outside this denominator**.

| Named families in common | Atrium | Lounge | Fabrication | Navigation | Library |
|---|---:|---:|---:|---:|---:|
| Atrium | **8** | 1 | 3 | 2 | 1 |
| Lounge | 1 | **14** | 1 | 1 | **7** |
| Fabrication | 3 | 1 | **17** | 3 | 1 |
| Navigation | 2 | 1 | 3 | **7** | 1 |
| Library | 1 | **7** | 1 | 1 | **22** |

**53 families; 12 used in two or more rooms (23%).** The previous generators yielded 44 families, 11 shared, by the same convention. The gain is objects being exposed as assets, not more objects in the rooms. Excluding nested-only families gives 11 shared out of 52. The traces give 15 / 26 / 62 / 20 / 87 room-level calls (210 total) plus 30 nested calls: two drums inside pallets and 28 closed books inside stacks, wing-chair/table assemblies or the cart. A Library shelf bay with `shelves=False` is still a bay (trim and uprights); an unplaced bench key is not a bay. Slot assignments for the drone do not represent five additional physical shelf books.

- Lounge / Library: six reading-kit families plus the pressure door. The four Lounge bookcases are deeper in shelf count (eight rows versus six), not a second asset type. The static closed book is now called **9 / 19** times respectively; the five live volume choices still use three.js.
- Atrium / Fabrication: door, deck hatch and stanchion. A stanchion call builds **a belt span with two posts**, not one post. Atrium / Navigation: door and kiosk. Fabrication / Navigation: door, grille and extinguisher. All other off-diagonal ones are the door alone; it has six total placements across five rooms.

## Objects promoted to bench assets in this pass

| Source | Newly independent | Deliberately kept out of the asset |
|---|---|---|
| `blender/assets_projection.py` | One reception desk arc (placed twice), static Atrium projector pedestal, Navigation map table with dial and clamps | Dais and floor inlay, hologram, chart animation, map lights and pick metadata |
| `blender/assets_lounge.py` | Coffee table including rails/legs, tripod telescope with a target in local coordinates | Tray and books on the table, book focus sphere, window sightline |
| `blender/assets_exhibits.py` | Display plinth (placed four times), engine display and wire lattice (with modifiers and its own point light) | Numbered placards, screen UVs, spotlights, room focus spheres |
| `blender/assets_reading.py` | Closed book with original simple and page-block variants | Bulk distant shelf fill and animated drone book. The former single-box dressing stays a single box in the migrated instances; this isn't a visual redesign. |

Each extracted builder takes a Blender placement matrix `M` first. The room supplies its existing `MAT`/`EM` palette before loading the module: e.g. the reading kit uses `BOOKS`, timber, paper and shelf-light keys; `map_table` needs Navigation's `EM_core`. Pass local dimensions/aim where they vary, and keep room anchors, wall-mounted labels and interaction metadata in the generator. The canonical studio is the supported material environment—not a claim that every builder can run in any unprepared room.

Nine newly independent objects/families. The already shared pressure door also has a studio adapter; it is **not** a tenth newly extracted model. The Atrium studio now runs before the room is constructed. Shared furniture is authored once in Python but baked per room into its original lightmap atlas; this isn't a new runtime instancing or download optimization.

## Remaining inline work and lookalikes

| Room | Candidates if another pass is wanted | Do not conflate |
|---|---|---|
| Atrium | Alcove sofa / side table, grove and screen planters, orrery, Oculus assembly | Garden seat ≠ concourse bench. Keep orrery groups A/B and phase-light contracts. `PEOPLE=False`: no figure placements. |
| Lounge | Sofa body (trim already an asset), sideboard and reading lamp, window planters | Different stand, shade, mounting and light power from Library lamps. Local `armchair()` is an unused legacy definition; only `a_armchair` is placed. |
| Fabrication | Satellite bus/wings, gantry and slings, racks/workbenches and cargo stacks | Cargo door ≠ Midway pressure door. Satellite and manipulator are static exhibits, not runtime machines. |
| Navigation | Repeated perimeter seat/wall bays, dome assembly | Built-in bench ≠ task chair ≠ Atrium platform bench. The six projected stations live in `public/js/routemap.js`, not in the table mesh. |
| Library | Runner, ladder rail and ceiling beams; nearly all furniture already has builders | No placed bust or freestanding monitor lecterns. `FX_screen0`, terminal, drone dock, slot and delivery poses must stay aligned. |

A sensible next reuse target is the **sofa body**: start with distinct Lounge and Atrium silhouettes, and share cushion/foot construction where appropriate. Lens cells are another possible component, not a reason to turn a telescope and a projector into the same object.

## Audit plan and division of work

| Stage | Owner / thinking | Evidence required before moving on |
|---|---|---|
| Parallel read-only inventory | GPT-6.2 Sol, **high**, one worker for Atrium/Fabrication/Navigation and one for Lounge/Library | Actual placement loops and live JS call sites; separate missing, unused and similar objects |
| Extract from room scripts | GPT-6.2 Sol, **medium** for bounded Lounge and Fabrication edits; **high** for projection/bench isolation and the two-room reading kit | Isolated worktrees, one owner per file per stage; scene assembly must call the same builder as the studio |
| Integrate and count | Coordinator, actual Blender builds | Baseline and after traces; nested counts retained by parent. Registries aren't a substitute for calls |
| Independent review | GPT-6.2 Sol, **high**, read-only | Review the matrix, comparison logs and a studio contact sheet. Verify arithmetic against the traces rather than taking an agent estimate |

All substantive agent jobs used `openai/gpt-6.2-sol`; no Terra or Claude fallback was used. Next model-design work can use the extracted builders without rerunning the census by hand.

## Reproduce the evidence

1. In a scratch checkout (generators save local `.blend` files), create a trace directory. For each of `lobby about projects experience writing`, run `blender/run.sh -b --python-exit-code 2 -P blender/audit_assets.py -- ROOM /path/to/traces/ROOM.json` with `ASSET` unset. Then `python3 tools/asset-inventory.py /path/to/traces > docs/asset-placements.tsv`.
2. `python3 tools/review-models.py --list` lists canonical studios. `python3 tools/review-models.py telescope closed_book` renders just those; omit names for all families. Two full views per asset go into `blender/out/model-review/`. `python3 tools/asset-catalogue.py` makes the web page and small WebP thumbnails from a representative angle and the measured placements.
3. Regression: build the pre-extraction source at `231b6a0` and the current source on the same Blender version; run `blender/run.sh -b --python-exit-code 2 -P blender/compare_rooms.py -- /before/ROOM.blend /after/ROOM.blend`. All five matched: 927 / 2,775 / 1,772 / 930 / 10,105 named objects (table order). Max coordinate/matrix delta **0.000000477** in the Lounge, zero in the others. The comparison includes evaluated mesh positions, polygon connectivity/materials/smoothing, UVs, tags, lights and exported camera/interaction metadata. Exterior UV-spheres have nondeterministic face enumeration; their oriented faces are compared without requiring the same list order. This is not a pixel-equivalence claim or a comparison against the older live bakes.

## Visual review gate

Studio A/B: identical camera, exposure and samples. Inspect the highlight, silhouette and middle-distance variation, not just the number of nodes. Next compare the **packed** room at an actual inspect position: atlas resolution, mipmaps and indirect lighting can erase thread or pore detail. Keep the current published bakes until that test passes. Shared recipes add no browser texture requests by themselves; rebake time and compressed atlas size still need measurement.
