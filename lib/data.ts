export const links = [
    {
        name: "Projects",
        hash: "/portfolio#projects",
    },
    {
        name: "Writing",
        hash: "/portfolio#engineering-writing",
    },
    {
        name: "Experience",
        hash: "/portfolio#experience",
    },
    {
        name: "Skills",
        hash: "/portfolio#skills",
    },
    {
        name: "Certifications",
        hash: "/portfolio#certifications",
    },
    {
        name: "Contact",
        hash: "/portfolio#contact",
    },
] as const;

export function portfolioLinks(showProjects: boolean) {
    return showProjects
        ? links
        : links.filter((link) => link.name !== "Projects");
}
