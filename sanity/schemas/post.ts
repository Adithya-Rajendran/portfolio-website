import { defineArrayMember, defineField, defineType } from "sanity";
import { listValuesOnly } from "@/lib/profile-fields";
import { checkRevisedAt, IMAGE_KINDS } from "@/lib/project-fields";
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
            name: "revisedAt",
            title: "Revised At",
            type: "date",
            group: "editorial",
            description:
                "Optional. The date of the last substantive revision, shown as “Updated” in the post header and given to search engines. Leave empty for typo fixes.",
            validation: (Rule) =>
                Rule.custom((value: string | undefined, context) =>
                    checkRevisedAt(
                        (context.document as { publishedAt?: string })
                            ?.publishedAt,
                        value,
                    ),
                ),
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
            name: "cover",
            title: "Cover",
            type: "image",
            group: "editorial",
            description:
                "Optional. The lead image of the post, on its Flight Log card and in its sharing image. Posts without one get a text-only layout.",
            options: { hotspot: true },
            fields: [
                defineField({
                    name: "alt",
                    title: "Alt Text",
                    type: "string",
                    validation: (Rule) => Rule.required(),
                }),
                defineField({
                    name: "caption",
                    title: "Caption",
                    type: "string",
                    validation: (Rule) => Rule.max(220),
                }),
                defineField({
                    name: "credit",
                    title: "Credit",
                    type: "string",
                    description:
                        "Who made the image, or its source and licence.",
                    validation: (Rule) => Rule.max(120),
                }),
                defineField({
                    name: "kind",
                    title: "Kind",
                    type: "string",
                    description:
                        "Photographs are numbered as plates, diagrams, plots and screenshots as figures.",
                    options: { list: [...IMAGE_KINDS], layout: "radio" },
                    validation: listValuesOnly,
                }),
            ],
        }),
        defineField({
            name: "projects",
            title: "Related Projects",
            type: "array",
            group: "editorial",
            description:
                "Optional. Up to three projects this post is about. The post shows them as mission links, and each project lists the post among its Flight Log entries.",
            of: [
                defineArrayMember({
                    type: "reference",
                    to: [{ type: "project" }],
                    weak: true,
                }),
            ],
            validation: (Rule) => Rule.unique().max(3),
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
