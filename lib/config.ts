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
    "Personal writing by Adithya Rajendran: technical notes, documentaries, interests, experiments, and whatever else feels worth keeping.";

export const siteConfig = {
    url: "https://adithya-rajendran.com",
    title: "Adithya Rajendran",
    description:
        "The personal website of Adithya Rajendran: work, writing, interests, and whatever comes next.",
    author: "Adithya Rajendran",
    /** Default role line shown in OG images and structured data. */
    role: "Cloud Field Engineer @ Canonical",
    /** Fallback location when the Profile singleton has no value. */
    location: "Remote · United States",
    /** Named profiles consumed by the footer and fallback profile views.
     *  x/youtube are slots — leave "" until the accounts exist and the
     *  footer icon + sameAs entry appear automatically when filled. */
    profiles: {
        linkedin: "https://www.linkedin.com/in/adithya-rajendran",
        github: "https://github.com/Adithya-Rajendran",
        x: "",
        youtube: "",
    },
    /** Fallback identity facts for structured data and CI builds. */
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
    "https://app.hackthebox.com/users/514798",
    "https://tryhackme.com/p/Cagmas",
    siteConfig.profiles.x,
    siteConfig.profiles.youtube,
].filter(Boolean);
