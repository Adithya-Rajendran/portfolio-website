import { defineField, defineType } from "sanity";

export default defineType({
    name: "experience",
    title: "Experience",
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
            name: "location",
            title: "Location",
            type: "string",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "description",
            title: "Description Bullets",
            type: "array",
            of: [{ type: "string" }],
            validation: (Rule) => Rule.required().min(1),
        }),
        defineField({
            name: "icon",
            title: "Icon",
            type: "image",
            description: "Small icon image displayed in the timeline",
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
        }),
        defineField({
            name: "date",
            title: "Date",
            type: "string",
            description: 'Display date, e.g. "May 2024 - Present"',
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
            media: "icon",
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
