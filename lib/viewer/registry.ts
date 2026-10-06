/**
 * The 3D models the viewer builds in code, and the parts of each that a
 * callout can point at. The Sanity schema reads this list (a project's
 * `model.procedural` and each callout's `part`), so it imports nothing, and
 * never three.js: the model modules that build the geometry come with the
 * viewer (IMPLEMENTATION.md §2.5.4).
 */

type ModelPart = {
    readonly key: string;
    readonly title: string;
};

type ProceduralModel = {
    readonly key: string;
    readonly title: string;
    readonly parts: readonly ModelPart[];
};

/** @internal Exported for tests. */
export const PROCEDURAL_MODELS = [
    {
        // The owner's 12U homelab rack, as photographed in the homelab post
        // (design/shared/rack.js). Each part is one of its callout anchors.
        key: "homelab-rack",
        title: "Homelab rack (12U)",
        parts: [
            { key: "tier0", title: "Tier 0: Raspberry Pi 5 mount" },
            { key: "network", title: "Network: switch and patch panel" },
            { key: "ms01", title: "Tier 2: Minisforum MS-01 shelves" },
            { key: "ascent", title: "GPU node: ASUS Ascent (DGX Spark)" },
            { key: "power", title: "Power: rack PDU" },
        ],
    },
] as const satisfies readonly ProceduralModel[];

export type ProceduralModelKey = (typeof PROCEDURAL_MODELS)[number]["key"];
export type ModelPartKey =
    (typeof PROCEDURAL_MODELS)[number]["parts"][number]["key"];

/** Studio options for `model.procedural`. */
export const PROCEDURAL_MODEL_OPTIONS = PROCEDURAL_MODELS.map(
    ({ key, title }) => ({ title, value: key }),
);

/**
 * Studio options for a callout's `part`: every part of every model, named
 * with its model. `checkModelPart` then limits it to the chosen model.
 */
export const MODEL_PART_OPTIONS = PROCEDURAL_MODELS.flatMap((model) =>
    model.parts.map((part) => ({
        title: `${model.title}: ${part.title}`,
        value: part.key,
    })),
);

/** A callout's part must belong to the procedural model it annotates. */
export function checkModelPart(
    modelKey: string | undefined,
    partKey: string | undefined,
): true | string {
    if (!partKey || !modelKey) return true;
    const model: ProceduralModel | undefined = PROCEDURAL_MODELS.find(
        (candidate) => candidate.key === modelKey,
    );
    if (!model) return true;
    if (model.parts.some((part) => part.key === partKey)) return true;
    return `“${partKey}” is not a part of the ${model.title}. Pick one of: ${model.parts
        .map((part) => part.key)
        .join(", ")}.`;
}
