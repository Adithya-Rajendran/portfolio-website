import { defineField, defineType } from "sanity";

export default defineType({
    name: "mediaEmbed",
    title: "Media or Link Embed",
    type: "object",
    description:
        "YouTube and Vimeo URLs render as video. Other HTTPS URLs render as safe link cards.",
    fields: [
        defineField({
            name: "url",
            title: "URL",
            type: "url",
            description:
                "Paste a YouTube, Vimeo, or normal web URL. Raw HTML is never accepted.",
            validation: (Rule) =>
                Rule.required().uri({ scheme: ["http", "https"] }),
        }),
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.max(120),
        }),
        defineField({
            name: "caption",
            title: "Caption",
            type: "text",
            rows: 2,
            validation: (Rule) => Rule.max(260),
        }),
    ],
    preview: {
        select: { title: "title", subtitle: "url" },
        prepare({ title, subtitle }) {
            return { title: title || "Embedded link", subtitle };
        },
    },
});
