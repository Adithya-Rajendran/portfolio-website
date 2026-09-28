import { defineField, defineType } from "sanity";
import { CURIOSITY_KINDS, listValuesOnly } from "@/lib/profile-fields";

export default defineType({
    name: "curiosity",
    title: "Right Now Item",
    type: "object",
    fields: [
        defineField({
            name: "kind",
            title: "Kind",
            type: "string",
            description:
                "Groups the item in the Now list on About. Items without a kind are shown as questions.",
            options: { list: [...CURIOSITY_KINDS], layout: "radio" },
            initialValue: "question",
            validation: listValuesOnly,
        }),
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            description:
                'For example, "Reading", "Learning", or a project name.',
            validation: (Rule) => Rule.required().max(80),
        }),
        defineField({
            name: "note",
            title: "Note",
            type: "text",
            rows: 2,
            validation: (Rule) => Rule.max(220),
        }),
        defineField({
            name: "url",
            title: "Optional Link",
            type: "url",
            validation: (Rule) => Rule.uri({ scheme: ["http", "https"] }),
        }),
        defineField({
            name: "project",
            title: "Related Project",
            type: "reference",
            to: [{ type: "project" }],
            weak: true,
            description:
                "Optional. Links this item to one of your projects in the Now list.",
        }),
        defineField({
            name: "post",
            title: "Related Post",
            type: "reference",
            to: [{ type: "post" }],
            weak: true,
            description:
                "Optional. Links this item to one of your posts in the Now list.",
        }),
    ],
    preview: {
        select: { title: "title", subtitle: "note" },
    },
});
