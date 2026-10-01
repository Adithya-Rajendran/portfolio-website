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
            description:
                "A web address (https://…) or a path on this site (/blog/…). Email links are not accepted: the site publishes no email address, and contact goes through the form.",
            validation: (Rule) =>
                Rule.required().uri({
                    allowRelative: true,
                    scheme: ["http", "https"],
                }),
        }),
    ],
});
