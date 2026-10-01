/**
 * The 3D flight's opening shot on the stage: the sunrise over Earth's limb
 * that flight-route.ts frames at the first frame, and that the poster in
 * trajectory-view.tsx echoes until the scene draws. Its own module, so the
 * page's eager code doesn't pull in the flight's geometry.
 */

/** Where the Sun rises on the stage (the lens), as shares of its width and
 *  height: a wide stage, and a phone's. */
export const OPEN_LENS = {
    wide: { x: 0.69, y: 0.34 },
    narrow: { x: 0.56, y: 0.2 },
} as const;

/** The circle Earth's limb follows there, in thousandths of the stage's
 *  height from the lens: fitted to the scene's projection across the part
 *  of the stage the scene shows (tests/lib/flight-route.test.ts holds it
 *  to the pose). */
export const OPEN_LIMB = {
    wide: { cx: -41.7, cy: 1078.9, r: 1094.2 },
    narrow: { cx: -35.4, cy: 896.1, r: 909.7 },
} as const;

/** Flight Manual prints the ☉ this far (pixels) above the Sun, clear of
 *  the drawn limb. */
export const SUN_LIFT = 44;
