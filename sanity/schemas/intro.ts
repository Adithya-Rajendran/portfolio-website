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
    ],
    preview: {
        prepare() {
            return {
                title: "Intro Section",
            };
        },
    },
});
