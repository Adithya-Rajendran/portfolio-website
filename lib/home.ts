import { missionTiers } from "@/lib/missions";

/**
 * The home page's sections (contract §9), in reading order: the strongest
 * project and the others, the latest writing, and the close (the owner's
 * tagline and the ways to get in touch). A section with nothing to show
 * is absent; nothing is numbered. Pure; the page passes what it found.
 */

export const HOME_ACTS = ["projects", "writing", "contact"] as const;
export type HomeAct = (typeof HOME_ACTS)[number];

export function homeActs(content: {
    projects: number;
    entries: number;
}): HomeAct[] {
    const shown: Record<HomeAct, boolean> = {
        projects: content.projects > 0,
        writing: content.entries > 0,
        // The close: the form always takes a message.
        contact: true,
    };
    return HOME_ACTS.filter((act) => shown[act]);
}

/** How many projects after the flagship get a row of their own. */
export const HOME_PROJECT_ROWS = 2;

/**
 * The home page's projects (`missionTiers`): the flagship with its summary
 * and plate and the next `HOME_PROJECT_ROWS` as compact rows. Home
 * curates these; the others (`also`) are /portfolio's, and while there are
 * any the section links there (All projects).
 */
export function homeProjects<T extends { featured?: number | null }>(
    ordered: readonly T[],
): { flagship: T | null; rows: T[]; also: T[] } {
    return missionTiers(ordered, HOME_PROJECT_ROWS);
}
