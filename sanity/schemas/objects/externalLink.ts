import { defineField, defineType } from "sanity";

export default defineType({
    name: "externalLink",
    title: "External Link",
    type: "object",
    fields: [
        defineField({
            name: "label",
            title: "Label",
            type: "string",
            validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
            name: "url",
            title: "URL",
            type: "url",
            validation: (Rule) =>
                Rule.required().uri({ scheme: ["http", "https"] }),
        }),
    ],
    preview: {
        select: { title: "label", subtitle: "url" },
    },
});
