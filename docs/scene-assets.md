# Arcadia Station: scene asset catalogue

Inventory of **placed asset families**, not a list of mesh objects. A shelf bay is one family, not hundreds of separate books. Constructors registered for the studio bench but never placed are not evidence of reuse. The room generators remain authoritative for placement, variants and quantities.

| Scene / source | Architecture and fittings | Furniture, exhibits and hero assets | Live elements |
|---|---|---|---|
| Atrium · `build_scene.py` | Vault and ribs, mezzanines, steps, Oculus barrel and baffles, pressure doors | Dais, reception desk, hologram projector, chandelier rings, planters, alcove seating, concourse benches, pylons, luggage trolleys, barriers, deck hatches | Earth and mission holograms, screens, window sky, sun and reflections |
| Lounge · `room_about.py` | Panoramic window, bookcase wall, wainscot, pictures and picture lights, drapes, pressure door | Sofas and throws, wing chairs, coffee table, books, drinks tray, glasses and decanters, sideboard, shelving ladder, floor lamp, tripod telescope, planters and rug | Window sky and sun, ambient displays, book inspection |
| Fabrication · `room_projects.py` | Bay door, steel frames, gantry, hoist, service ducts, cabinets and grilles, pressure door | Satellite and solar arrays; rover, manipulator, engine stand and lattice on plinths; workbenches, tool chests, pegboard, pallet loads, drums, extinguishers, stepladder, barriers and deck hatches | Project placards, focus targets and floor reflection |
| Navigation · `room_experience.py` | Ribbed dome, star studs and oculus, wall bays, pressure door, radial floor inlays | Projection table and dial, operator consoles, task chairs, built-in seats, wayfinding pylons and vent grilles | Six station models and route, projection, labels and data sheets |
| Library · `room_writing.py` | Bow window, bookcase bays, gallery, balusters, ceiling coffers, framed panels, sconces, pressure door | Reading table, chairs, banker’s lamps, pendants, stacks, open books, blotters, rolling ladders, card catalogue, book cart, globe, wing chair, floor lamps, catalogue terminal and charging cradle | Retrieval drone, hinged book, printed index and window sky |

## Kit already shared in the built rooms

- **Pressure door:** `pressure_door()` in `build_scene.py`, used in all five rooms. Vary the surround and signs per room; retain door dimensions, gaskets, hardware and pick target.
- **Civil furnishings:** `a_bay`, `a_ladder`, `a_armchair`, `a_stack`, `a_openbook` from `room_writing.py` also furnish the Lounge. The Lounge uses the Library builders, not exported duplicates.
- **Station hardware:** `assets_tech.py` supplies pylons to Atrium and Navigation, barriers and hatches to Atrium and Fabrication, and grilles and extinguishers to Navigation and Fabrication. Navigation task chairs and Fabrication tool chests live in the kit but are not currently multi-room placements.
- **Upholstery prototype:** `boxed_cushion()` in the shared kit builds the wing-chair seat/back and the Lounge sofa seat pads. Dimensions, orientation and finish change at placement. Shared material recipes live in `surface_finishes.py`; they affect Blender bakes, not the moving three.js book or drone.

## What to share next, and what not to

1. **Book construction:** use a common board, page block and spine for the small side-table book and the stacks. Right now the chair's book is one red block. Keep the interactive volume separate: it needs hinged pages and readable print.
2. **Seat construction:** test the cushion and welt under Lounge lighting before adapting it to the Atrium alcoves. Do not give the Navigation task chairs the same silhouette as a reading chair.
3. **Instrument fittings:** reuse a lens cell and retaining ring between the telescope and optical projectors, with different diameter and finish. Preserve their distinct bodies.
4. **Library assets:** extract the furnishing builders to a dedicated file when touching them next. The current Lounge loader slices `room_writing.py` between comment markers; changes to that file can break reuse even if its own scene builds.

## Review gate

Studio A/B: identical camera, exposure and samples. Inspect the highlight, silhouette and middle-distance variation, not just the number of nodes. Next compare the **packed** room at an actual inspect position: atlas resolution, mipmaps and indirect lighting can erase thread or pore detail. Keep the current published bakes until that test passes. Shared recipes add no browser texture requests by themselves; rebake time and compressed atlas size still need measurement.
