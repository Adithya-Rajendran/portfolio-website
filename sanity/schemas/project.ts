import {
    defineArrayMember,
    defineField,
    defineType,
    getPublishedId,
    type ValidationContext,
} from "sanity";
import { extractHeadings, type HeadingSourceBlock } from "@/lib/headings";
import { formatMissionDesignation } from "@/lib/designations";
import { TIMELINE_DATE_PRECISIONS, listValuesOnly } from "@/lib/profile-fields";
import {
    checkAnchorHeading,
    checkDesignationUnique,
    checkParameterCount,
    DESIGNATION_MAX,
    DESIGNATION_MIN,
    MODEL_KINDS,
    nextFreeDesignation,
    PROJECT_STATUSES,
    PROJECT_TYPES,
    REAL_WORLD_DIMENSIONS,
    REAL_WORLD_UNITS,
} from "@/lib/project-fields";
import {
    checkModelPart,
    MODEL_PART_OPTIONS,
    PROCEDURAL_MODEL_OPTIONS,
} from "@/lib/viewer/registry";

/** API version for the Studio-only queries in this file. */
const STUDIO_API_VERSION = "2025-02-19";

type ProjectDraft = {
    _id?: string;
    body?: HeadingSourceBlock[];
    model?: { kind?: string; procedural?: string };
};

function modelOf(document: unknown): ProjectDraft["model"] {
    return (document as ProjectDraft | undefined)?.model;
}

/**
 * Every stored project that uses this number, in the raw perspective:
 * published documents, drafts and release versions alike. The document's
 * own versions are told apart by their published id.
 */
export async function validateDesignation(
    designation: number | undefined,
    context: Pick<ValidationContext, "document" | "getClient">,
): Promise<true | string> {
    if (typeof designation !== "number" || !context.document?._id) return true;
    const holders = await context
        .getClient({ apiVersion: STUDIO_API_VERSION })
        .fetch<{ _id: string; title?: string | null }[]>(
            `*[_type == "project" && designation == $designation]{_id, title}`,
            { designation },
            { perspective: "raw" },
        );
    return checkDesignationUnique(
        designation,
        getPublishedId(context.document._id),
        (holders ?? []).map((holder) => ({
            id: getPublishedId(holder._id),
            title: holder.title,
        })),
    );
}

/**
 * A callout anchor names a heading id in this project's essay or, when a
 * post is linked, in that post as published (the version readers can open).
 */
export async function validateAnchorHeading(
    heading: string | undefined,
    context: Pick<ValidationContext, "document" | "getClient" | "parent">,
): Promise<true | string> {
    if (!heading) return true;
    const postId = (context.parent as { post?: { _ref?: string } } | undefined)
        ?.post?._ref;
    if (!postId) {
        const body = (context.document as ProjectDraft | undefined)?.body;
        return checkAnchorHeading(
            heading,
            extractHeadings({ body }).map((entry) => entry.id),
            "this project’s essay",
        );
    }
    const post = await context
        .getClient({ apiVersion: STUDIO_API_VERSION })
        .fetch<{ body?: HeadingSourceBlock[] | null } | null>(
            `*[_type == "post" && _id == $id][0]{
                "body": body[_type == "block" && style in ["h2", "h3", "h4"]]
            }`,
            { id: getPublishedId(postId) },
            { perspective: "published" },
        );
    if (!post) {
        return "The linked post is not published yet. Callout anchors are checked against the published post, so publish it first.";
    }
    return checkAnchorHeading(
        heading,
        extractHeadings({ body: post.body }).map((entry) => entry.id),
        "the linked post",
    );
}

const requiredWhen =
    (kind: string, message: string) =>
    (value: unknown, context: { document?: unknown }) =>
        modelOf(context.document)?.kind !== kind ||
        (value !== undefined && value !== null && value !== "")
            ? true
            : message;

const imageAltField = defineField({
    name: "alt",
    title: "Alt Text",
    type: "string",
    validation: (Rule) => Rule.required(),
});

export default defineType({
    name: "project",
    title: "Project",
    type: "document",
    groups: [
        { name: "editorial", title: "Editorial", default: true },
        { name: "details", title: "Details" },
        { name: "brief", title: "Brief & Results" },
        { name: "model", title: "3D Model" },
        { name: "content", title: "Project Essay" },
    ],
    // A new project takes the next free mission number.
    initialValue: async (_params, context) => {
        try {
            const used = await context
                .getClient({ apiVersion: STUDIO_API_VERSION })
                .fetch<(number | null)[]>(
                    `*[_type == "project" && defined(designation)].designation`,
                    {},
                    { perspective: "raw" },
                );
            return {
                status: "active",
                designation: nextFreeDesignation(used ?? []),
            };
        } catch {
            return { status: "active" };
        }
    },
    fields: [
        defineField({
            name: "designation",
            title: "Mission Number",
            type: "number",
            group: "editorial",
            description:
                "Printed as MSN-01 to MSN-99 on mission pages, tiles and the CV, and orders Missions in the Studio. New projects take the next free number. Keep it once published, so links and printed CVs stay right.",
            validation: (Rule) =>
                Rule.required()
                    .integer()
                    .min(DESIGNATION_MIN)
                    .max(DESIGNATION_MAX)
                    .custom((value: number | undefined, context) =>
                        validateDesignation(value, context),
                    ),
        }),
        defineField({
            name: "title",
            title: "Title",
            type: "string",
            group: "editorial",
            validation: (Rule) => Rule.required().max(100),
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
            name: "summary",
            title: "Summary",
            type: "text",
            rows: 3,
            group: "editorial",
            validation: (Rule) => Rule.required().max(300),
        }),
        defineField({
            name: "types",
            title: "Types",
            type: "array",
            group: "editorial",
            description:
                "One to three. Shown on mission tiles and the title block, and used to filter Missions.",
            // The member's list types the stored values; the field's list
            // draws the checkboxes.
            of: [
                defineArrayMember({
                    type: "string",
                    options: { list: [...PROJECT_TYPES] },
                }),
            ],
            options: { list: [...PROJECT_TYPES], layout: "grid" },
            validation: (Rule) => Rule.required().min(1).max(3).unique(),
        }),
        defineField({
            name: "featured",
            title: "Featured Slot",
            type: "number",
            group: "editorial",
            description:
                "Optional. 1 puts this mission on the photographic stage of the home page and Missions; 2 and 3 feature it next to that. Leave empty for the rest.",
            options: { list: [1, 2, 3] },
            validation: (Rule) => Rule.integer().min(1).max(3),
        }),
        defineField({
            name: "cover",
            title: "Cover Image",
            type: "image",
            group: "editorial",
            options: { hotspot: true },
            fields: [
                imageAltField,
                defineField({
                    name: "caption",
                    title: "Caption",
                    type: "string",
                    validation: (Rule) => Rule.max(220),
                }),
            ],
        }),
        defineField({
            name: "coverPortrait",
            title: "Portrait Cover",
            type: "image",
            group: "editorial",
            description:
                "Optional. A tall crop used below 960 px wide and in the Flight Manual theme. Without it, the cover is cropped.",
            options: { hotspot: true },
            fields: [imageAltField],
        }),
        defineField({
            name: "status",
            title: "Status",
            type: "string",
            group: "details",
            description:
                "Shown with a symbol and a label on tiles and the mission title block (● Active, ■ Complete, ‖ Paused, ○ Archived, ◌ Planned, × Stopped).",
            options: { list: [...PROJECT_STATUSES], layout: "radio" },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "statusNote",
            title: "Status Note",
            type: "string",
            group: "details",
            description:
                "Optional. One line on where things stand, shown in the title block and on tiles.",
            validation: (Rule) => Rule.max(140),
        }),
        defineField({
            name: "myRole",
            title: "My Role",
            type: "string",
            group: "details",
            description:
                "Optional. For example “Personal project”. Shown in the title block and on CV mission rows.",
            validation: (Rule) => Rule.max(60),
        }),
        defineField({
            name: "startDate",
            title: "Start Date",
            type: "date",
            group: "details",
        }),
        defineField({
            name: "endDate",
            title: "End Date",
            type: "date",
            group: "details",
            description: "Leave empty for active work.",
            validation: (Rule) => Rule.min(Rule.valueOfField("startDate")),
        }),
        defineField({
            name: "datePrecision",
            title: "Date Precision",
            type: "string",
            group: "details",
            description:
                "How much of the start and end dates is known. When you know only the years, enter any day in each year and pick Year only: the site then never prints a month. Leave empty when the months are right.",
            options: {
                list: [...TIMELINE_DATE_PRECISIONS],
                layout: "radio",
                direction: "horizontal",
            },
            validation: listValuesOnly,
        }),
        defineField({
            name: "datesApproximate",
            title: "Dates Are Estimates",
            type: "boolean",
            group: "details",
            description:
                "Turn on when the dates are your best estimate: the site prints them with “c.” (circa), for example “c. 2023”.",
            initialValue: false,
        }),
        defineField({
            name: "technologies",
            title: "Technologies",
            type: "array",
            group: "details",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(80),
                }),
            ],
            options: { layout: "tags" },
            validation: (Rule) => Rule.required().min(1).unique(),
        }),
        defineField({
            name: "highlights",
            title: "Highlights",
            type: "array",
            group: "details",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(300),
                }),
            ],
            validation: (Rule) => Rule.required().min(1).unique(),
        }),
        defineField({
            name: "parameters",
            title: "Parameters",
            type: "array",
            group: "details",
            description:
                "Up to six short facts for the row under the mission header, for example “Nodes · 3”. Only values stated in a source.",
            of: [
                defineArrayMember({
                    name: "parameter",
                    title: "Parameter",
                    type: "object",
                    fields: [
                        defineField({
                            name: "label",
                            title: "Label",
                            type: "string",
                            validation: (Rule) => Rule.required().max(32),
                        }),
                        defineField({
                            name: "value",
                            title: "Value",
                            type: "string",
                            validation: (Rule) => Rule.required().max(24),
                        }),
                    ],
                    preview: { select: { title: "value", subtitle: "label" } },
                }),
            ],
            validation: (Rule) => [
                Rule.max(6),
                Rule.custom((value: unknown[] | undefined) =>
                    checkParameterCount(value),
                ).warning(),
            ],
        }),
        defineField({
            name: "links",
            title: "Links",
            type: "array",
            group: "details",
            of: [defineArrayMember({ type: "externalLink" })],
            validation: (Rule) => Rule.unique().max(6),
        }),
        defineField({
            name: "brief",
            title: "Brief",
            type: "object",
            group: "brief",
            description:
                "Optional. The Brief module on the mission page: the problem, the approach and the outcome, a few sentences each.",
            fields: [
                defineField({
                    name: "problem",
                    title: "Problem",
                    type: "text",
                    rows: 3,
                    validation: (Rule) => Rule.max(300),
                }),
                defineField({
                    name: "approach",
                    title: "Approach",
                    type: "text",
                    rows: 3,
                    validation: (Rule) => Rule.max(300),
                }),
                defineField({
                    name: "outcome",
                    title: "Outcome",
                    type: "text",
                    rows: 3,
                    validation: (Rule) => Rule.max(300),
                }),
            ],
        }),
        defineField({
            name: "results",
            title: "Results",
            type: "array",
            group: "brief",
            description:
                "Optional. Measured results for the results table on the mission page.",
            of: [
                defineArrayMember({
                    name: "result",
                    title: "Result",
                    type: "object",
                    fields: [
                        defineField({
                            name: "metric",
                            title: "Metric",
                            type: "string",
                            validation: (Rule) => Rule.required().max(40),
                        }),
                        defineField({
                            name: "value",
                            title: "Value",
                            type: "string",
                            validation: (Rule) => Rule.required().max(24),
                        }),
                        defineField({
                            name: "note",
                            title: "Note",
                            type: "string",
                            validation: (Rule) => Rule.max(140),
                        }),
                    ],
                    preview: {
                        select: { title: "metric", subtitle: "value" },
                    },
                }),
            ],
            validation: (Rule) => Rule.max(6),
        }),
        defineField({
            name: "lessons",
            title: "Lessons",
            type: "array",
            group: "brief",
            description:
                "Optional. What you learned, for the Debrief on the mission page.",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(200),
                }),
            ],
            validation: (Rule) => Rule.max(5),
        }),
        defineField({
            name: "next",
            title: "Next",
            type: "array",
            group: "brief",
            description:
                "Optional. What comes next, for the Debrief on the mission page.",
            of: [
                defineArrayMember({
                    type: "string",
                    validation: (Rule) => Rule.required().max(200),
                }),
            ],
            validation: (Rule) => Rule.max(5),
        }),
        defineField({
            name: "model",
            title: "3D Model",
            type: "object",
            group: "model",
            description:
                "Optional. The drawing on the mission page: a poster image that always shows, and a 3D model a reader can load. Callouts link parts of it to sections of the essay or of a post.",
            fields: [
                defineField({
                    name: "kind",
                    title: "Kind",
                    type: "string",
                    options: { list: [...MODEL_KINDS], layout: "radio" },
                    validation: (Rule) => Rule.required(),
                }),
                defineField({
                    name: "procedural",
                    title: "Model",
                    type: "string",
                    description: "Models built in code by the site.",
                    options: { list: PROCEDURAL_MODEL_OPTIONS },
                    hidden: ({ document }) =>
                        modelOf(document)?.kind !== "procedural",
                    validation: (Rule) =>
                        Rule.custom(
                            requiredWhen("procedural", "Pick the model."),
                        ),
                }),
                defineField({
                    name: "file",
                    title: "Model File",
                    type: "file",
                    description:
                        "A .glb file, optimised so it needs no decoder.",
                    options: { accept: ".glb,model/gltf-binary" },
                    hidden: ({ document }) =>
                        modelOf(document)?.kind !== "gltf",
                    validation: (Rule) =>
                        Rule.custom(
                            requiredWhen("gltf", "Upload the .glb file."),
                        ),
                }),
                defineField({
                    name: "poster",
                    title: "Poster",
                    type: "image",
                    description:
                        "Shown until the model loads, and instead of it without JavaScript or WebGL.",
                    options: { hotspot: true },
                    fields: [imageAltField],
                    validation: (Rule) => Rule.required(),
                }),
                defineField({
                    name: "title",
                    title: "Caption Title",
                    type: "string",
                    validation: (Rule) => Rule.max(60),
                }),
                defineField({
                    name: "alt",
                    title: "Description",
                    type: "text",
                    rows: 3,
                    description:
                        "What the model shows, for readers who cannot see it.",
                    validation: (Rule) => Rule.required().max(300),
                }),
                defineField({
                    name: "realWorld",
                    title: "Real-World Size",
                    type: "object",
                    description:
                        "Optional. One real dimension for the dimension grid, for example a height of 12 U.",
                    options: { columns: 3 },
                    fields: [
                        defineField({
                            name: "dimension",
                            title: "Dimension",
                            type: "string",
                            options: { list: [...REAL_WORLD_DIMENSIONS] },
                            validation: (Rule) => Rule.required(),
                        }),
                        defineField({
                            name: "value",
                            title: "Value",
                            type: "number",
                            validation: (Rule) => Rule.required().positive(),
                        }),
                        defineField({
                            name: "unit",
                            title: "Unit",
                            type: "string",
                            options: { list: [...REAL_WORLD_UNITS] },
                            validation: (Rule) => Rule.required(),
                        }),
                    ],
                }),
                defineField({
                    name: "hotspots",
                    title: "Callouts",
                    type: "array",
                    description:
                        "Numbered balloons on the model. Each opens a short card and can link to a section.",
                    of: [
                        defineArrayMember({
                            name: "hotspot",
                            title: "Callout",
                            type: "object",
                            fields: [
                                defineField({
                                    name: "label",
                                    title: "Balloon Label",
                                    type: "string",
                                    description: "For example “1” or “T0”.",
                                    validation: (Rule) =>
                                        Rule.required().max(12),
                                }),
                                defineField({
                                    name: "title",
                                    title: "Title",
                                    type: "string",
                                    validation: (Rule) =>
                                        Rule.required().max(60),
                                }),
                                defineField({
                                    name: "body",
                                    title: "Note",
                                    type: "text",
                                    rows: 3,
                                    validation: (Rule) => Rule.max(200),
                                }),
                                defineField({
                                    name: "part",
                                    title: "Part",
                                    type: "string",
                                    description:
                                        "The part of the model the balloon points at.",
                                    options: { list: MODEL_PART_OPTIONS },
                                    hidden: ({ document }) =>
                                        modelOf(document)?.kind !==
                                        "procedural",
                                    validation: (Rule) =>
                                        Rule.custom(
                                            (
                                                value: string | undefined,
                                                context,
                                            ) => {
                                                const model = modelOf(
                                                    context.document,
                                                );
                                                if (
                                                    model?.kind !== "procedural"
                                                ) {
                                                    return true;
                                                }
                                                if (!value) {
                                                    return "Pick the part the balloon points at.";
                                                }
                                                return checkModelPart(
                                                    model.procedural,
                                                    value,
                                                );
                                            },
                                        ),
                                }),
                                defineField({
                                    name: "position",
                                    title: "Position",
                                    type: "object",
                                    description:
                                        "Where the balloon points, in the model file’s coordinates.",
                                    options: { columns: 3 },
                                    hidden: ({ document }) =>
                                        modelOf(document)?.kind !== "gltf",
                                    fields: ["x", "y", "z"].map((axis) =>
                                        defineField({
                                            name: axis,
                                            title: axis.toUpperCase(),
                                            type: "number",
                                            validation: (Rule) =>
                                                Rule.required(),
                                        }),
                                    ),
                                    validation: (Rule) =>
                                        Rule.custom(
                                            requiredWhen(
                                                "gltf",
                                                "Set where the balloon points.",
                                            ),
                                        ),
                                }),
                                defineField({
                                    name: "anchor",
                                    title: "Links To",
                                    type: "object",
                                    description:
                                        "Optional. A section of this project’s essay or, with a post picked, of that post.",
                                    fields: [
                                        defineField({
                                            name: "heading",
                                            title: "Heading Id",
                                            type: "string",
                                            description:
                                                "The heading’s id as in its link, for example “tier-0-the-raspberry-pis”.",
                                            validation: (Rule) =>
                                                Rule.required().custom(
                                                    (
                                                        value:
                                                            string | undefined,
                                                        context,
                                                    ) =>
                                                        validateAnchorHeading(
                                                            value,
                                                            context,
                                                        ),
                                                ),
                                        }),
                                        defineField({
                                            name: "post",
                                            title: "Post",
                                            type: "reference",
                                            to: [{ type: "post" }],
                                            weak: true,
                                            description:
                                                "Optional. Leave empty to link to this project’s essay.",
                                        }),
                                    ],
                                }),
                            ],
                            preview: {
                                select: {
                                    label: "label",
                                    title: "title",
                                    heading: "anchor.heading",
                                },
                                prepare({ label, title, heading }) {
                                    return {
                                        title: [label, title]
                                            .filter(Boolean)
                                            .join(" · "),
                                        subtitle: heading
                                            ? `→ #${heading}`
                                            : undefined,
                                    };
                                },
                            },
                        }),
                    ],
                    validation: (Rule) => Rule.max(12),
                }),
            ],
        }),
        defineField({
            name: "body",
            title: "Project Essay",
            type: "contentBody",
            group: "content",
            validation: (Rule) => Rule.required().min(1),
        }),
    ],
    preview: {
        select: {
            designation: "designation",
            title: "title",
            status: "status",
            types: "types",
            media: "cover",
        },
        prepare({ designation, title, status, types, media }) {
            const statusTitle = PROJECT_STATUSES.find(
                (option) => option.value === status,
            )?.title;
            const typeTitles = (Array.isArray(types) ? types : [])
                .map(
                    (type) =>
                        PROJECT_TYPES.find((option) => option.value === type)
                            ?.title,
                )
                .filter(Boolean)
                .join(", ");
            return {
                title:
                    typeof designation === "number"
                        ? `${formatMissionDesignation(designation)} · ${title}`
                        : title,
                subtitle: [statusTitle, typeTitles].filter(Boolean).join(" · "),
                media,
            };
        },
    },
    orderings: [
        {
            title: "Mission Number",
            name: "designationAsc",
            by: [{ field: "designation", direction: "asc" }],
        },
        {
            title: "Started, Newest",
            name: "startDateDesc",
            by: [{ field: "startDate", direction: "desc" }],
        },
        {
            title: "Title",
            name: "titleAsc",
            by: [{ field: "title", direction: "asc" }],
        },
    ],
});
