import { defineField, defineType } from "sanity";

export default defineType({
    name: "curiosity",
    title: "Right Now Item",
    type: "object",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            description:
                'For example, "Reading", "Learning", or a project name.',
            validation: (Rule) => Rule.required().max(80),
        }),
        defineField({
            name: "note",
            title: "Note",
            type: "text",
            rows: 2,
            validation: (Rule) => Rule.max(220),
        }),
        defineField({
            name: "url",
            title: "Optional Link",
            type: "url",
            validation: (Rule) => Rule.uri({ scheme: ["http", "https"] }),
        }),
    ],
    preview: {
        select: { title: "title", subtitle: "note" },
    },
});
