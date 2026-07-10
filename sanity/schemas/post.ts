import { defineField, defineType } from "sanity";
import { TAG_PATTERN } from "@/lib/tags";

export default defineType({
    name: "post",
    title: "Blog Post",
    type: "document",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "slug",
            title: "Slug",
            type: "slug",
            options: {
                source: "title",
                maxLength: 96,
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "description",
            title: "Description",
            type: "text",
            rows: 3,
            validation: (Rule) => Rule.required().max(300),
        }),
        defineField({
            name: "date",
            title: "Publish Date",
            type: "date",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "featured",
            title: "Featured Post",
            type: "boolean",
            initialValue: false,
        }),
        defineField({
            name: "tags",
            title: "Tags",
            type: "array",
            of: [{ type: "string" }],
            options: { layout: "tags" },
            description:
                "Lowercase, hyphen-separated (e.g. kubernetes, ai-infra). " +
                "The tag value doubles as its URL segment: /blogs/tags/<tag>.",
            validation: (Rule) =>
                Rule.unique().custom((tags?: string[]) => {
                    if (!tags) return true;
                    const invalid = tags.filter((t) => !TAG_PATTERN.test(t));
                    return invalid.length === 0
                        ? true
                        : `Invalid tag(s): ${invalid.join(", ")} — use lowercase letters, digits, and hyphens only`;
                }),
        }),
        defineField({
            name: "image",
            title: "Cover Image",
            type: "image",
            options: {
                hotspot: true,
            },
            fields: [
                defineField({
                    name: "alt",
                    title: "Alt Text",
                    type: "string",
                }),
            ],
        }),
        defineField({
            name: "body",
            title: "Body",
            type: "array",
            of: [
                {
                    type: "block",
                    styles: [
                        { title: "Normal", value: "normal" },
                        { title: "H2", value: "h2" },
                        { title: "H3", value: "h3" },
                        { title: "H4", value: "h4" },
                        { title: "Quote", value: "blockquote" },
                    ],
                    marks: {
                        decorators: [
                            { title: "Bold", value: "strong" },
                            { title: "Italic", value: "em" },
                            { title: "Code", value: "code" },
                            { title: "Underline", value: "underline" },
                            { title: "Strikethrough", value: "strike-through" },
                        ],
                        annotations: [
                            {
                                title: "URL",
                                name: "link",
                                type: "object",
                                fields: [
                                    {
                                        title: "URL",
                                        name: "href",
                                        type: "url",
                                    },
                                ],
                            },
                        ],
                    },
                },
                {
                    type: "image",
                    options: { hotspot: true },
                    fields: [
                        defineField({
                            name: "alt",
                            title: "Alt Text",
                            type: "string",
                        }),
                        defineField({
                            name: "caption",
                            title: "Caption",
                            type: "string",
                        }),
                    ],
                },
                {
                    type: "code",
                    options: {
                        languageAlternatives: [
                            { title: "Bash", value: "bash" },
                            { title: "CSS", value: "css" },
                            { title: "Go", value: "go" },
                            { title: "HTML", value: "html" },
                            { title: "JavaScript", value: "javascript" },
                            { title: "JSON", value: "json" },
                            { title: "Markdown", value: "markdown" },
                            { title: "Python", value: "python" },
                            { title: "Rust", value: "rust" },
                            { title: "Shell", value: "shell" },
                            { title: "SQL", value: "sql" },
                            { title: "TypeScript", value: "typescript" },
                            { title: "YAML", value: "yaml" },
                        ],
                        withFilename: true,
                    },
                },
            ],
        }),
    ],
    preview: {
        select: {
            title: "title",
            media: "image",
            date: "date",
        },
        prepare({ title, media, date }) {
            return {
                title,
                subtitle: date,
                media,
            };
        },
    },
    orderings: [
        {
            title: "Publish Date, New",
            name: "dateDesc",
            by: [{ field: "date", direction: "desc" }],
        },
    ],
});
