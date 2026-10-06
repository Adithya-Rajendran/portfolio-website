import { describe, expect, it, vi } from "vitest";
import post from "@/sanity/schemas/post";
import project, {
    validateAnchorHeading,
    validateDesignation,
    validateFeaturedSlot,
} from "@/sanity/schemas/project";

type Fetch = (
    query: string,
    params: Record<string, unknown>,
    options: { perspective?: string },
) => Promise<unknown>;

/** A validation context whose Studio client answers with `fetch`. */
function contextWith(
    fetch: Fetch,
    document: Record<string, unknown>,
    parent?: unknown,
) {
    const fetchMock = vi.fn(fetch);
    const getClient = vi.fn(() => ({ fetch: fetchMock }));
    return {
        fetchMock,
        context: {
            document: { _type: "project", ...document },
            parent,
            getClient,
        } as unknown as Parameters<typeof validateAnchorHeading>[1],
    };
}

function heading(key: string, text: string, style = "h2") {
    return {
        _key: key,
        _type: "block",
        style,
        markDefs: [],
        children: [{ _key: `${key}s`, _type: "span", text, marks: [] }],
    };
}

function fieldNames(schema: { fields: { name: string }[] }) {
    return schema.fields.map((field) => field.name);
}

describe("project schema", () => {
    it("adds the mission fields to groups that exist", () => {
        const groups = new Set(project.groups?.map((group) => group.name));
        for (const field of project.fields) {
            for (const group of [field.group].flat()) {
                expect(groups, `${field.name} → ${group}`).toContain(group);
            }
        }
        expect(fieldNames(project)).toEqual(
            expect.arrayContaining([
                "designation",
                "types",
                "featured",
                "statusNote",
                "myRole",
                "parameters",
                "brief",
                "results",
                "lessons",
                "next",
                "coverPortrait",
                "model",
                "datePrecision",
                "datesApproximate",
            ]),
        );
    });

    it("gives the post a cover, related projects and a revision date", () => {
        expect(fieldNames(post)).toEqual(
            expect.arrayContaining(["cover", "projects", "revisedAt"]),
        );
        // `image` was removed by the cleanup migration; never reuse it.
        expect(fieldNames(post)).not.toContain("image");
    });
});

describe("project slug", () => {
    type SlugRule = {
        required(): SlugRule;
        custom(check: (value: { current?: string }) => true | string): unknown;
    };
    /** The slug field's own check, read from its validation rule. */
    function slugCheck() {
        const field = project.fields.find((entry) => entry.name === "slug") as
            { validation?: (rule: SlugRule) => unknown } | undefined;
        let check: ((value: { current?: string }) => true | string) | null =
            null;
        const rule: SlugRule = {
            required: () => rule,
            custom: (fn) => {
                check = fn;
                return rule;
            },
        };
        field?.validation?.(rule);
        return check!;
    }

    it("takes the post's shape and leaves /portfolio's own addresses free", () => {
        const check = slugCheck();
        expect(check({ current: "homelab" })).toBe(true);
        expect(check({ current: "Homelab" })).toMatch(/lowercase/);
        expect(check({ current: "opengraph-image" })).toMatch(
            /address of another page/,
        );
        // Posts' reserved words are free for a project.
        expect(check({ current: "archive" })).toBe(true);
    });
});

describe("new project template", () => {
    type Resolver = (
        params: unknown,
        context: unknown,
    ) => Promise<Record<string, unknown>>;
    const initialValue = project.initialValue as unknown as Resolver;

    it("starts active with the next free mission number", async () => {
        const fetch = vi.fn(async () => [1, 2, 4, null]);
        const context = { getClient: () => ({ fetch }) };

        await expect(initialValue(undefined, context)).resolves.toEqual({
            status: "active",
            designation: 5,
        });
        // Drafts hold numbers too, so the raw perspective is read.
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining("defined(designation)"),
            {},
            { perspective: "raw" },
        );
    });

    it("still starts active when the numbers cannot be read", async () => {
        const context = {
            getClient: () => ({
                fetch: async () => {
                    throw new Error("offline");
                },
            }),
        };

        await expect(initialValue(undefined, context)).resolves.toEqual({
            status: "active",
        });
    });
});

describe("designation uniqueness", () => {
    it("lets a draft keep the number of its own published version", async () => {
        const { context, fetchMock } = contextWith(
            async () => [
                { _id: "project-homelab", title: "Homelab" },
                { _id: "drafts.project-homelab", title: "Homelab" },
            ],
            { _id: "drafts.project-homelab" },
        );

        await expect(validateDesignation(2, context)).resolves.toBe(true);
        // Raw perspective: drafts and release versions count as holders.
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("designation == $designation"),
            { designation: 2 },
            { perspective: "raw" },
        );
    });

    it("rejects a number a different project uses, even as a draft", async () => {
        const { context } = contextWith(
            async () => [{ _id: "drafts.project-website", title: "Website" }],
            { _id: "drafts.project-homelab" },
        );

        await expect(validateDesignation(4, context)).resolves.toBe(
            "MSN-04 is already used by “Website”. Pick another number.",
        );
    });

    it("counts a release version as the same project", async () => {
        const { context } = contextWith(
            async () => [{ _id: "versions.r1.project-homelab" }],
            { _id: "project-homelab" },
        );

        await expect(validateDesignation(2, context)).resolves.toBe(true);
    });

    it("leaves an empty value to the required rule", async () => {
        const { context, fetchMock } = contextWith(async () => [], {
            _id: "drafts.project-homelab",
        });

        await expect(validateDesignation(undefined, context)).resolves.toBe(
            true,
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("featured slot uniqueness", () => {
    it("lets a draft keep the slot of its own published version", async () => {
        const { context, fetchMock } = contextWith(
            async () => [
                { _id: "project-homelab", title: "Homelab" },
                { _id: "drafts.project-homelab", title: "Homelab" },
            ],
            { _id: "drafts.project-homelab" },
        );

        await expect(validateFeaturedSlot(1, context)).resolves.toBe(true);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("featured == $featured"),
            { featured: 1 },
            { perspective: "raw" },
        );
    });

    it("warns when another mission, even a draft, holds the slot", async () => {
        const { context } = contextWith(
            async () => [{ _id: "drafts.project-website", title: "Website" }],
            { _id: "drafts.project-homelab" },
        );

        await expect(validateFeaturedSlot(1, context)).resolves.toBe(
            "Featured slot 1 is also set on “Website”. Each slot shows one mission: clear it there, or pick another slot.",
        );
    });

    it("checks nothing when the slot is empty", async () => {
        const { context, fetchMock } = contextWith(async () => [], {
            _id: "drafts.project-homelab",
        });

        await expect(validateFeaturedSlot(undefined, context)).resolves.toBe(
            true,
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("callout anchors", () => {
    const essay = [
        heading("a", "Why a rack"),
        heading("b", "Why a rack", "h3"),
        { _key: "p", _type: "block", style: "normal", children: [] },
    ];

    it("check an anchor without a post against this project's essay", async () => {
        const { context, fetchMock } = contextWith(
            async () => null,
            { _id: "drafts.project-homelab", body: essay },
            { heading: "why-a-rack-2" },
        );

        await expect(
            validateAnchorHeading("why-a-rack-2", context),
        ).resolves.toBe(true);
        await expect(
            validateAnchorHeading("tier-0-the-raspberry-pis", context),
        ).resolves.toEqual(expect.stringContaining("this project’s essay"));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("check an anchor with a post against that post as published", async () => {
        const { context, fetchMock } = contextWith(
            async () => ({
                body: [
                    heading("t0", "Tier 0: The Raspberry Pis"),
                    heading(
                        "net",
                        "Networking: Where Most of the Pain Actually Lives",
                    ),
                    heading("w", "Two Hundred Watts"),
                ],
            }),
            { _id: "drafts.project-homelab", body: essay },
            { post: { _type: "reference", _ref: "post-homelab" } },
        );

        await expect(
            validateAnchorHeading("tier-0-the-raspberry-pis", context),
        ).resolves.toBe(true);
        await expect(
            validateAnchorHeading(
                "networking-where-most-of-the-pain-actually-lives",
                context,
            ),
        ).resolves.toBe(true);
        await expect(
            validateAnchorHeading("why-a-rack", context),
        ).resolves.toEqual(expect.stringContaining("the linked post"));
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('_type == "post" && _id == $id'),
            { id: "post-homelab" },
            { perspective: "published" },
        );
    });

    it("asks for the linked post to be published first", async () => {
        const { context } = contextWith(
            async () => null,
            { _id: "drafts.project-homelab", body: essay },
            { post: { _type: "reference", _ref: "post-draft-only" } },
        );

        await expect(
            validateAnchorHeading("anything", context),
        ).resolves.toEqual(expect.stringContaining("not published"));
    });
});
