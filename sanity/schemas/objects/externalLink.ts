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
                "Optional. What the link points to. On a project, Repository puts the link in the page's head, beside Read the write-up. A project's write-up is its first link, of any kind, to one of this site's posts (else the oldest post that names the project); Article only puts a link ahead of the others for that choice. The other kinds change nothing on the site; a profile link is recognised by its address.",
            options: { list: [...LINK_KINDS] },
            validation: listValuesOnly,
        }),
    ],
    preview: {
        select: { title: "label", subtitle: "url" },
    },
});
