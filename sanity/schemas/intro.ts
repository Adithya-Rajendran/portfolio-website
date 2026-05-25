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
