/**
 * The home page's acts (plan §6.2 row 13, contract §9), in the order of
 * the voyage. An act with nothing to show is absent, and the acts are
 * numbered as they appear (§ 00.1 …), so a missing act leaves no gap.
 * Pure; the page passes what it found.
 */

export const HOME_ACTS = [
    "now",
    "missions",
    "log",
    "trajectory",
    "crew",
    "comms",
] as const;
export type HomeAct = (typeof HOME_ACTS)[number];

export function homeActs(content: {
    /** A current role, or the owner's questions. */
    now: boolean;
    missions: number;
    entries: number;
    roles: number;
    /** A profile with a biography (the Crew act introduces it). */
    profile: boolean;
}): HomeAct[] {
    const shown: Record<HomeAct, boolean> = {
        now: content.now,
        missions: content.missions > 0,
        log: content.entries > 0,
        trajectory: content.roles > 0,
        crew: content.profile,
        // The contact routes: Hello is always offered.
        comms: true,
    };
    return HOME_ACTS.filter((act) => shown[act]);
}

/** "00.3": an act's number among those shown. */
export function actNumber(acts: readonly HomeAct[], act: HomeAct): string {
    return `00.${acts.indexOf(act) + 1}`;
}
