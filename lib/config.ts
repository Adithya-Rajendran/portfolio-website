/**
 * Stable site identity, design tokens, and neutral fallbacks. Changing roles,
 * interests, biography, and editorial copy are owned by the Sanity Profile.
 */

/** Canvas (page background) colors — mirror --color-canvas/--color-canvas-dark
 *  in app/globals.css. Duplicated as literals only because viewport.themeColor
 *  and OG images cannot read CSS variables. */
export const THEME_COLORS = {
    light: "#0c1318",
    dark: "#0c1318",
} as const;

/** Neutral writing description used only when no CMS description is set. */
export const BLOG_DESCRIPTION =
    "Notes, essays, and experiments by Adithya Rajendran.";

export const siteConfig = {
    url: "https://adithya-rajendran.com",
    title: "Adithya Rajendran",
    description: "Writing, projects, and notes by Adithya Rajendran.",
    author: "Adithya Rajendran",
    /** Role-neutral fallback; current work and study come from Profile. */
    role: "Engineer and writer",
    /** Fallback location when the Profile singleton has no value. */
    location: "",
    /** Named profiles consumed by the footer and fallback profile views.
     *  x/youtube are slots — leave "" until the accounts exist and the
     *  footer icon + sameAs entry appear automatically when filled. */
    profiles: {
        linkedin: "https://www.linkedin.com/in/adithya-rajendran",
        github: "https://github.com/Adithya-Rajendran",
        x: "",
        youtube: "",
    },
};

/** Every public profile for schema.org sameAs — filled slots only. */
export const socialProfiles: string[] = [
    siteConfig.profiles.linkedin,
    siteConfig.profiles.github,
    siteConfig.profiles.x,
    siteConfig.profiles.youtube,
].filter(Boolean);
