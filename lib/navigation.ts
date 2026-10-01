/**
 * The site's navigation, the one source for the header, the menu sheet,
 * the 404's primary and (from PR 16) the console's page list. Every
 * section is named by its plain label (Projects, Writing, Experience,
 * About, Contact); its themed name is a secondary tag on its own page.
 * URLs keep their words (plan §2.1). Keep this module free of imports.
 */

/** Canonical public routes shared by navigation and content. */
export const siteRoutes = {
    home: "/",
    blog: "/blog",
    /** Every entry with a search: a quiet link at the end of /blog. */
    archive: "/blog/archive",
    portfolio: "/portfolio",
    resume: "/resume",
    about: "/about",
    /** Comms: the form, its topics and the profiles. */
    contact: "/contact",
    feed: "/feed.xml",
} as const;

export interface NavItem {
    /** Stable id, also the section a page belongs to. */
    id: "missions" | "log" | "trajectory" | "crew" | "comms";
    href: string;
    /** The path whose pages are this section (aria-current). */
    section: string;
    /** The label a reader sees and hears, everywhere the section is named
     *  (the header, the menu sheet, the footer, page titles). */
    plain: string;
    /** The section's themed name: only a small secondary tag, above its
     *  page's title and on its share card (contract §6). */
    themed: string;
}

/** The five sections, in site order: the work first. */
export const primaryNavigation: readonly NavItem[] = [
    {
        id: "missions",
        href: siteRoutes.portfolio,
        section: "/portfolio",
        plain: "Projects",
        themed: "Missions",
    },
    {
        id: "log",
        href: siteRoutes.blog,
        section: "/blog",
        plain: "Writing",
        themed: "Flight Log",
    },
    {
        id: "trajectory",
        href: siteRoutes.resume,
        section: "/resume",
        plain: "Experience",
        themed: "Trajectory",
    },
    {
        id: "crew",
        href: siteRoutes.about,
        section: "/about",
        plain: "About",
        themed: "Crew File",
    },
    {
        id: "comms",
        href: siteRoutes.contact,
        section: "/contact",
        plain: "Contact",
        themed: "Comms",
    },
];

/** A section whose pages sit under an index: Projects, Writing. */
export type IndexedSection = NavItem & { id: "missions" | "log" };

/**
 * The section whose index a missed address falls under ("/blog/…" is
 * Writing's, "/portfolio/…" Projects'): the 404 offers that index as its
 * primary. Any other address, or none (on the server), has none: the
 * primary is Home.
 */
export function lostSection(path: string | null): IndexedSection | undefined {
    if (!path) return undefined;
    return primaryNavigation.find(
        (item): item is IndexedSection =>
            (item.id === "missions" || item.id === "log") &&
            path.startsWith(`${item.section}/`),
    );
}

/** The recruiter shortcut in the header bar below 960px, where the nav
 *  (and its Experience) is in the menu sheet. */
export const cvLink = { href: siteRoutes.resume, label: "CV" } as const;

/** Contact in the header bar below 960px, where the nav is in the menu
 *  sheet: the form is one click from every page at every width. */
export const contactLink = {
    href: siteRoutes.contact,
    label: "Contact",
} as const;

/**
 * A contact route from anywhere on the site: "/contact#hiring" opens Comms
 * with that route's topic chosen (lib/contact.ts lists the topics).
 */
export function contactHref(topic?: string): string {
    return topic ? `${siteRoutes.contact}#${topic}` : siteRoutes.contact;
}

/** The query that carries a broken link's address to the form. */
export const REPORT_PARAM = "broken";

/**
 * The 404's "Let me know": Hello, with the missed address for the form to
 * write into the message ("/contact?broken=%2Fblog%2Fx#hello"; lib/contact.ts
 * `reportedMessage`). Without the address, Hello alone.
 */
export function reportHref(path: string | null): string {
    return path
        ? `${siteRoutes.contact}?${REPORT_PARAM}=${encodeURIComponent(path)}#hello`
        : contactHref("hello");
}

/**
 * How a nav item marks the current URL: `page` on the section's own page,
 * `true` anywhere below it (a post marks Flight Log), otherwise none.
 */
export function navCurrent(
    pathname: string | null | undefined,
    item: Pick<NavItem, "href" | "section">,
): "page" | "true" | undefined {
    if (!pathname) return undefined;
    const path = pathname.replace(/\/+$/, "") || "/";
    if (path === item.href) return "page";
    if (path === item.section) return "page";
    if (path.startsWith(`${item.section}/`)) return "true";
    return undefined;
}

/** The old single-page portfolio's sections, and where each lives now. */
const PORTFOLIO_FRAGMENTS: Readonly<Record<string, string>> = {
    "#experience": `${siteRoutes.resume}#experience`,
    "#skills": `${siteRoutes.resume}#skills`,
    "#certifications": `${siteRoutes.resume}#certifications`,
    "#engineering-writing": siteRoutes.blog,
    "#contact": siteRoutes.contact,
};

/**
 * Where an old /portfolio fragment now lives, so a link shared before the
 * redesign (`/portfolio#skills`) is sent on: RouteMarker does it on the
 * client, since a server never sees the fragment. Null for any other
 * address (`#projects` is still the tiles).
 */
export function movedFragment(
    pathname: string | null | undefined,
    hash: string,
): string | null {
    const path = pathname?.replace(/\/+$/, "");
    if (path !== siteRoutes.portfolio) return null;
    return PORTFOLIO_FRAGMENTS[hash] ?? null;
}
