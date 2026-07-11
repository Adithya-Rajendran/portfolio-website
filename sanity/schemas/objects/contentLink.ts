import { defineField, defineType } from "sanity";

export default defineType({
    name: "contentLink",
    title: "Link",
    type: "object",
    fields: [
        defineField({
            name: "href",
            title: "URL",
            type: "url",
            validation: (Rule) =>
                Rule.required().uri({
                    allowRelative: true,
                    scheme: ["http", "https", "mailto"],
                }),
        }),
    ],
});
