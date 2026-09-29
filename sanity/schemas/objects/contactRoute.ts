import { defineField, defineType } from "sanity";

/**
 * The words of one contact route (Profile → Site copy → Contact Routes):
 * its title and what to include in a message on that topic. The topics
 * themselves, and when each route shows, are fixed in lib/contact.ts.
 */
export default defineType({
    name: "contactRoute",
    title: "Contact Route",
    type: "object",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            description:
                "The route's heading on Contact, and its topic in the form. Leave blank to use the topic's name.",
            validation: (Rule) => Rule.max(60),
        }),
        defineField({
            name: "prompt",
            title: "Prompt",
            type: "text",
            rows: 2,
            description:
                "What to include in a message on this topic. Shown under the route on Contact, and in the empty message field once the topic is chosen. Leave blank for no prompt.",
            validation: (Rule) => Rule.max(200),
        }),
    ],
    preview: {
        select: { title: "title", subtitle: "prompt" },
    },
});
