---
type: reference
title: The content file of the rooms
depends: []
---
# The content file of the rooms

This reference gives the keys of `public/content.json` that the tests read.

- `rooms.<id>.sub` is `[]` in all rooms except two: the Atrium has `["{name}  ·  {headline}"]` and the Lounge has `["{headline}  ·  {location}"]`.
- `public/js/site.js` fills the two `sub` lines from `profile.json`. It removes a line when it cannot fill a place in it. Without a profile, both are `[]`.
- `public/main.js` hides `.sub` when it has no lines. There is no other line of explanation under the headline of a room.
- `rooms.projects.screens.inspect` and `rooms.experience.screens.inspect` are `false`, and their cards have no `cta`. The wall screens of these rooms are not picks, not on the tour and not sources.
- `reader.receiving` (`RECEIVING`) is the word of the receive way. `reader.scanning` is the word of the glyph during the scan of a flat thing.
- `display` holds the words of the display: the verbs `read`, `inspect`, `open`, `write`, `enter`, `stops`, `sealed` and `choose`, the names `catalogue` and `exhibit`, and `hint`.
- `rooms.writing.cue` holds the words of the cue in the Library.
- `rooms.experience.hint` holds the hint of Navigation.

## Comms

- `rooms.comms` has `cta` (`GET IN TOUCH  →`) and `bright: true`. With `bright`, `public/main.js` sets `body.bright`.
- The screens of Comms have the tag `COMMS` and two places that `public/js/site.js` fills.
- `rooms.comms.comms` has `title`, `standby`, `openTo`, `resume`, `opens` and `writeNote`.
- Comms gives three links: `profile.contact.links` and then `profile.resume`.
- `section#comms[data-mode="links"]` holds HTML links, `a[target=_blank][rel=noopener]`, with the `aria-label` `"<label>, opens in a new tab"`. The links are `inert` until the field opens.
- The pick `picks.find(p => p.cta)` has the name `CONTACT`, and its verb is `display.open`.
