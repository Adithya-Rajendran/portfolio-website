import { defineArrayMember, defineField, defineType } from "sanity";
import { listValuesOnly } from "@/lib/profile-fields";
import { IMAGE_CREDIT_MAX, IMAGE_WIDTHS } from "@/lib/post-fields";
import { IMAGE_KINDS } from "@/lib/project-fields";

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
                annotations: [
                    defineArrayMember({ type: "contentLink" }),
                    defineArrayMember({ type: "footnote" }),
                ],
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
                defineField({
                    name: "credit",
                    title: "Credit",
                    type: "string",
                    description:
                        "Optional. Who made the image, or its source and licence, printed under the caption.",
                    validation: (Rule) => Rule.max(IMAGE_CREDIT_MAX),
                }),
                defineField({
                    name: "kind",
                    title: "Kind",
                    type: "string",
                    description:
                        "Photographs are numbered as plates (Pl. I), diagrams, plots and screenshots as figures (Fig. 1). Empty counts as a photograph.",
                    options: { list: [...IMAGE_KINDS], layout: "radio" },
                    validation: listValuesOnly,
                }),
                defineField({
                    name: "width",
                    title: "Width",
                    type: "string",
                    description:
                        "Text width sits in the column of text; Wide takes the whole reading column; Full width spans the page.",
                    initialValue: "prose",
                    options: { list: [...IMAGE_WIDTHS], layout: "radio" },
                    validation: listValuesOnly,
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
