# Crater floor square

`slope-x.webp`, `slope-z.webp`, `sun.webp` and `colour.webp` are one seamless 8 m square of crater floor: fractured slabs with sand-filled joints, drifts and ripples, and about 13.9k stones, with their slopes and the micro-shadow each slab edge and stone throws under the scene's fixed sun. `half/` holds the same square at 1024 px for coarse pointers; the main files are 2048 px. `floor.json` in each folder gives the size, the span, the slope range and the sun.

The square is generated, not photographed or measured, and uses no third-party data. It is an interpretation of such ground as rover cameras show it, standing under the measured Jezero terrain in `../jezero-v1/`. It is not a survey of the site.

Regenerate from the repository root:

```sh
node scripts/artwork/make-home-floor.mjs [directory]
```

Environment: `FLOOR_SIZE` sets the picture size (default 2048) and `FLOOR_PREVIEW` is for previews. `src/scripts/home-floor.ts` loads the four pictures; keep its `HOME_FLOOR` constants and the sun in `src/scripts/home-lighting.ts` equal to `floor.json` (`tests/v2/home-floor.test.ts` checks this). The directory name carries the version and is cached as immutable, so publish a changed floor as `floor-v2`.
