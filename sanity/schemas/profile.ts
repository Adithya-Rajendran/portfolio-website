import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
    name: "profile",
    title: "Profile",
    type: "document",
    groups: [
        { name: "identity", title: "Identity", default: true },
        { name: "about", title: "About" },
        { name: "now", title: "Right Now" },
        { name: "portfolio", title: "Portfolio" },
    ],
    initialValue: {
        name: "Adithya Rajendran",
        headline: "Cloud Field Engineer @ Canonical",
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
                "The short comment-style role line used on the homepage.",
            validation: (Rule) => Rule.required().max(140),
        }),
        defineField({
            name: "introduction",
            title: "Introduction",
            type: "text",
            rows: 4,
            group: "identity",
            description:
                "A short personal introduction for the homepage and portfolio.",
            validation: (Rule) => Rule.required().max(500),
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
                "Optional things you are reading, learning, making, or thinking about. The homepage hides this section when empty.",
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
