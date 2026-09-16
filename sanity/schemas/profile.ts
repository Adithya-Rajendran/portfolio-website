import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
    name: "profile",
    title: "Profile",
    type: "document",
    groups: [
        { name: "identity", title: "Identity", default: true },
        { name: "writing", title: "Homepage & Writing" },
        { name: "about", title: "About" },
        { name: "now", title: "Right Now" },
        { name: "portfolio", title: "Portfolio" },
    ],
    initialValue: {
        name: "Adithya Rajendran",
        currentCuriosities: [],
    },
    fields: [
        defineField({
            name: "name",
            title: "Name",
            type: "string",
            group: "identity",
            validation: (Rule) => Rule.required().max(100),
        }),
        defineField({
            name: "headline",
            title: "Headline",
            type: "string",
            group: "identity",
            description:
                "Your current role or studies. Used on the homepage, About, Work, and social sharing images.",
            validation: (Rule) => Rule.required().max(140),
        }),
        defineField({
            name: "introduction",
            title: "Introduction",
            type: "text",
            rows: 4,
            group: "identity",
            description:
                "A short personal introduction for the homepage, About, and Work. Keep it concise enough to read at a glance.",
            validation: (Rule) => Rule.required().max(500),
        }),
        defineField({
            name: "focusAreas",
            title: "Current Focus Areas",
            type: "array",
            group: "writing",
            description:
                "Short topics shown above the homepage headline and used in search metadata. These are interests, not claims of expertise.",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(60),
                }),
            ],
            options: { layout: "tags" },
            validation: (Rule) => Rule.unique().max(4),
        }),
        defineField({
            name: "workSummary",
            title: "Homepage Work Summary",
            type: "text",
            rows: 3,
            group: "writing",
            description:
                "Connect your current direction with the experience behind it. Appears beside the homepage Work and Résumé links.",
            validation: (Rule) => Rule.max(500),
        }),
        defineField({
            name: "writingDescription",
            title: "Writing Introduction",
            type: "text",
            rows: 3,
            group: "writing",
            description:
                "What readers will find in your notebook. Also used for writing search results, social sharing, and the RSS feed.",
            validation: (Rule) => Rule.max(300),
        }),
        defineField({
            name: "seoDescription",
            title: "Site Search Description",
            type: "text",
            rows: 3,
            group: "identity",
            description:
                "A concise description for search results and social sharing. Uses your Introduction when empty.",
            validation: (Rule) => Rule.max(200),
        }),
        defineField({
            name: "featuredPost",
            title: "Featured Homepage Post",
            type: "reference",
            group: "writing",
            to: [{ type: "post" }],
            description:
                "Choose the homepage's Start here article. Until it is published, or when no post is selected, the newest published post is shown.",
        }),
        defineField({
            name: "bio",
            title: "Biography",
            type: "text",
            rows: 12,
            group: "about",
            description:
                "Plain-text biography. Use blank lines to separate paragraphs.",
            validation: (Rule) => Rule.required().max(5000),
        }),
        defineField({
            name: "location",
            title: "Location",
            type: "string",
            group: "about",
            validation: (Rule) => Rule.max(120),
        }),
        defineField({
            name: "portrait",
            title: "Portrait",
            type: "image",
            group: ["identity", "about"],
            options: { hotspot: true },
            fields: [
                defineField({
                    name: "alt",
                    title: "Alt Text",
                    type: "string",
                    validation: (Rule) => Rule.required(),
                }),
            ],
        }),
        defineField({
            name: "resume",
            title: "Resume PDF",
            type: "file",
            group: "portfolio",
            options: { accept: ".pdf" },
            description:
                "The source file for the résumé viewer and download links. Changes to profile text do not edit this PDF; upload a revised file when needed.",
        }),
        defineField({
            name: "resumeNote",
            title: "Résumé Note",
            type: "text",
            rows: 3,
            group: "portfolio",
            description:
                "Optional context shown above the résumé, such as what version it is or which opportunities it covers.",
            validation: (Rule) => Rule.max(400),
        }),
        defineField({
            name: "socialLinks",
            title: "Profile Links",
            type: "array",
            group: "about",
            of: [defineArrayMember({ type: "externalLink" })],
            validation: (Rule) => Rule.unique(),
        }),
        defineField({
            name: "currentCuriosities",
            title: "Right Now",
            type: "array",
            group: "now",
            description:
                "Optional things you are reading, learning, making, or thinking about. Shown on About; the section is hidden when empty.",
            of: [defineArrayMember({ type: "curiosity" })],
            validation: (Rule) => Rule.max(6),
        }),
        defineField({
            name: "curiositiesUpdatedAt",
            title: "Right Now Updated At",
            type: "datetime",
            group: "now",
            description:
                "Update this when the Right Now list materially changes.",
            hidden: ({ document }) =>
                !Array.isArray(document?.currentCuriosities) ||
                document.currentCuriosities.length === 0,
            validation: (Rule) =>
                Rule.custom((value, context) => {
                    const curiosities = context.document?.currentCuriosities;
                    return Array.isArray(curiosities) &&
                        curiosities.length > 0 &&
                        !value
                        ? "Add the date when these items were last updated."
                        : true;
                }),
        }),
        defineField({
            name: "timeline",
            title: "Experience and Education",
            type: "array",
            group: "portfolio",
            of: [defineArrayMember({ type: "timelineEntry" })],
        }),
        defineField({
            name: "skillGroups",
            title: "Skill Groups",
            type: "array",
            group: "portfolio",
            of: [defineArrayMember({ type: "skillGroup" })],
        }),
        defineField({
            name: "credentials",
            title: "Credentials",
            type: "array",
            group: "portfolio",
            of: [defineArrayMember({ type: "credential" })],
        }),
    ],
    preview: {
        select: { title: "name", subtitle: "headline", media: "portrait" },
    },
});
