/** Canonical public routes shared by navigation and content. */
export const siteRoutes = {
    home: "/",
    portfolio: "/portfolio",
    blog: "/blog",
    about: "/about",
    resume: "/resume",
} as const;

export const primaryNavigation = [
    { href: siteRoutes.blog, label: "Writing", match: "writing" },
    { href: siteRoutes.portfolio, label: "Work", match: "work" },
    { href: siteRoutes.resume, label: "Résumé", match: "resume" },
] as const;

export const footerNavigation = [
    { href: siteRoutes.about, label: "About" },
    { href: `${siteRoutes.portfolio}#contact`, label: "Contact" },
    { href: siteRoutes.resume, label: "Résumé" },
] as const;
