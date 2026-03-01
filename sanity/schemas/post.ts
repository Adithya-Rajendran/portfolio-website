import { defineField, defineType } from "sanity";

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
