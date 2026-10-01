import { defineArrayMember, defineField, defineType } from "sanity";
import {
    checkTimelineRange,
    EMPLOYMENT_TYPES,
    TIMELINE_DATE_PRECISIONS,
    listValuesOnly,
} from "@/lib/profile-fields";

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
            name: "orgShort",
            title: "Short Organization Name",
            type: "string",
            group: "role",
            description:
                "The world's name in the Timeline flight, for example UCSC or Canonical.",
            validation: (Rule) => Rule.max(16),
        }),
        defineField({
            name: "orgUrl",
            title: "Organization Website",
            type: "url",
            group: "role",
            description: "Optional. Links the organization name on the CV.",
            validation: (Rule) => Rule.uri({ scheme: ["http", "https"] }),
        }),
        defineField({
            name: "employment",
            title: "Employment Type",
            type: "string",
            group: "role",
            description:
                "Shown on the CV. An internship is flown as a short flyby in the Timeline.",
            options: { list: [...EMPLOYMENT_TYPES] },
            validation: listValuesOnly,
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
                "Optional when the start date is unknown. Only the month and year are displayed, or only the year when Start Date Precision is Year only.",
        }),
        defineField({
            name: "startPrecision",
            title: "Start Date Precision",
            type: "string",
            group: "role",
            description:
                "Choose Year only when you know the year but not the month (enter any day in that year). The site then prints and plots the year alone. Empty means month and year.",
            options: { list: [...TIMELINE_DATE_PRECISIONS], layout: "radio" },
            hidden: ({ parent }) => !parent?.startDate,
            validation: listValuesOnly,
        }),
        defineField({
            name: "endDate",
            title: "End Date",
            type: "date",
            group: "role",
            description:
                "The actual end date, not an expected graduation date. Only the month and year are displayed, or only the year when End Date Precision is Year only.",
            validation: (Rule) => [
                Rule.min(Rule.valueOfField("startDate")),
                Rule.custom((endDate, context) =>
                    checkTimelineRange(
                        (context.parent as { startDate?: string } | undefined)
                            ?.startDate,
                        endDate as string | undefined,
                    ),
                ).warning(),
            ],
        }),
        defineField({
            name: "endPrecision",
            title: "End Date Precision",
            type: "string",
            group: "role",
            description:
                "Choose Year only when you know the year but not the month (enter any day in that year). The site then prints and plots the year alone. Empty means month and year.",
            options: { list: [...TIMELINE_DATE_PRECISIONS], layout: "radio" },
            hidden: ({ parent }) => !parent?.endDate,
            validation: listValuesOnly,
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
            name: "burn",
            title: "Change of Direction",
            type: "object",
            group: "details",
            description:
                "Optional. The turn this entry began, named on the transfer into it in the Timeline.",
            fields: [
                defineField({
                    name: "label",
                    title: "Label",
                    type: "string",
                    description: "For example, Security → Cloud.",
                    validation: (Rule) => Rule.required().max(32),
                }),
                defineField({
                    name: "note",
                    title: "Note",
                    type: "string",
                    validation: (Rule) => Rule.max(140),
                }),
            ],
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
