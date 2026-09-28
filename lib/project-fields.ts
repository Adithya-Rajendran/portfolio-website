/**
 * Option lists and pure validation rules for projects (Missions) and post
 * covers, shared by the Sanity schema (`sanity/schemas/`) and the site code,
 * so a stored value and the type the site reads cannot drift apart. Keep this
 * module free of imports: the Studio and `sanity schema extract` bundle it.
 */

type Option<Value extends string> = {
    readonly title: string;
    readonly value: Value;
};

type ValueOf<List extends readonly Option<string>[]> = List[number]["value"];

/**
 * A project's status. The stored values never change (`completed` stays
 * `completed`); the titles are what the Studio and the site print.
 */
export const PROJECT_STATUSES = [
    { title: "Active", value: "active" },
    { title: "Complete", value: "completed" },
    { title: "Paused", value: "paused" },
    { title: "Archived", value: "archived" },
    { title: "Planned", value: "planned" },
    { title: "Stopped", value: "stopped" },
] as const satisfies readonly Option<string>[];
export type ProjectStatus = ValueOf<typeof PROJECT_STATUSES>;

export const PROJECT_TYPES = [
    { title: "Research", value: "research" },
    { title: "Hardware", value: "hardware" },
    { title: "Software", value: "software" },
    { title: "Infrastructure", value: "infrastructure" },
] as const satisfies readonly Option<string>[];
export type ProjectType = ValueOf<typeof PROJECT_TYPES>;

/**
 * What an image shows. Photographs are numbered as plates (Pl. n); plots,
 * diagrams and screenshots as figures (Fig. n).
 */
export const IMAGE_KINDS = [
    { title: "Photograph", value: "photo" },
    { title: "Diagram", value: "diagram" },
    { title: "Plot", value: "plot" },
    { title: "Screenshot", value: "screenshot" },
] as const satisfies readonly Option<string>[];
export type ImageKind = ValueOf<typeof IMAGE_KINDS>;

export const MODEL_KINDS = [
    { title: "Built in code (procedural)", value: "procedural" },
    { title: "glTF file (.glb)", value: "gltf" },
] as const satisfies readonly Option<string>[];
export type ModelKind = ValueOf<typeof MODEL_KINDS>;

export const REAL_WORLD_DIMENSIONS = [
    { title: "Height", value: "height" },
    { title: "Width", value: "width" },
    { title: "Depth", value: "depth" },
    { title: "Reach", value: "reach" },
] as const satisfies readonly Option<string>[];
export type RealWorldDimension = ValueOf<typeof REAL_WORLD_DIMENSIONS>;

export const REAL_WORLD_UNITS = [
    { title: "mm", value: "mm" },
    { title: "cm", value: "cm" },
    { title: "in", value: "in" },
    { title: "Rack units (U)", value: "U" },
] as const satisfies readonly Option<string>[];
export type RealWorldUnit = ValueOf<typeof REAL_WORLD_UNITS>;

/** Mission numbers are MSN-01 to MSN-99. */
export const DESIGNATION_MIN = 1;
export const DESIGNATION_MAX = 99;

/**
 * The number a new project is offered: one after the highest in use, so
 * numbers follow creation order and a retired number is not handed out
 * again. Falls back to the lowest free number once 99 is taken, and to
 * `undefined` when every number is in use.
 */
export function nextFreeDesignation(
    used: readonly (number | null | undefined)[],
): number | undefined {
    const taken = new Set(
        used.filter(
            (value): value is number =>
                typeof value === "number" &&
                Number.isInteger(value) &&
                value >= DESIGNATION_MIN &&
                value <= DESIGNATION_MAX,
        ),
    );
    const next = taken.size ? Math.max(...taken) + 1 : DESIGNATION_MIN;
    if (next <= DESIGNATION_MAX) return next;
    for (let value = DESIGNATION_MIN; value <= DESIGNATION_MAX; value++) {
        if (!taken.has(value)) return value;
    }
    return undefined;
}

/**
 * A designation must be unique among projects. `holders` are the stored
 * projects (published, drafts and release versions) that already use the
 * number, each with its published id; `ownId` is the published id of the
 * document being edited, so its own draft or published version never
 * counts as a clash.
 */
export function checkDesignationUnique(
    designation: number | undefined,
    ownId: string | undefined,
    holders: readonly { id: string; title?: string | null }[],
): true | string {
    if (typeof designation !== "number") return true;
    const clash = holders.find((holder) => holder.id !== ownId);
    if (!clash) return true;
    const name = clash.title ? `“${clash.title}”` : "another project";
    const number = String(designation).padStart(2, "0");
    return `MSN-${number} is already used by ${name}. Pick another number.`;
}

/** The parameter row under a mission header reads best with 3 to 6 items. */
export function checkParameterCount(
    parameters: readonly unknown[] | undefined,
): true | string {
    if (!parameters?.length || parameters.length >= 3) return true;
    return "Add at least three parameters, or remove them: the row under the mission header is built for three to six.";
}

/** A revision cannot predate the post it revises. */
export function checkRevisedAt(
    publishedAt: string | undefined,
    revisedAt: string | undefined,
): true | string {
    if (!publishedAt || !revisedAt || revisedAt >= publishedAt) return true;
    return "The revision date must be on or after the publication date.";
}

/**
 * A 3D-model callout links to a heading on the site: `ids` are the heading
 * ids of the section it names (this project's essay, or the linked post),
 * derived by `extractHeadings` in `lib/headings.ts` exactly as the pages
 * render them. `where` names that text in the message.
 */
export function checkAnchorHeading(
    heading: string | undefined,
    ids: readonly string[],
    where: string,
): true | string {
    if (!heading || ids.includes(heading)) return true;
    if (!ids.length) {
        const subject = where.charAt(0).toUpperCase() + where.slice(1);
        return `${subject} has no headings (h2 to h4) to link to.`;
    }
    const listed = ids.slice(0, 12).join(", ");
    const more = ids.length > 12 ? ", …" : "";
    return `No heading in ${where} has the id “${heading}”. Use one of: ${listed}${more}.`;
}
