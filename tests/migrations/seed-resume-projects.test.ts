import { describe, expect, it } from "vitest";
import {
    createSchema,
    defineField,
    defineType,
    validateDocument,
    type SanityDocument,
} from "sanity";
import {
    collectMigrationMutations,
    type MigrationContext,
} from "sanity/migrate";
import { formatProjectYears } from "@/lib/project-content";
import { PROCEDURAL_MODELS } from "@/lib/viewer/registry";
import migration from "@/migrations/seed-resume-projects";
import {
    buildSeedDraft,
    planSeed,
    publishedPosts,
    type SeedDraft,
    type StoredDocument,
} from "@/migrations/seed-resume-projects/build";
import { SEED_PROJECTS } from "@/migrations/seed-resume-projects/data";
import { schemaTypes } from "@/sanity/schemas";

const RACK_ASSET =
    "image-05754647a9226f0938def18645edaef5169c8aec-3000x4000-jpg";

/** The published homelab post's h2 headings (design/shared/content-real.js). */
const HOMELAB_HEADINGS = [
    "The Bootstrap Problem",
    "Tier 0: The Raspberry Pis",
    "Tier 1: The Dell Inspiron",
    "Tier 2: The MS-01s",
    "Networking: Where Most of the Pain Actually Lives",
    "What Lives Outside the Cluster: NAS and the GPU Tier",
    "What “Production” Would Actually Mean",
    "Two Hundred Watts",
];

function block(key: string, text: string, style = "normal") {
    return {
        _key: key,
        _type: "block",
        style,
        markDefs: [],
        children: [{ _key: `${key}s`, _type: "span", text, marks: [] }],
    };
}

/** A stand-in for the published `my-homelab` post: headings and rack photo. */
function homelabPost(
    headings: readonly string[] = HOMELAB_HEADINGS,
    asset = RACK_ASSET,
): StoredDocument {
    return {
        _id: "homelab-post",
        _type: "post",
        title: "A Homelab Built to Be Rebuilt",
        slug: { _type: "slug", current: "my-homelab" },
        body: [
            block("intro", "I wanted a homelab…"),
            ...headings.map((text, index) => block(`h${index}`, text, "h2")),
            {
                _key: "rack",
                _type: "image",
                asset: { _type: "reference", _ref: asset },
                alt: "Server rack with three Minisforum MS-01 systems and an ASUS Ascent.",
            },
        ],
    };
}

function draftFor(plan: { drafts: SeedDraft[] }, slug: string) {
    const draft = plan.drafts.find((item) => item.slug.current === slug);
    if (!draft) throw new Error(`no draft for ${slug}`);
    return draft;
}

// ---------------------------------------------------------------------------
// Sanity's own validation, against the repository schema. `code` comes from
// the @sanity/code-input plugin in the Studio; a stub stands in for it here.
// ---------------------------------------------------------------------------

const codeStub = defineType({
    name: "code",
    title: "Code",
    type: "object",
    fields: [
        defineField({ name: "code", type: "text" }),
        defineField({ name: "language", type: "string" }),
        defineField({ name: "filename", type: "string" }),
    ],
});

const schema = createSchema({
    name: "seed-test",
    types: [...schemaTypes, codeStub],
});

/**
 * A client for the Studio-only rules: no other project holds a mission
 * number, featured slot or slug, and the linked post is the homelab
 * stand-in.
 */
function validationClient(
    post: StoredDocument | null,
    featuredHolders: { _id: string; title: string }[] = [],
) {
    const fetch = async (query: string) => {
        if (query.includes("designation == $designation")) return [];
        if (query.includes("featured == $featured")) return featuredHolders;
        if (query.includes('_type == "post" && _id == $id')) {
            return post ? { body: post.body } : null;
        }
        // The slug type's own check: `!defined(…)` is true when it is free.
        if (query.startsWith("!defined(")) return true;
        throw new Error(`unexpected validation query: ${query}`);
    };
    const client = {
        fetch,
        getDataUrl: () => "",
        observable: {},
        withConfig: () => client,
        config: () => ({}),
    };
    return client;
}

type ValidationOptions = Parameters<typeof validateDocument>[0];

async function validate(
    draft: SeedDraft,
    post: StoredDocument | null,
    featuredHolders?: { _id: string; title: string }[],
) {
    const client = validationClient(post, featuredHolders);
    const markers = await validateDocument({
        document: draft as unknown as SanityDocument,
        // `i18n` is left out: validation then uses its built-in messages.
        workspace: {
            schema,
            getClient: () => client,
        } as unknown as ValidationOptions["workspace"],
        environment: "cli",
        getDocumentExists: async () => true,
    });
    return markers.map((marker) => ({
        level: marker.level,
        path: JSON.stringify(marker.path),
        message: marker.message,
    }));
}

async function runMigration(documents: StoredDocument[]) {
    const context = { dryRun: true } as unknown as MigrationContext;
    const iterate = async function* () {
        for (const document of documents) yield document;
    };
    const batches: unknown[] = [];
    for await (const batch of collectMigrationMutations(
        migration,
        iterate as Parameters<typeof collectMigrationMutations>[1],
        context,
    )) {
        batches.push(batch);
    }
    return batches.flat() as {
        type: string;
        mutations: { type: string; document: SeedDraft }[];
    }[];
}

describe("seed-resume-projects drafts", () => {
    const plan = planSeed([homelabPost()], SEED_PROJECTS);

    it("drafts the four résumé projects, numbered in the résumé's order", () => {
        expect(plan.skipped).toEqual([]);
        expect(plan.notes).toEqual([]);
        expect(
            plan.drafts.map((draft) => [
                draft._id,
                draft.designation,
                draft.slug.current,
            ]),
        ).toEqual([
            ["drafts.project-gmail-spam-filter", 1, "gmail-spam-filter"],
            ["drafts.project-homelab", 2, "homelab"],
            ["drafts.project-kubernetes-cluster", 3, "kubernetes-cluster"],
            ["drafts.project-personal-website", 4, "personal-website"],
        ]);
    });

    it("records the owner's statuses and estimated years", () => {
        const byStatus = Object.fromEntries(
            plan.drafts.map((draft) => [draft.slug.current, draft.status]),
        );
        expect(byStatus).toEqual({
            "gmail-spam-filter": "completed",
            homelab: "active",
            "kubernetes-cluster": "completed",
            "personal-website": "active",
        });

        const years = plan.drafts.map((draft) => [
            draft.slug.current,
            formatProjectYears(draft),
            draft.datePrecision ?? null,
        ]);
        expect(years).toEqual([
            ["gmail-spam-filter", "c. 2023", "year"],
            // No start date is published for the homelab or the website.
            ["homelab", null, null],
            ["kubernetes-cluster", "c. 2024–2025", "year"],
            ["personal-website", null, null],
        ]);
    });

    it("passes the Studio's validation, so every draft can be published", async () => {
        for (const draft of plan.drafts) {
            expect(
                await validate(draft, homelabPost()),
                draft.slug.current,
            ).toEqual([]);
        }
    });

    it("would catch a draft that breaks the schema (control)", async () => {
        const gmail = draftFor(plan, "gmail-spam-filter");
        const broken = {
            ...gmail,
            summary: "x".repeat(301),
            types: ["robotics"],
            highlights: [],
        } as unknown as SeedDraft;
        const paths = (await validate(broken, homelabPost()))
            .filter((marker) => marker.level === "error")
            .map((marker) => marker.path);
        expect(paths).toEqual(
            expect.arrayContaining([
                '["summary"]',
                '["highlights"]',
                expect.stringContaining('"types"'),
            ]),
        );

        // A callout whose heading the linked post lacks is rejected too.
        const homelab = draftFor(plan, "homelab");
        const markers = await validate(
            homelab,
            homelabPost(["The Bootstrap Problem"]),
        );
        expect(
            markers.filter((marker) => marker.level === "error"),
        ).toHaveLength(5);
    });

    it("makes the homelab the flagship, with the rack photo from its post as the model poster", () => {
        const homelab = draftFor(plan, "homelab");
        expect(homelab.featured).toBe(1);
        expect(plan.drafts.filter((draft) => draft.featured)).toHaveLength(1);
        expect(homelab.model?.poster.asset?._ref).toBe(RACK_ASSET);
        expect(homelab.model?.poster.alt).toBe(
            "Server rack with three Minisforum MS-01 systems and an ASUS Ascent.",
        );
    });

    it("leaves every cover for the owner to pick", () => {
        // The current project page prints a cover uncropped above the
        // essay; the owner chooses it in the Studio before publishing.
        expect(plan.drafts.map((draft) => draft.cover)).toEqual([
            undefined,
            undefined,
            undefined,
            undefined,
        ]);
    });

    it("seeds only measured values as results", () => {
        expect(
            draftFor(plan, "homelab").results?.map((result) => result.value),
        ).toEqual(["195.1 W", "3", "0.4 ms", "1"]);
    });

    it("warns, without blocking publishing, when another mission holds its featured slot", async () => {
        const markers = await validate(
            draftFor(plan, "homelab"),
            homelabPost(),
            [{ _id: "drafts.project-other", title: "Other mission" }],
        );
        expect(markers).toEqual([
            {
                level: "warning",
                path: '["featured"]',
                message:
                    "Featured slot 1 is also set on “Other mission”. Each slot shows one mission: clear it there, or pick another slot.",
            },
        ]);
    });

    it("puts a callout on every rack part, linked to its homelab post section", () => {
        const model = draftFor(plan, "homelab").model;
        const rack = PROCEDURAL_MODELS.find(
            (item) => item.key === "homelab-rack",
        );
        expect(model?.procedural).toBe("homelab-rack");
        expect(model?.realWorld).toEqual({
            dimension: "height",
            value: 12,
            unit: "U",
        });
        expect(model?.hotspots?.map((hotspot) => hotspot.part)).toEqual(
            rack?.parts.map((part) => part.key),
        );
        for (const hotspot of model?.hotspots ?? []) {
            expect(hotspot.anchor?.post).toEqual({
                _type: "reference",
                _ref: "homelab-post",
                _weak: true,
            });
        }
        // Owner, 2026-09-28: the ASUS Ascent is the DGX Spark.
        const ascent = model?.hotspots?.find((item) => item.part === "ascent");
        expect(ascent?.body).toContain(
            "The ASUS Ascent in the rack is the NVIDIA DGX Spark",
        );
    });

    it("links the essays with contentLink annotations", () => {
        const homelab = draftFor(plan, "homelab");
        const hrefs = homelab.body.flatMap((item) =>
            item._type === "block"
                ? (item.markDefs ?? []).map((mark) => mark.href)
                : [],
        );
        expect(hrefs).toEqual([
            "/blog/kubernetes-on-the-nvidia-dgx-spark",
            "/blog/my-homelab",
        ]);
        for (const draft of plan.drafts) {
            for (const item of draft.body) {
                if (item._type !== "block") continue;
                for (const mark of item.markDefs ?? []) {
                    expect(mark._type).toBe("contentLink");
                    expect(
                        item.children?.some((span) =>
                            span.marks?.includes(mark._key),
                        ),
                    ).toBe(true);
                }
            }
        }
    });

    it("keeps the résumé's repository links", () => {
        const repos = plan.drafts.flatMap((draft) =>
            (draft.links ?? [])
                .filter((link) => link.kind === "repo")
                .map((link) => link.url),
        );
        expect(repos).toEqual([
            "https://github.com/Adithya-Rajendran/Gmail-Filter",
            "https://github.com/Adithya-Rajendran/portfolio-website",
        ]);
    });

    it("publishes no email address or phone number", () => {
        const text = JSON.stringify([SEED_PROJECTS, plan.drafts]);
        expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
        expect(text).not.toMatch(/mailto:|tel:/i);
        expect(text).not.toMatch(/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/);
    });
});

describe("seed-resume-projects without the homelab post's content", () => {
    it("leaves out the model when the rack photo is gone", async () => {
        const { draft, notes } = buildSeedDraft(
            SEED_PROJECTS[1],
            publishedPosts([homelabPost(HOMELAB_HEADINGS, "image-other-jpg")]),
        );
        expect(draft.model).toBeUndefined();
        expect(notes).toHaveLength(1);
        expect(await validate(draft, null)).toEqual([]);
    });

    it("drops a callout's link when its heading no longer exists", async () => {
        const post = homelabPost(
            HOMELAB_HEADINGS.filter((text) => text !== "Two Hundred Watts"),
        );
        const { draft, notes } = buildSeedDraft(
            SEED_PROJECTS[1],
            publishedPosts([post]),
        );
        const power = draft.model?.hotspots?.find(
            (item) => item.part === "power",
        );
        expect(power?.anchor).toBeUndefined();
        expect(notes).toEqual([
            expect.stringContaining("no heading “two-hundred-watts”"),
        ]);
        expect(await validate(draft, post)).toEqual([]);
    });

    it("ignores drafts of the post: anchors follow the published post", () => {
        const draftPost = { ...homelabPost(), _id: "drafts.homelab-post" };
        const { draft } = buildSeedDraft(
            SEED_PROJECTS[1],
            publishedPosts([draftPost]),
        );
        expect(draft.model).toBeUndefined();
    });
});

describe("seed-resume-projects skip-if-exists", () => {
    const post = homelabPost();
    const slugs = (documents: StoredDocument[]) =>
        planSeed([post, ...documents], SEED_PROJECTS).drafts.map(
            (draft) => draft.slug.current,
        );

    it("skips a project that is already published", () => {
        const plan = planSeed(
            [post, { _id: "project-homelab", _type: "project" }],
            SEED_PROJECTS,
        );
        expect(plan.skipped).toEqual([
            { slug: "homelab", reason: "project-homelab already exists" },
        ]);
        expect(plan.drafts.map((draft) => draft.slug.current)).toEqual([
            "gmail-spam-filter",
            "kubernetes-cluster",
            "personal-website",
        ]);
    });

    it("skips a project with a draft or a release version", () => {
        expect(
            slugs([
                {
                    _id: "drafts.project-gmail-spam-filter",
                    _type: "project",
                },
                {
                    _id: "versions.rLaunch.project-kubernetes-cluster",
                    _type: "project",
                },
            ]),
        ).toEqual(["homelab", "personal-website"]);
    });

    it("skips a project whose slug another project already uses", () => {
        const plan = planSeed(
            [
                post,
                {
                    _id: "8f0c2d8e",
                    _type: "project",
                    slug: { _type: "slug", current: "personal-website" },
                },
            ],
            SEED_PROJECTS,
        );
        expect(plan.skipped).toEqual([
            {
                slug: "personal-website",
                reason: "8f0c2d8e already uses the slug “personal-website”",
            },
        ]);
    });

    it("reports a mission number another project holds, without changing it", () => {
        const plan = planSeed(
            [post, { _id: "abc", _type: "project", designation: 3 }],
            SEED_PROJECTS,
        );
        expect(draftFor(plan, "kubernetes-cluster").designation).toBe(3);
        expect(plan.notes).toEqual([
            "kubernetes-cluster: MSN-03 is already used by abc. Renumber one of them in the Studio before publishing.",
        ]);
    });

    it("creates the drafts in one transaction, and nothing on a second run", async () => {
        const [first, ...rest] = await runMigration([post]);
        expect(rest).toEqual([]);
        expect(first.type).toBe("transaction");
        expect(
            first.mutations.map((mutation) => [
                mutation.type,
                mutation.document._id,
            ]),
        ).toEqual([
            ["createIfNotExists", "drafts.project-gmail-spam-filter"],
            ["createIfNotExists", "drafts.project-homelab"],
            ["createIfNotExists", "drafts.project-kubernetes-cluster"],
            ["createIfNotExists", "drafts.project-personal-website"],
        ]);

        // The second run sees the drafts it created (or, once the owner has
        // published them, the published projects) and writes nothing.
        const created = first.mutations.map(
            (mutation) => mutation.document as unknown as StoredDocument,
        );
        expect(await runMigration([post, ...created])).toEqual([]);
        const published = created.map((document) => ({
            ...document,
            _id: document._id.replace(/^drafts\./, ""),
        }));
        expect(await runMigration([post, ...published])).toEqual([]);
    });
});
