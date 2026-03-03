import { defineField, defineType } from "sanity";

export default defineType({
    name: "certification",
    title: "Certification",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "org",
            title: "Organization",
            type: "string",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "startDate",
            title: "Start Date",
            type: "string",
            description: 'e.g. "September 2023"',
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "endDate",
            title: "End Date",
            type: "string",
            description: 'e.g. "September 2026" or leave empty for no expiry',
        }),
        defineField({
            name: "badge",
            title: "Badge Image",
            type: "image",
            options: {
                hotspot: true,
            },
            fields: [
                defineField({
                    name: "alt",
                    title: "Alt Text",
                    type: "string",
                }),
            ],
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "verifyUrl",
            title: "Verification URL",
            type: "url",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "order",
            title: "Sort Order",
            type: "number",
            description: "Lower numbers appear first",
            validation: (Rule) => Rule.required(),
        }),
    ],
    preview: {
        select: {
            title: "title",
            subtitle: "org",
            media: "badge",
        },
    },
    orderings: [
        {
            title: "Sort Order",
            name: "orderAsc",
            by: [{ field: "order", direction: "asc" }],
        },
    ],
});
