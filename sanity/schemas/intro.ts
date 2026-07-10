import { defineField, defineType } from "sanity";

export default defineType({
    name: "intro",
    title: "Intro",
    type: "document",
    fields: [
        defineField({
            name: "body",
            title: "Intro Content",
            type: "array",
            of: [
                {
                    type: "block",
                    styles: [{ title: "Normal", value: "normal" }],
                    marks: {
                        decorators: [
                            { title: "Bold", value: "strong" },
                            { title: "Italic", value: "em" },
                            {
                                title: "Highlight (Emerald)",
                                value: "highlightEmerald",
                            },
                            {
                                title: "Highlight (Teal)",
                                value: "highlightTeal",
                            },
                            {
                                title: "Highlight (Orange)",
                                value: "highlightOrange",
                            },
                        ],
                        annotations: [
                            {
                                title: "URL",
                                name: "link",
                                type: "object",
                                fields: [
                                    {
                                        title: "URL",
                                        name: "href",
                                        type: "url",
                                    },
                                ],
                            },
                        ],
                    },
                },
            ],
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "resume",
            title: "Resume PDF",
            type: "file",
            options: {
                accept: ".pdf",
            },
        }),
        defineField({
            name: "subtitle",
            title: "Hero Subtitle",
            description:
                "Gradient subtitle under the title on the homepage and portfolio hero. e.g. Cloud Field Engineer @ Canonical",
            type: "string",
        }),
        defineField({
            name: "heroDescription",
            title: "Hero Description",
            description:
                "Paragraph shown below the title on the homepage hero.",
            type: "text",
            rows: 4,
        }),
        defineField({
            name: "role",
            title: "Identity Line (structured data)",
            description:
                'Machine-readable identity, "<title> @ <organization>" ' +
                '(e.g. "MS Student @ Example University"). Feeds the Person ' +
                "schema; the hardcoded site config is the fallback when empty.",
            type: "string",
        }),
        defineField({
            name: "affiliation",
            title: "Primary Affiliation (structured data)",
            description:
                "Feeds Person structured data: worksFor for an employer, " +
                "member/alumniOf for a school.",
            type: "object",
            fields: [
                defineField({
                    name: "name",
                    title: "Organization",
                    type: "string",
                }),
                defineField({ name: "url", title: "URL", type: "url" }),
                defineField({
                    name: "kind",
                    title: "Kind",
                    type: "string",
                    options: {
                        list: [
                            { title: "Employer", value: "work" },
                            { title: "School", value: "school" },
                        ],
                        layout: "radio",
                    },
                }),
            ],
        }),
        defineField({
            name: "knowsAbout",
            title: "Knows About (structured data)",
            description:
                "Topics for the Person schema — search-identity signal. " +
                "Falls back to the built-in list when empty.",
            type: "array",
            of: [{ type: "string" }],
            options: { layout: "tags" },
        }),
        defineField({
            name: "education",
            title: "Education (structured data)",
            description: "Institutions for the Person schema's alumniOf.",
            type: "array",
            of: [
                {
                    type: "object",
                    fields: [
                        defineField({
                            name: "name",
                            title: "Institution",
                            type: "string",
                        }),
                        defineField({
                            name: "url",
                            title: "URL",
                            type: "url",
                        }),
                    ],
                },
            ],
        }),
        defineField({
            name: "available",
            title: "Available for Work",
            description:
                'Show the "Available for opportunities" pill on the homepage hero.',
            type: "boolean",
            initialValue: true,
        }),
        defineField({
            name: "homeBio",
            title: "Homepage Bio",
            type: "array",
            of: [
                {
                    type: "block",
                    styles: [{ title: "Normal", value: "normal" }],
                    marks: {
                        decorators: [
                            { title: "Bold", value: "strong" },
                            { title: "Italic", value: "em" },
                            {
                                title: "Highlight (Emerald)",
                                value: "highlightEmerald",
                            },
                            {
                                title: "Highlight (Teal)",
                                value: "highlightTeal",
                            },
                            {
                                title: "Highlight (Orange)",
                                value: "highlightOrange",
                            },
                        ],
                        annotations: [
                            {
                                title: "URL",
                                name: "link",
                                type: "object",
                                fields: [
                                    {
                                        title: "URL",
                                        name: "href",
                                        type: "url",
                                    },
                                ],
                            },
                        ],
                    },
                },
            ],
        }),
    ],
    preview: {
        prepare() {
            return {
                title: "Intro Section",
            };
        },
    },
});
