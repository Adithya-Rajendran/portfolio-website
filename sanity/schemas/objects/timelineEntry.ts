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
            name: "isCurrent",
            title: "Currently Here",
            type: "boolean",
            group: "role",
            description:
                "Whether this work or study is ongoing. Turn off for a former role, even if its exact end date is unknown. Older entries without this setting use the end date.",
        }),
        defineField({
            name: "startDate",
            title: "Start Date",
            type: "date",
            group: "role",
            description:
                "Optional when the start date is unknown. Only the month and year are displayed.",
        }),
        defineField({
            name: "endDate",
            title: "End Date",
            type: "date",
            group: "role",
            description:
                "The actual end date, not an expected graduation date. Only the month and year are displayed.",
            validation: (Rule) => Rule.min(Rule.valueOfField("startDate")),
        }),
        defineField({
            name: "expectedEndYear",
            title: "Expected Graduation Year",
            type: "number",
            group: "role",
            description:
                "For ongoing studies when only the expected year is known. This does not mark the degree as completed.",
            hidden: ({ parent }) => parent?.kind !== "education",
            validation: (Rule) => Rule.integer().min(1900).max(2200),
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
