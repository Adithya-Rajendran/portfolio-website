import { defineArrayMember, defineField, defineType } from "sanity";

const languageAlternatives = [
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
];

export default defineType({
    name: "contentBody",
    title: "Content Body",
    type: "array",
    of: [
        defineArrayMember({
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
                annotations: [defineArrayMember({ type: "contentLink" })],
            },
        }),
        defineArrayMember({
            type: "image",
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
            ],
        }),
        defineArrayMember({
            type: "code",
            options: { languageAlternatives, withFilename: true },
        }),
        defineArrayMember({ type: "gallery" }),
        defineArrayMember({ type: "callout" }),
        defineArrayMember({ type: "mediaEmbed" }),
    ],
});
