import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
    name: "timelineEntry",
    title: "Timeline Entry",
    type: "object",
    groups: [
        { name: "role", title: "Role", default: true },
        { name: "details", title: "Details" },
    ],
    fields: [
        defineField({
            name: "kind",
            title: "Kind",
            type: "string",
            group: "role",
            options: {
                list: [
                    { title: "Work", value: "work" },
                    { title: "Education", value: "education" },
                ],
                layout: "radio",
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            group: "role",
            validation: (Rule) => Rule.required().max(120),
        }),
        defineField({
            name: "organization",
            title: "Organization",
            type: "string",
            group: "role",
            validation: (Rule) => Rule.required().max(120),
        }),
        defineField({
            name: "location",
            title: "Location",
            type: "string",
            group: "role",
            validation: (Rule) => Rule.max(120),
        }),
        defineField({
            name: "startDate",
            title: "Start Date",
            type: "date",
            group: "role",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "endDate",
            title: "End Date",
            type: "date",
            group: "role",
            description: "Leave empty for a current role.",
            validation: (Rule) => Rule.min(Rule.valueOfField("startDate")),
        }),
        defineField({
            name: "summary",
            title: "Summary",
            type: "text",
            rows: 3,
            group: "details",
            validation: (Rule) => Rule.max(400),
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
            validation: (Rule) => Rule.unique(),
        }),
        defineField({
            name: "skills",
            title: "Skills",
            type: "array",
            group: "details",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(80),
                }),
            ],
            options: { layout: "tags" },
            validation: (Rule) => Rule.unique(),
        }),
        defineField({
            name: "logo",
            title: "Organization Mark",
            type: "image",
            group: "details",
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
    ],
    preview: {
        select: {
            title: "title",
            organization: "organization",
            kind: "kind",
            media: "logo",
        },
        prepare({ title, organization, kind, media }) {
            return {
                title,
                subtitle: [kind, organization].filter(Boolean).join(" · "),
                media,
            };
        },
    },
});
