import type { Pacing } from "./journey";

/**
 * The 3D flight's pacing (journey.tsx's `pacing`): the first chapter gets
 * room for the opening's rise from the sunrise (its card settles after
 * it), each transfer and the finale get the scroll their camera moves
 * need, and Play runs every leg at one pace. The section is
 * 100 + weight × 52 svh tall (about 599). Its own module, so the page's
 * eager code doesn't pull in the flight's geometry (flight-route.ts
 * re-exports it).
 */
export const FLIGHT_PACING = {
    route: { transfer: 0.95, plan: 1.8, open: 0.35, restFirst: 0.6 },
    transferRate: 1.0,
    duration: 32000,
} satisfies Pacing;
