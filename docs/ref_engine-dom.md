---
type: reference
title: The page parts that the engine uses
depends: []
---
# The page parts that the engine uses

This reference gives the lines in `src/engine/` that use the page outside the canvas of the station.

The unit test `src/engine/dom.test.ts` finds the lines that agree with this regex, and compares the count of each file with the table.

```text
document\.|querySelector|innerHTML|classList|(^|[^.\w])addEventListener\(|(window|document|globalThis)\.addEventListener|innerWidth|innerHeight|devicePixelRatio|document\.hidden
```

## Lines for each file

| File | Lines | Use | Until |
|---|---|---|---|
| `src/engine/kit.js` | 1 | A 2D canvas for the texture of a label | - |
| `src/engine/drone.js` | 1 | A 2D canvas for the texture of a book | - |
| `src/engine/hologram.js` | 1 | A 2D canvas for an image of the hologram | - |
| `src/engine/screens.js` | 1 | A 2D canvas for a wall screen | - |
| `src/engine/opening/receive.js` | 1 | A 2D canvas for the receive way | - |
| `src/engine/reader.js` | 34 | The `#reader` element, the article in it, its listeners and the size of the window | `U5` |
| `src/engine/comms.js` | 11 | The `#comms` element, its links, its listeners and the size of the window | `U6` |

## Other uses of the browser

The regex does not find these uses of the browser in `src/engine/`:

- `requestAnimationFrame` and `localStorage` in `src/engine/station.ts`.
- `matchMedia` for reduced motion in `station.ts`, `room.js`, `reader.js`, `comms.js` and `routemap.js`.
- `navigator` in `context.js` and `room.js`.
- `location` in `dev.js`, `reader.js` and `comms.js`.
- On the canvas: the `webglcontextlost` listener and `style.cursor`.
