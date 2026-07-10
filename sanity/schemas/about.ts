import { defineField, defineType } from "sanity";

export default defineType({
    name: "about",
    title: "About",
    type: "document",
    fields: [
        defineField({
            name: "positioning",
            title: "Positioning Statement",
            type: "text",
            rows: 3,
            description:
                "One-or-two sentence hero statement shown under the name " +
                "on /about. Falls back to the Intro's hero description " +
                "when empty.",
        }),
        defineField({
            name: "portrait",
            title: "Portrait",
            type: "image",
            options: { hotspot: true },
            description:
                "Portrait shown in the /about hero. Falls back to the " +
                "bundled hero image when empty.",
            fields: [
                defineField({
                    name: "alt",
                    title: "Alt Text",
                    type: "string",
                }),
            ],
        }),
        defineField({
            name: "location",
            title: "Location",
            type: "string",
            description:
                'Short location line, e.g. "Remote · United States". ' +
                "Shown in the /about facts rail.",
        }),
        defineField({
            name: "body",
            title: "About Content",
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
    ],
    preview: {
        prepare() {
            return {
                title: "About Section",
            };
        },
    },
});
