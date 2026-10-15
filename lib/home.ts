import { missionTiers } from "@/lib/missions";
import { siteRoutes } from "@/lib/navigation";

/**
 * The home page's sections (contract §9), in reading order: the strongest
 * project and the others, the latest writing, and the close (the owner's
 * tagline and the ways to get in touch). A section with nothing to show
 * is absent; nothing is numbered. Pure; the page passes what it found.
 */

const HOME_ACTS = ["projects", "writing", "contact"] as const;
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

/** How many projects after the flagship get a row of their own.
 *  @internal Exported for tests. */
export const HOME_PROJECT_ROWS = 2;

/**
 * The home page's projects (`missionTiers`): the flagship with its summary
 * and plate and the next `HOME_PROJECT_ROWS` as compact rows, never a
 * quiet project unless every project is. Home curates these; the others (`also`, the quiet ones
 * among them) are /portfolio's, and while there are any the section links
 * there (All projects).
 */
export function homeProjects<
    T extends { featured?: number | null; quiet?: boolean | null },
>(ordered: readonly T[]): { flagship: T | null; rows: T[]; also: T[] } {
    return missionTiers(ordered, HOME_PROJECT_ROWS);
}

/**
 * The hero's quiet way to the writing, beside CV: the newest entry
 * (`logEntries`' order, newest first) by its title. None without an
 * entry, or when the newest has no title to name it by.
 */
export function heroLatest(
    entries: readonly { slug: string; title: string }[],
): { title: string; href: string } | null {
    const [newest] = entries;
    const title = newest?.title.trim();
    return newest && title
        ? { title, href: `${siteRoutes.blog}/${newest.slug}` }
        : null;
}
