import { defineField, defineType } from "sanity";

export default defineType({
    name: "project",
    title: "Project",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "description",
            title: "Description",
            type: "text",
            rows: 4,
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "tags",
            title: "Tags",
            type: "array",
            of: [{ type: "string" }],
            validation: (Rule) => Rule.required().min(1),
        }),
        defineField({
            name: "image",
            title: "Screenshot",
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
            name: "linkTitle",
            title: "Link Title",
            type: "string",
            description: 'e.g. "Source Code" or "Live Demo"',
        }),
        defineField({
            name: "linkUrl",
            title: "Link URL",
            type: "url",
            validation: (Rule) =>
                Rule.uri({
                    allowRelative: true,
                    scheme: ["http", "https"],
                }),
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
            media: "image",
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
