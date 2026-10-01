/**
 * The site's navigation, the one source for the header, the menu sheet,
 * the footer, the 404's primary and link rows and (from PR 16) the
 * console's page list. Every section is named by its plain label
 * (Projects, Writing, Experience, About, Contact); its themed name is a
 * secondary tag on its own page. URLs keep their words (plan §2.1). Keep
 * this module free of imports.
 */

/** Canonical public routes shared by navigation and content. */
export const siteRoutes = {
    home: "/",
    blog: "/blog",
    /** Every entry with a search: a quiet link at the end of /blog. */
    archive: "/blog/archive",
    portfolio: "/portfolio",
    resume: "/resume",
    /** The flight: the timeline in 3D, linked from /resume. */
    trajectory: "/resume/trajectory",
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
    /** One line for the 404's link rows. */
    blurb: string;
}

/** The five sections, in site order: the work first. */
export const primaryNavigation: readonly NavItem[] = [
    {
        id: "missions",
        href: siteRoutes.portfolio,
        section: "/portfolio",
        plain: "Projects",
        themed: "Missions",
        blurb: "Projects and case studies.",
    },
    {
        id: "log",
        href: siteRoutes.blog,
        section: "/blog",
        plain: "Writing",
        themed: "Flight Log",
        blurb: "Articles and technical notes.",
    },
    {
        id: "trajectory",
        href: siteRoutes.resume,
        section: "/resume",
        plain: "Experience",
        themed: "Trajectory",
        blurb: "Experience, education and CV.",
    },
    {
        id: "crew",
        href: siteRoutes.about,
        section: "/about",
        plain: "About",
        themed: "Crew File",
        blurb: "Background and interests.",
    },
    {
        id: "comms",
        href: siteRoutes.contact,
        section: "/contact",
        plain: "Contact",
        themed: "Comms",
        blurb: "Send a message.",
    },
];

/** The 404's link rows: the work, the writing and the form. */
export const lostRoutes: readonly NavItem[] = primaryNavigation.filter(
    (item) =>
        item.id === "missions" || item.id === "log" || item.id === "comms",
);

/** A section whose pages sit under an index: Projects, Writing. */
export type IndexedSection = NavItem & { id: "missions" | "log" };

/**
 * The section whose index a missed address falls under ("/blog/…" is
 * Writing's, "/portfolio/…" Projects'): the 404 offers that index as its
 * primary and leaves the section out of its rows. Any other address, or
 * none (on the server), has none: the primary is Home.
 */
export function lostSection(path: string | null): IndexedSection | undefined {
    if (!path) return undefined;
    return primaryNavigation.find(
        (item): item is IndexedSection =>
            (item.id === "missions" || item.id === "log") &&
            path.startsWith(`${item.section}/`),
    );
}

/** The recruiter shortcut in the header bar, at every width. */
export const cvLink = { href: siteRoutes.resume, label: "CV" } as const;

/** Contact in the header bar below 960px, where the nav is in the menu
 *  sheet: the form is one click from every page at every width. */
export const contactLink = {
    href: siteRoutes.contact,
    label: "Contact",
} as const;

/** The footer's plain links; GitHub and LinkedIn come from the profile.
 *  One CV route: /resume carries the PDF. */
export const footerLinks = [
    { href: siteRoutes.resume, label: "CV" },
    { href: siteRoutes.feed, label: "RSS" },
] as const;

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

/**
 * The header's mode on a route (G1): reading pages (an entry, a mission
 * file, the CV, the Crew File, Comms) get the solid header, with a firmer
 * rule under it. RouteMarker sets it as `html[data-header]`.
 */
export function headerMode(
    pathname: string | null | undefined,
): "solid" | undefined {
    if (!pathname) return undefined;
    const path = pathname.replace(/\/+$/, "") || "/";
    if (/^\/blog\/(?!archive$|tags$)[^/]+$/.test(path)) return "solid";
    if (/^\/portfolio\/[^/]+$/.test(path)) return "solid";
    if (
        path === siteRoutes.resume ||
        path === siteRoutes.about ||
        path === siteRoutes.contact
    ) {
        return "solid";
    }
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
