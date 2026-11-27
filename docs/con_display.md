---
type: concept
title: The display of the visitor
depends: [docs/ref_content-json.md]
---
# The display of the visitor

The display of the visitor is the set of parts that the page shows on the rooms: `#hud`, `#inspectbar`, `#lock`, the cue, the READ glyph and the scan.
`public/js/hud.js` makes the display lock, the cue, the caption of the bar and the hint.

## Parts that do not move

- A part of the display can move one time when it appears, when it changes or when the visitor requests it. After that, it does not move.
- The reader draws a scan, a receive or an unfold only when the visitor requests READ for a thing.
- At other times, `ScanFan`, `ScanSheet`, `ScanBody`, `ReadFlow` and `ReadPrint` are not visible.
- When the article is open, the uniforms `uK` and `uFlow` of the beam do not change.
- The cue is the only part that appears without a request from the visitor. It appears one time, when the room shows in the full view, and then it does not move again. It follows its pick only when the view sways.
- With `prefers-reduced-motion: reduce`, these moves are cuts.

## The cue

A pick can have `cue: { pointer, touch }`.
For the Library, `rooms.writing.cue` gives `CLICK TO CHOOSE A BOOK` and `TAP TO CHOOSE A BOOK`.
The display shows the cue `#cue` on the first live pick that has a cue. It does this only in the full view of the room, when the view does not move.

The cue has marks on the outline of the pick and a label `<name> | <words>`, with `display.catalogue` and `rooms.writing.cue`.
The label is clear of the words of the page.
A press on the words of the label does the same as a click on the pick.

The cue does not show in these conditions:

- The display lock is on a pick, or a pick is in focus.
- The camera moves to a pick or from a pick, or the opening move of the room continues.
- A room loads, or the reader is open.
- Its pick had the focus before, during this visit to the room.

## The hint

`display.hint` is the general hint, with the fields `pointer` and `touch`.
A room can have a hint for that room, for example `rooms.experience.hint = { pointer, touch, until: 'turn' }`.
The hint of the room shows in place of the general hint until the visitor does what `until` names.
For Navigation, the visitor must turn the map by hand.
The page keeps this fact until the page closes.
After the visitor selects a thing for the first time, the general hint goes away.

## The turn of the route map

The route map of Navigation turns about the axis of the table, with `TURN` in `public/js/routemap.js` and `turning()` in `public/main.js`.

- A drag across the room with a mouse, a pen or a finger turns the map. A wheel that goes left and right (`deltaX`), or Shift with a vertical wheel, also turns it.
- A drag must be more than 6 px, and its part from left to right must be equal to or more than its vertical part.
- A vertical wheel without Shift does not turn the map. The page scrolls.
- After the release, the map coasts at a maximum of `TURN.FAST` radians each second. Then it stops with a route stop at the front.
- With reduced motion, the map goes to its route stop at once, and a wheel moves one route stop for each 100 px.
- The map does not turn while the reader is open, or from a press inside `#reader`, the nav, the bar or a button.
- A press that stops the map is not a click. A click immediately after a drag is not a click.
- When a route stop comes into focus, the map turns to it.
- When the visitor turns the map by hand while a route stop is in focus, the focus goes to the route stop at the front.
- A synthetic `pointermove` must have `buttons: 1`.

See [the content file](ref_content-json.md) for the words of the display.
