import { defineField, defineType } from "sanity";
import { FOOTNOTE_MAX } from "@/lib/post-fields";

/**
 * A footnote on a passage of text (an annotation, like a link). The site
 * numbers footnotes in reading order: each prints as a raised number after
 * the passage, beside the text in the margin on wide screens, and in the
 * numbered notes at the end of the post and in the RSS feed.
 */
export default defineType({
    name: "footnote",
    title: "Footnote",
    type: "object",
    // The toolbar button: a raised "1", so it reads apart from the link.
    icon: () => "¹",
    fields: [
        defineField({
            name: "text",
            title: "Note",
            type: "text",
            rows: 3,
            description:
                "Shown beside the text on wide screens and in the numbered notes at the end of the post.",
            validation: (Rule) => Rule.required().max(FOOTNOTE_MAX),
        }),
    ],
});
