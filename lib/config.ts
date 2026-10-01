/**
 * Stable site identity: the address, the name and the profile links used
 * before a Profile exists. Everything that describes the owner or changes
 * over time (roles, availability, interests, the biography, page
 * introductions and contact routes) is owned by the Sanity Profile, and
 * is left out, not replaced, when the Profile leaves it empty.
 */

export const siteConfig = {
    url: "https://adithya-rajendran.com",
    title: "Adithya Rajendran",
    author: "Adithya Rajendran",
    /** The site's own source, credited in the footer's colophon. */
    source: "https://github.com/Adithya-Rajendran/portfolio-website",
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
