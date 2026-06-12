/**
 * Single source of truth for site-wide brand facts. Components must pull
 * names, URLs, and canvas colors from here rather than inlining them.
 */

/** Canvas (page background) colors — mirror --color-canvas/--color-canvas-dark
 *  in app/globals.css. Duplicated as literals only because viewport.themeColor
 *  and OG images cannot read CSS variables. */
export const THEME_COLORS = {
    light: "#f4f5f8",
    dark: "#050608",
} as const;

export const siteConfig = {
    url: "https://adithya-rajendran.com",
    title: "Adithya Rajendran | Field Engineer & Cybersecurity Professional",
    description:
        "Cloud Field Engineer at Canonical. Portfolio, projects, and cybersecurity blog.",
    author: "Adithya Rajendran",
    /** Default role line shown in OG images and structured data. */
    role: "Cloud Field Engineer @ Canonical",
    /** Named profiles consumed by the footer, hero, and intro CTAs. */
    profiles: {
        linkedin: "https://www.linkedin.com/in/adithya-rajendran",
        github: "https://github.com/Adithya-Rajendran",
    },
    socials: [
        "https://www.linkedin.com/in/adithya-rajendran",
        "https://github.com/Adithya-Rajendran",
        "https://www.credly.com/users/adithya-rajendran",
        "https://app.hackthebox.com/profile/514798",
        "https://tryhackme.com/p/Cagmas",
    ],
};
