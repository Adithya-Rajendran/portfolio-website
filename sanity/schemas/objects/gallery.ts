import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
    name: "gallery",
    title: "Gallery",
    type: "object",
    fields: [
        defineField({
            name: "images",
            title: "Images",
            type: "array",
            of: [
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
                            validation: (Rule) => Rule.max(180),
                        }),
                    ],
                }),
            ],
            validation: (Rule) => Rule.required().min(2).max(8),
        }),
        defineField({
            name: "caption",
            title: "Gallery Caption",
            type: "string",
            validation: (Rule) => Rule.max(220),
        }),
    ],
    preview: {
        select: { images: "images", caption: "caption" },
        prepare({ images, caption }) {
            const count = Array.isArray(images) ? images.length : 0;
            return {
                title: `Gallery · ${count} image${count === 1 ? "" : "s"}`,
                subtitle: caption,
                media: Array.isArray(images) ? images[0] : undefined,
            };
        },
    },
});
