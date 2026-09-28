/**
 * The site's navigation, the one source for the header, the menu sheet,
 * the footer, the 404's return routes and (from PR 16) the console's page
 * list. Themed names are labels only: URLs keep their plain words (plan
 * §2.1). Keep this module free of imports.
 */

/** Canonical public routes shared by navigation and content. */
export const siteRoutes = {
    home: "/",
    blog: "/blog",
    portfolio: "/portfolio",
    resume: "/resume",
    about: "/about",
    /** Comms: the contact routes and the form. /portfolio#contact keeps
     *  the same form for links shared before the page existed. */
    contact: "/contact",
    resumePdf: "/resume/view",
    feed: "/feed.xml",
} as const;

export interface NavItem {
    /** Stable id, also the section a page belongs to. */
    id: "log" | "missions" | "trajectory" | "crew" | "comms";
    /** The site as one numbered document: § 01 … § 05. */
    num: string;
    href: string;
    /** The path whose pages are this section (aria-current). */
    section: string;
    themed: string;
    plain: string;
    /** One line for the 404's return routes. */
    blurb: string;
}

/** The five themed + plain pairs, in the order of the voyage. */
export const primaryNavigation: readonly NavItem[] = [
    {
        id: "log",
        num: "01",
        href: siteRoutes.blog,
        section: "/blog",
        themed: "Flight Log",
        plain: "Blog",
        blurb: "Every entry, newest first.",
    },
    {
        id: "missions",
        num: "02",
        href: siteRoutes.portfolio,
        section: "/portfolio",
        themed: "Missions",
        plain: "Projects",
        blurb: "Projects and the work behind them.",
    },
    {
        id: "trajectory",
        num: "03",
        href: siteRoutes.resume,
        section: "/resume",
        themed: "Trajectory",
        plain: "Experience",
        blurb: "Roles, study and the CV.",
    },
    {
        id: "crew",
        num: "04",
        href: siteRoutes.about,
        section: "/about",
        themed: "Crew File",
        plain: "About",
        blurb: "Who is behind the missions.",
    },
    {
        id: "comms",
        num: "05",
        href: siteRoutes.contact,
        section: "/contact",
        themed: "Comms",
        plain: "Contact",
        blurb: "Write about a role, a project or anything else.",
    },
];

/** The home page as a return route (the 404). */
export const homeRoute = {
    num: "00",
    href: siteRoutes.home,
    themed: "Launch",
    plain: "Home",
    blurb: "Where the voyage starts.",
} as const;

/** The recruiter shortcut in the header bar, at every width. */
export const cvLink = { href: siteRoutes.resume, label: "CV" } as const;

/** Extra links in the menu sheet (< 960px). */
export const sheetLinks = [
    { href: siteRoutes.resumePdf, label: "Résumé (PDF)" },
    { href: siteRoutes.feed, label: "RSS" },
] as const;

/** The footer's plain links; GitHub and LinkedIn come from the profile. */
export const footerLinks = [
    { href: siteRoutes.resume, label: "CV" },
    { href: siteRoutes.resumePdf, label: "Résumé (PDF)" },
    { href: siteRoutes.feed, label: "RSS feed" },
] as const;

/**
 * A contact route from anywhere on the site: "/contact#hiring" opens Comms
 * with that route's topic chosen (lib/contact.ts lists the topics).
 */
export function contactHref(topic?: string): string {
    return topic ? `${siteRoutes.contact}#${topic}` : siteRoutes.contact;
}

/** The accessible name of a pair: "Flight Log, Blog". */
export function pairName(item: { themed: string; plain: string }): string {
    return `${item.themed}, ${item.plain}`;
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
 * file, the CV, Comms) get the solid header, with a firmer rule under it.
 * RouteMarker sets it as `html[data-header]`.
 */
export function headerMode(
    pathname: string | null | undefined,
): "solid" | undefined {
    if (!pathname) return undefined;
    const path = pathname.replace(/\/+$/, "") || "/";
    if (/^\/blog\/(?!archive$|tags$)[^/]+$/.test(path)) return "solid";
    if (/^\/portfolio\/[^/]+$/.test(path)) return "solid";
    if (path === siteRoutes.resume || path === siteRoutes.contact) {
        return "solid";
    }
    return undefined;
}
