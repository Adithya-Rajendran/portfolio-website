import { defineField, defineType } from "sanity";

export default defineType({
    name: "skillCategory",
    title: "Skill Category",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            description: 'e.g. "Coding Skills", "Cybersecurity Skills"',
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "slug",
            title: "Slug",
            type: "slug",
            options: {
                source: "title",
                maxLength: 96,
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "skills",
            title: "Skills",
            type: "array",
            of: [{ type: "string" }],
            validation: (Rule) => Rule.required().min(1),
        }),
        defineField({
            name: "colorVariant",
            title: "Color Variant",
            type: "string",
            options: {
                list: [
                    { title: "Emerald (green)", value: "emerald" },
                    { title: "Cyan (blue)", value: "cyan" },
                    { title: "Violet (purple)", value: "violet" },
                ],
                layout: "radio",
            },
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
            subtitle: "colorVariant",
        },
        prepare({ title, subtitle }) {
            return {
                title,
                subtitle: `Color: ${subtitle}`,
            };
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
