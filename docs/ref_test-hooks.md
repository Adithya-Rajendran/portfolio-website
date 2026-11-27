---
type: reference
title: The test hooks
depends: []
---
# The test hooks

This reference gives the functions on `window.__lobby` that the browser tests use, and also `ready`, `picks`, `setFocus`, `camera` and `mode`.

## Hooks

| Hook | Return value |
|---|---|
| `reader.state()` | `'closed'`, `'scanning'` or `'open'` |
| `reader.url()`, `reader.slug()` | The address of the article and the last part of its path, or `null` |
| `reader.read(slug or path)`, `reader.close()` | The actions of the READ button and of BACK |
| `volumes()` | The catalogue, `[{ slug, title }]`, in the order of the shelf |
| `held()` | The slug of the book that the drone holds, or `null` |
| `display.state()` | `{ lock, named, hint, gliding, cue }`. See the list below. `window.__lobby.display` has only `state`. |
| `picks[i].name`, `picks[i].verb` | The name of the pick on the display, in capital letters, and the action of a click on it. Both are `''` on the pick that has `reads`, which has no display lock. |
| `picks[i].bounds()` | Not necessary. The outline of the pick as points in the world. |
| `scene`, `scene.getObjectByName(...)` | The meshes of the reader by name. See the list below. |
| `turn` | `null` in all rooms except Navigation. See the list below. |
| `step(d)` | The tour moves `d` steps: the route stops first, in the order of the line, then the other picks. |
| `enter(id)` | A move to a different room without a new load of the page. |

## Fields of display.state()

- `lock`: `null`, or `{ name, verb, rect: [left, top, width, height] }`. `rect` gives the corner marks around the pick under the pointer in CSS px, 6 px out from the outline of the pick.
- `named`: the text of `#named` in the bar, which is the pick in focus. It is `''` for READ.
- `hint`: the words of the hint, or `''` after the hint goes away.
- `gliding`: `true` while the camera moves to a pick or from a pick.
- `cue`: `null`, or `{ name, words, rect }` for the cue on a pick. `rect` is as in `lock.rect`.

## Meshes of the reader

- `ReadGlyph`: the READ glyph, which is the `mesh.parent` of the pick that has `reads`. Its uniforms are `uShow`, `uWord`, `uHover` and `uProgress`, with no `uTime`.
- `ReadFrame`: the reader panel.
- `ReadBeam`: the beam, with the uniforms `uK` and `uFlow`.
- `ReadAnchor`: an `Object3D` on the thing that the visitor reads.
- `ScanSheet`: the sheet of a scan, with the uniform `uSnap`.
- `ScanFan`: the fan of a scan.
- `ScanBody`: the box of a thing with a shape in a scan.
- `ReadFlow`: the mesh of the receive way.
- `ReadPrint`: the mesh of the unfold way.
- A mesh that the page does not show has `visible` false, on the mesh or on a parent.

## Functions of turn

- `angle()`: the angle in radians from the layout of the route.
- `front()`: the route stop that is near to the front.
- `settled()`: `true` when the map does not move.
- `moving()`: `true` when the map coasts or settles after a release.
- `byHand()`: `true` when the visitor turned the map last, and not a focus that sent it to a route stop.
- `heading()`: the route stop that the map is on or goes to, or `null` while the visitor holds the map or while it coasts.
- `to(i, now)`: turns to route stop `i`. With `now`, or with reduced motion, it goes there at once.
- `nudge(r)`: the same as a drag of `r` radians and a release.
- `step(d)`: moves `d` route stops along the line at once.
- `grip()`: the pixels of drag for one radian.
- The picks of the route map have `station: i`. While the map turns, the canvas has the class `turns`.
