/**
 * The home page's sections (contract §9), in reading order: the strongest
 * project and the others, the latest writing, the owner's research
 * interests and the contact close. A section with nothing to show is
 * absent; nothing is numbered. Pure; the page passes what it found.
 */

export const HOME_ACTS = [
    "projects",
    "writing",
    "interests",
    "contact",
] as const;
export type HomeAct = (typeof HOME_ACTS)[number];

export function homeActs(content: {
    projects: number;
    entries: number;
    /** The owner's interests statement is set. */
    interests: boolean;
}): HomeAct[] {
    const shown: Record<HomeAct, boolean> = {
        projects: content.projects > 0,
        writing: content.entries > 0,
        interests: content.interests,
        // The contact close: the form always takes a message.
        contact: true,
    };
    return HOME_ACTS.filter((act) => shown[act]);
}

/** How many projects after the flagship get a row of their own. */
export const HOME_PROJECT_ROWS = 2;

/**
 * The home page's projects, in `missionOrder`: the flagship (featured
 * slot 1, else the first) with its summary and plate, the next
 * `HOME_PROJECT_ROWS` as compact rows, and any others as one quiet line
 * of links, so the least prominent project is the owner's last.
 */
export function homeProjects<T extends { featured?: number | null }>(
    ordered: readonly T[],
): { flagship: T | null; rows: T[]; also: T[] } {
    if (!ordered.length) return { flagship: null, rows: [], also: [] };
    const lead = Math.max(
        0,
        ordered.findIndex((project) => project.featured === 1),
    );
    const rest = ordered.filter((_, index) => index !== lead);
    return {
        flagship: ordered[lead],
        rows: rest.slice(0, HOME_PROJECT_ROWS),
        also: rest.slice(HOME_PROJECT_ROWS),
    };
}
