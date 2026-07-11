import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
    name: "skillGroup",
    title: "Skill Group",
    type: "object",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.required().max(80),
        }),
        defineField({
            name: "skills",
            title: "Skills",
            type: "array",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(80),
                }),
            ],
            options: { layout: "tags" },
            validation: (Rule) => Rule.required().min(1).unique(),
        }),
    ],
    preview: {
        select: { title: "title", skills: "skills" },
        prepare({ title, skills }) {
            return {
                title,
                subtitle: Array.isArray(skills)
                    ? `${skills.length} skill${skills.length === 1 ? "" : "s"}`
                    : undefined,
            };
        },
    },
});
