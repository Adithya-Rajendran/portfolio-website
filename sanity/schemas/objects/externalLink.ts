import { defineField, defineType } from "sanity";
import { LINK_KINDS, listValuesOnly } from "@/lib/profile-fields";

export default defineType({
    name: "externalLink",
    title: "External Link",
    type: "object",
    fields: [
        defineField({
            name: "label",
            title: "Label",
            type: "string",
            validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
            name: "url",
            title: "URL",
            type: "url",
            validation: (Rule) =>
                Rule.required().uri({ scheme: ["http", "https"] }),
        }),
        defineField({
            name: "kind",
            title: "Kind",
            type: "string",
            description:
                "Optional. What the link points to: it picks the link's icon, decides which links print on the CV, and marks a repository as source code for search engines.",
            options: { list: [...LINK_KINDS] },
            validation: listValuesOnly,
        }),
    ],
    preview: {
        select: { title: "label", subtitle: "url" },
    },
});
