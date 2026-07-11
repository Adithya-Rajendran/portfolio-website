import { defineArrayMember, defineField, defineType } from "sanity";
import { TAG_PATTERN } from "@/lib/tags";

export default defineType({
    name: "post",
    title: "Blog Post",
    type: "document",
    groups: [
        { name: "editorial", title: "Editorial", default: true },
        { name: "content", title: "Content" },
    ],
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            group: "editorial",
            validation: (Rule) => Rule.required().max(120),
        }),
        defineField({
            name: "slug",
            title: "Slug",
            type: "slug",
            group: "editorial",
            options: { source: "title", maxLength: 96 },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "description",
            title: "Description",
            type: "text",
            rows: 3,
            group: "editorial",
            validation: (Rule) => Rule.required().max(300),
        }),
        defineField({
            name: "publishedAt",
            title: "Published At",
            type: "date",
            group: "editorial",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "tags",
            title: "Tags",
            type: "array",
            group: "editorial",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required(),
                }),
            ],
            options: { layout: "tags" },
            description:
                "Optional lowercase, hyphen-separated labels used by the tag archive.",
            validation: (Rule) =>
                Rule.unique().custom((tags?: string[]) => {
                    if (!tags) return true;
                    const invalid = tags.filter((tag) =>
                        TAG_PATTERN.test(tag) ? false : true,
                    );
                    return invalid.length === 0
                        ? true
                        : `Invalid tag(s): ${invalid.join(", ")} — use lowercase letters, digits, and hyphens only`;
                }),
        }),
        defineField({
            name: "body",
            title: "Body",
            type: "contentBody",
            group: "content",
            validation: (Rule) => Rule.required().min(1),
        }),
    ],
    preview: {
        select: {
            title: "title",
            publishedAt: "publishedAt",
        },
        prepare({ title, publishedAt }) {
            return { title, subtitle: publishedAt };
        },
    },
    orderings: [
        {
            title: "Published, Newest",
            name: "publishedAtDesc",
            by: [{ field: "publishedAt", direction: "desc" }],
        },
    ],
});
