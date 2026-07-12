/** Canonical public routes shared by global chrome and the home terminal. */
export const siteRoutes = {
    home: "/",
    portfolio: "/portfolio",
    blog: "/blog",
    about: "/about",
    resume: "/resume",
} as const;

export const primaryNavigation = [
    { href: siteRoutes.home, label: "Home", match: "home" },
    { href: siteRoutes.portfolio, label: "Portfolio", match: "work" },
    { href: siteRoutes.blog, label: "Blog", match: "writing" },
    { href: siteRoutes.about, label: "About", match: "about" },
    { href: siteRoutes.resume, label: "Résumé", match: "resume" },
] as const;

export const footerNavigation = [
    { href: siteRoutes.home, label: "Home" },
    { href: siteRoutes.portfolio, label: "Portfolio" },
    { href: siteRoutes.blog, label: "Blog" },
    { href: siteRoutes.about, label: "About" },
    { href: `${siteRoutes.portfolio}#contact`, label: "Contact" },
] as const;
