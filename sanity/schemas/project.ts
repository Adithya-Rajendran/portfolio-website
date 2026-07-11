import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
    name: "project",
    title: "Project",
    type: "document",
    groups: [
        { name: "editorial", title: "Editorial", default: true },
        { name: "details", title: "Details" },
        { name: "content", title: "Project Essay" },
    ],
    initialValue: { status: "active" },
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            group: "editorial",
            validation: (Rule) => Rule.required().max(100),
        }),
        defineField({
            name: "slug",
            title: "Slug",
            type: "slug",
            group: "editorial",
            options: { source: "title", maxLength: 96 },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "summary",
            title: "Summary",
            type: "text",
            rows: 3,
            group: "editorial",
            validation: (Rule) => Rule.required().max(300),
        }),
        defineField({
            name: "status",
            title: "Status",
            type: "string",
            group: "details",
            options: {
                list: [
                    { title: "Active", value: "active" },
                    { title: "Completed", value: "completed" },
                    { title: "Paused", value: "paused" },
                    { title: "Archived", value: "archived" },
                ],
                layout: "radio",
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "startDate",
            title: "Start Date",
            type: "date",
            group: "details",
        }),
        defineField({
            name: "endDate",
            title: "End Date",
            type: "date",
            group: "details",
            description: "Leave empty for active work.",
            validation: (Rule) => Rule.min(Rule.valueOfField("startDate")),
        }),
        defineField({
            name: "technologies",
            title: "Technologies",
            type: "array",
            group: "details",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(80),
                }),
            ],
            options: { layout: "tags" },
            validation: (Rule) => Rule.required().min(1).unique(),
        }),
        defineField({
            name: "highlights",
            title: "Highlights",
            type: "array",
            group: "details",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(300),
                }),
            ],
            validation: (Rule) => Rule.required().min(1).unique(),
        }),
        defineField({
            name: "cover",
            title: "Cover Image",
            type: "image",
            group: "editorial",
            options: { hotspot: true },
            fields: [
                defineField({
                    name: "alt",
                    title: "Alt Text",
                    type: "string",
                    validation: (Rule) => Rule.required(),
                }),
                defineField({
                    name: "caption",
                    title: "Caption",
                    type: "string",
                    validation: (Rule) => Rule.max(220),
                }),
            ],
        }),
        defineField({
            name: "links",
            title: "Links",
            type: "array",
            group: "details",
            of: [defineArrayMember({ type: "externalLink" })],
            validation: (Rule) => Rule.unique().max(6),
        }),
        defineField({
            name: "body",
            title: "Project Essay",
            type: "contentBody",
            group: "content",
            validation: (Rule) => Rule.required().min(1),
        }),
    ],
    preview: {
        select: {
            title: "title",
            summary: "summary",
            status: "status",
            media: "cover",
        },
        prepare({ title, summary, status, media }) {
            return {
                title,
                subtitle: [status, summary].filter(Boolean).join(" · "),
                media,
            };
        },
    },
    orderings: [
        {
            title: "Started, Newest",
            name: "startDateDesc",
            by: [{ field: "startDate", direction: "desc" }],
        },
        {
            title: "Title",
            name: "titleAsc",
            by: [{ field: "title", direction: "asc" }],
        },
    ],
});
