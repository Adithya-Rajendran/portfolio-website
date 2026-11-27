---
type: concept
title: The reader
depends: [docs/ref_scene-json.md, docs/ref_test-hooks.md]
---
# The reader

The reader shows the article of a page on a reader panel in the room.
A pick that gives a text to read has the function `source()`, and `src/engine/reader.js` gives all its fields.

## The fields that the tests use

| Field | Meaning |
|---|---|
| `url` | The page of the article: `/blog/<slug>/`, `/portfolio/<slug>/` or `/experience/#<id>`. |
| `how` | The way that the thing opens: `'scan'` (the default), `'unfold'` or `'receive'`. |
| `bodies` | For `'scan'`: the things that the scan goes across in place of a flat sheet. Each body is `{ position, quaternion, size: [w, h, d], reads }`, a box in the room. `reads` marks the box where the light of the reader panel starts. |
| `station` | For `'unfold'`: the sheet and the model of the route stop, `{ page, holder }`. `page` is the sheet, a sprite with `userData.pane`. `holder` is the model. |

## The states

For each way, the reader goes through the states `closed`, `scanning` and `open`, in this sequence.
The reader gives READ under a thing that requests it: `picks.find(p => p.reads).live()` is true, and the page shows `ReadGlyph`.

## The ways that a thing opens

| Way | Things | What the page shows |
|---|---|---|
| Scan of a flat thing | A volume in the Library, an exhibit in Fabrication | After READ, the state is `scanning`, with `ScanSheet` and one `ScanFan`. The glyph shows `SCANNING`. |
| Scan of things with a shape | The books of the Lounge, from `focus[].boxes` in `scene.json` | One `ScanBody` for each box, and a `ScanFan` to each box. There is no `ScanSheet`. The glyph closes when the scan starts, and it does not show `SCANNING`. |
| Receive | A thing that has no model in the room: the button `ALL n PROJECTS` in Fabrication, or an address of a thing that is not in the room | The reader does not give READ. There is no `ScanFan`, `ScanSheet` or `ReadBeam`. `ReadFlow` shows while the article comes. After CLOSE, the reader does not give a thing back, and the button opens the article again. |
| Unfold | A route stop in Navigation | The reader gives READ under the route stop. After READ, the glyph closes with the word READ, and the reader does not scan. `ReadPrint` shows for a short time. The sheet of the route stop is dark while the reader panel shows its print. It is also dark while the visitor reads the article. Then the reader panel stops, and the words come. |

- For the books of the Lounge, the display lock goes around the books, and the pick mesh is the box that holds them.
- With reduced motion, the receive way is a cut, with no `ReadFlow`.
- A CLOSE during the unfold folds the reader panel where it is. After it, each sheet has `material.opacity` 1.
- A wall screen, which is a mesh with `userData.screen`, is a pick only where `rooms.<id>.screens.inspect` is not `false`.

See [the scene file](ref_scene-json.md) for the boxes and [the test hooks](ref_test-hooks.md) for the meshes of the reader.
