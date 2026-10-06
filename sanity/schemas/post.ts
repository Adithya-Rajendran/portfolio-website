import { defineArrayMember, defineField, defineType } from "sanity";
import {
    CHANGE_KINDS,
    CHANGE_NOTE_MAX,
    checkChangeDate,
} from "@/lib/post-fields";
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
            name: "changelog",
            title: "Changelog",
            type: "array",
            group: "editorial",
            description:
                "Optional. Dated updates and corrections, listed at the end of the post (and in the RSS feed) with a revision mark. Add one only for a real change a reader should know about.",
            of: [
                defineArrayMember({
                    type: "object",
                    name: "postChange",
                    title: "Change",
                    fields: [
                        defineField({
                            name: "date",
                            title: "Date",
                            type: "date",
                            validation: (Rule) =>
                                Rule.required().custom(
                                    (value: string | undefined, context) =>
                                        checkChangeDate(
                                            (
                                                context.document as {
                                                    publishedAt?: string;
                                                }
                                            )?.publishedAt,
                                            value,
                                        ),
                                ),
                        }),
                        defineField({
                            name: "kind",
                            title: "Kind",
                            type: "string",
                            description:
                                "A correction fixes something the post got wrong; an update adds or changes content.",
                            initialValue: "update",
                            options: {
                                list: [...CHANGE_KINDS],
                                layout: "radio",
                            },
                            validation: (Rule) => Rule.required(),
                        }),
                        defineField({
                            name: "note",
                            title: "Note",
                            type: "text",
                            rows: 3,
                            description: "What changed, in a sentence or two.",
                            validation: (Rule) =>
                                Rule.required().max(CHANGE_NOTE_MAX),
                        }),
                    ],
                    preview: {
                        select: { date: "date", kind: "kind", note: "note" },
                        prepare({ date, kind, note }) {
                            return {
                                title: note,
                                subtitle: [date, kind]
                                    .filter(Boolean)
                                    .join(" · "),
                            };
                        },
                    },
                }),
            ],
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
                "Optional. The lead image of the post, shown after its first paragraph and given to search engines as the post's image. Lists and the sharing image do not show it.",
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
                        "Photographs are toned to the theme; diagrams, plots and screenshots are shown as drawn. No image is numbered.",
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
                "Optional. Up to three projects this post is about. The post shows them as project rows under Related projects after its text, and each project's page links the post, as its write-up or under Related writing.",
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
