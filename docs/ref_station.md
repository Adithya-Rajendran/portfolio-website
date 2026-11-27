---
type: reference
title: The Station of the engine
depends: [docs/ref_engine-dom.md, docs/ref_test-hooks.md]
---
# The Station of the engine

This reference gives the parts of `Station`, which `createStation(canvas, content, site, host)` in `src/engine/station.ts` returns, and tells which part of the site sets each value and which part reads it.

The types are in `src/engine/types.ts`.

The page code in `src/legacy-shell/` uses only `Station` to control the engine.

The lines of the engine that use the page are in [the page parts that the engine uses](ref_engine-dom.md).

## Arguments of `createStation`

| Argument | Set by | Contents |
|---|---|---|
| `canvas` | `src/legacy-shell/shell.js` | The `<canvas id="scene">` element. |
| `content` | `src/legacy-shell/shell.js` | The data of `content.json` after `furnish()` of `src/content/site.js`. |
| `site` | `src/legacy-shell/shell.js` | The posts, the projects and the profile from `loadSite()`. |
| `host` | `src/legacy-shell/shell.js` | The functions of the page that the engine calls. See the list below. |

## Functions of host

| Function | Used by | Contents |
|---|---|---|
| `onLink(href)` | The reader, for a link in an article and for CLOSE | The page goes to the address, or goes back when `href` is `null`. |
| `onShown()` | The reader, when it shows an article | The page writes the address of the article. |
| `travel(to)` | `Station.travel` and a door with one stop | The page loads the room `to`, with a new address. |
| `clearance(x0, x1)` | The reader, for the READ glyph | The height of the inspect bar above the bottom of the window between `x0` and `x1`, in CSS px. |

## Values that the page reads

Each value has `get()` and `subscribe(fn)`.

`subscribe` calls `fn` with the new value when the value changes, and gives a function that stops the calls.

| Value | Set by | Read by | Contents |
|---|---|---|---|
| `room` | `enter` | The loader of the page | `{ id, status, progress, label, error }`. `id` is the room that shows, or `null` while no room shows. `status` is `'loading'`, `'ready'` or `'failed'`. |
| `focused` | `focus`, `back`, `step`, `read`, `tap` and each frame | The inspect bar, the caption of the bar and the address | `null`, or the pick in focus: `pick`, `name`, `verb`, `aside`, `steady`, `backLabel`, `tour`, `ways`, `options`, `current`, `list`, `canRead`, `readLabel`, `typing`, `reads`, `url` and `title`. |
| `picks` | Each frame | The cue and the hero button | The live picks of the room, with no pick that has `reads`: `{ id, name, verb, kind, cta, cue }`. |
| `pointed` | Each frame | The display lock | The pick under the pointer, or `null`. |
| `gliding` | `focus` and each frame | `display.state()` | `true` until the camera is at the pick in focus, or back at the room. |
| `wideAtRest` | Each frame | The cue | `true` when the full view of the room does not move and no pick is in focus. |
| `hintTurnDone` | Each frame | The hint | `true` after the visitor turns the route map. |
| `reader` | Each frame | `window.__lobby.reader` | `{ state, url, title, phone }`. `state` is `'closed'`, `'scanning'` or `'open'`. |
| `contact` | Each frame | Not read yet | `{ open, links }` for the links of Comms. |
| `view` | `setView`, `focus` and each frame | Not read yet | `'wide'` or `'close'`. |
| `volumesCount` | `enter` | The facts of the room | The count of books on the shelf of the Library. |
| `turn` | `enter` | The drag and the wheel on the route map | `null`, or the functions of the route map that the page uses, with `usable()`, `grip()` and `feel`. |

## Functions that the page calls

| Function | Used by | Result |
|---|---|---|
| `enter(id, { want })` | The page, at the start and for a new room | The engine loads the room `id`. `want` is the slug of a book that the Library must have on its shelf. |
| `start()` | The page, after the first room loads | The engine draws the first frame and starts each frame. |
| `focus(id)` | The cue and the hero button | The focus goes to the pick `id`. For a door with one stop, the visitor goes to its room after `1500` ms. |
| `back()`, `step(d)`, `choose(i)`, `travel(to)` | The inspect bar and the keys | The actions of BACK, of the tour, of an item of the list and of a door. |
| `read(id)` | The `Enter` key and the READ button | The reader opens the pick in focus, or the pick `id`. The result is `false` when the pick has no article. |
| `readAt(url, { fly })` | The address of an article, the hero button | The reader opens the article at `url`. |
| `closeReader()`, `jump(anchor)`, `readerScrollTo(anchor)` | The address | The reader closes, goes to a heading, or goes to a heading when it opens. |
| `reads(url)` | The page that a visitor reads without the station | `true` when the room can show the article at `url`. |
| `rectOf(id)`, `contactLinkRect(i)`, `frameOf('reader')` | The display lock and the cue | The `Rect` of a pick or of a link of Comms in CSS px, or the size and the transform of the reader. |
| `setCovered('bar', rect)` | Not used yet | The `Rect` of the inspect bar, in place of `host.clearance`. |
| `setView(view, { now })` | The navigation and the step into the station | The camera goes to the full view or to the close view. With `now`, it is there at once. |
| `pointer(x, y, type, how)`, `pointerGone()`, `tilt(gamma, beta)` | The pointer and the device angle | The camera sways, and the engine finds the pick under the pointer. |
| `tap(x, y)` | A click on the canvas | The focus goes to the pick under the point. |
| `setActive(on)` | The class of `<html>` | The engine draws only when the page is in the station mode. |
| `resize(width, height, dpr)`, `setHidden(hidden)` | The window | The size of the image, and a new start of the GPU times. |
| `onFrame(fn)` | The display lock and the cue | The engine calls `fn` after it draws a frame, and when it does not draw. |

## Fields of a pick in the engine

`src/engine/room.js` makes each pick.

Only the engine reads these fields.

`window.__lobby.picks` gives the same objects to the tests, as [the test hooks](ref_test-hooks.md) tell.

| Field | Set by | Contents |
|---|---|---|
| `mesh`, `bounds` | Each pick | The mesh under a click, and the outline of the pick. |
| `pose` | Each pick | The position of the camera and its target when the pick is in focus. |
| `name`, `verb`, `cue`, `cta` | Each pick | The words of the display lock and of the cue, and the pick of the hero button. |
| `door` | A door | `{ label, to, stops }`. |
| `options`, `current`, `list` | The terminal of the Library | The items of the list in the inspect bar, the current item, and `true` for the list of books. |
| `enter`, `enterLabel`, `source`, `returnLabel` | `offers()` | The pick that reads this pick, its button and the article. |
| `reads`, `aside`, `steady`, `live`, `calm`, `typing`, `back`, `backLabel`, `url`, `title` | The pick of the reader | The values of the reader. |
| `click`, `cursor` | Comms | A click on a link of Comms, and the shape of the pointer above it. |
| `station` | A route stop | The index of the route stop. |
| `onFocus`, `left` | Each pick | The functions that the engine calls when the focus changes. |
