import type { Pacing } from "./journey";

/**
 * The 3D flight's pacing (journey.tsx's `pacing`): each transfer and the
 * finale get the scroll their camera moves need, and Play runs every leg
 * at one pace. The section is 100 + weight × 52 svh tall (about 591).
 * Its own module, so the page's eager code doesn't pull in the flight's
 * geometry (flight-route.ts re-exports it).
 */
export const FLIGHT_PACING = {
    route: { transfer: 0.95, plan: 2.0 },
    transferRate: 1.0,
    duration: 32000,
} satisfies Pacing;
