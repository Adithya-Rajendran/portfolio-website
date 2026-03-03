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
                    styles: [
                        { title: "Normal", value: "normal" },
                    ],
                    marks: {
                        decorators: [
                            { title: "Bold", value: "strong" },
                            { title: "Italic", value: "em" },
                            { title: "Highlight (Emerald)", value: "highlightEmerald" },
                            { title: "Highlight (Teal)", value: "highlightTeal" },
                            { title: "Highlight (Orange)", value: "highlightOrange" },
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
            title: "Homepage Subtitle",
            description: "e.g. Cloud Field Engineer / Cybersecurity Enthusiast / Builder",
            type: "string",
        }),
        defineField({
            name: "homeBio",
            title: "Homepage Bio",
            type: "array",
            of: [
                {
                    type: "block",
                    styles: [
                        { title: "Normal", value: "normal" },
                    ],
                    marks: {
                        decorators: [
                            { title: "Bold", value: "strong" },
                            { title: "Italic", value: "em" },
                            { title: "Highlight (Emerald)", value: "highlightEmerald" },
                            { title: "Highlight (Teal)", value: "highlightTeal" },
                            { title: "Highlight (Orange)", value: "highlightOrange" },
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
