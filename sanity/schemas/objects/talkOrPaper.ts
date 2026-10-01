import { defineArrayMember, defineField, defineType } from "sanity";
import { TALK_KINDS } from "@/lib/profile-fields";

export default defineType({
    name: "talkOrPaper",
    title: "Talk or Paper",
    type: "object",
    fields: [
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule) => Rule.required().max(160),
        }),
        defineField({
            name: "kind",
            title: "Kind",
            type: "string",
            options: { list: [...TALK_KINDS], layout: "radio" },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "venue",
            title: "Venue",
            type: "string",
            description:
                "Where it was given or published, for example a conference, journal or university.",
            validation: (Rule) => Rule.max(120),
        }),
        defineField({
            name: "date",
            title: "Date",
            type: "date",
            description:
                "When it was given or published. Leave it empty if you are not sure: the entry then prints no date and sorts after dated ones.",
            validation: (Rule) =>
                Rule.custom((value) =>
                    value
                        ? true
                        : "Add the date if you know it, so the entry can be placed in time.",
                ).warning(),
        }),
        defineField({
            name: "authors",
            title: "Authors",
            type: "string",
            description:
                "As printed on the talk or paper. Leave empty when you presented alone.",
            validation: (Rule) => Rule.max(200),
        }),
        defineField({
            name: "links",
            title: "Links",
            type: "array",
            description: "Slides, the paper, a recording or the event page.",
            of: [defineArrayMember({ type: "externalLink" })],
            validation: (Rule) => Rule.unique().max(4),
        }),
        defineField({
            name: "abstract",
            title: "Abstract",
            type: "text",
            rows: 4,
            validation: (Rule) => Rule.max(600),
        }),
        defineField({
            name: "project",
            title: "Related Project",
            type: "reference",
            to: [{ type: "project" }],
            weak: true,
            description: "Optional. The project this talk or paper came from.",
        }),
    ],
    preview: {
        select: {
            title: "title",
            kind: "kind",
            venue: "venue",
            date: "date",
        },
        prepare({ title, kind, venue, date }) {
            const kindTitle = TALK_KINDS.find(
                (option) => option.value === kind,
            )?.title;
            return {
                title,
                subtitle: [
                    kindTitle,
                    venue,
                    typeof date === "string" ? date.slice(0, 4) : undefined,
                ]
                    .filter(Boolean)
                    .join(" · "),
            };
        },
    },
});
