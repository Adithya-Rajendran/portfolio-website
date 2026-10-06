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
                "Optional. What the link points to. On a project, Repository puts the link in the page's head, beside Read the write-up, and Article on a link to one of this site's posts makes that post the project's write-up. The other kinds change nothing on the site; a profile link is recognised by its address.",
            options: { list: [...LINK_KINDS] },
            validation: listValuesOnly,
        }),
    ],
    preview: {
        select: { title: "label", subtitle: "url" },
    },
});
