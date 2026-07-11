import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
    name: "callout",
    title: "Callout",
    type: "object",
    fields: [
        defineField({
            name: "tone",
            title: "Tone",
            type: "string",
            initialValue: "note",
            options: {
                list: [
                    { title: "Note", value: "note" },
                    { title: "Tip", value: "tip" },
                    { title: "Warning", value: "warning" },
                ],
                layout: "radio",
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.max(100),
        }),
        defineField({
            name: "body",
            title: "Body",
            type: "array",
            of: [
                defineArrayMember({
                    type: "block",
                    styles: [{ title: "Normal", value: "normal" }],
                    lists: [],
                    marks: {
                        decorators: [
                            { title: "Bold", value: "strong" },
                            { title: "Italic", value: "em" },
                            { title: "Code", value: "code" },
                        ],
                        annotations: [
                            defineArrayMember({ type: "contentLink" }),
                        ],
                    },
                }),
            ],
            validation: (Rule) => Rule.required().min(1),
        }),
    ],
    preview: {
        select: { title: "title", tone: "tone" },
        prepare({ title, tone }) {
            return { title: title || "Callout", subtitle: tone };
        },
    },
});
