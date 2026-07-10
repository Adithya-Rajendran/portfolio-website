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

/** Blog index copy — the single home for this text. Consumed by
 *  lib/structured-data.ts (buildBlog) and app/blogs/layout.tsx metadata;
 *  keep byte-identical across both. */
export const BLOG_DESCRIPTION =
    "Technical blog by Adithya Rajendran covering cybersecurity, cloud engineering, homelabs, penetration testing, and DevOps. Hands-on guides, write-ups, and insights.";

export const siteConfig = {
    url: "https://adithya-rajendran.com",
    title: "Adithya Rajendran | Field Engineer & Cybersecurity Professional",
    description:
        "Cloud Field Engineer at Canonical. Portfolio, projects, and cybersecurity blog.",
    author: "Adithya Rajendran",
    /** Default role line shown in OG images and structured data. */
    role: "Cloud Field Engineer @ Canonical",
    /** Fallback location line (footer + /about rail) when the Sanity
     *  about singleton doesn't provide one. */
    location: "Remote · United States",
    /** Named profiles consumed by the footer, hero, and intro CTAs.
     *  x/youtube are slots — leave "" until the accounts exist and the
     *  footer icon + sameAs entry appear automatically when filled. */
    profiles: {
        linkedin: "https://www.linkedin.com/in/adithya-rajendran",
        github: "https://github.com/Adithya-Rajendran",
        x: "",
        youtube: "",
    },
    /** Fallback identity facts for structured data when the Sanity intro
     *  singleton doesn't provide them (also covers CI fallback builds). */
    alumniOf: "University of California, Santa Cruz",
    knowsAbout: [
        "Cloud Engineering",
        "Cybersecurity",
        "OpenStack",
        "Kubernetes",
        "AWS",
        "DevOps",
        "Penetration Testing",
        "Network Security",
    ],
};

/** Every public profile for schema.org sameAs — filled slots only. */
export const socialProfiles: string[] = [
    siteConfig.profiles.linkedin,
    siteConfig.profiles.github,
    "https://www.credly.com/users/adithya-rajendran",
    "https://app.hackthebox.com/profile/514798",
    "https://tryhackme.com/p/Cagmas",
    siteConfig.profiles.x,
    siteConfig.profiles.youtube,
].filter(Boolean);
