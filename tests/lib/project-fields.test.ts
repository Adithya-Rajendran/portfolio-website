import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { formatMissionDesignation } from "@/lib/designations";
import {
    FIXTURE_PROJECTS,
    PROJECT_ESSAY_FIXTURE,
    resolveFixtureQuery,
} from "@/lib/fixtures";
import { extractHeadings } from "@/lib/headings";
import {
    checkAnchorHeading,
    checkDesignationUnique,
    checkParameterCount,
    checkRevisedAt,
    nextFreeDesignation,
    PROJECT_STATUSES,
} from "@/lib/project-fields";
import {
    POST_BY_SLUG_QUERY,
    POST_LIST_QUERY,
    POSTS_BY_PROJECT_QUERY,
    PROJECT_BY_SLUG_QUERY,
    PROJECT_LIST_QUERY,
    PROJECT_SLUGS_QUERY,
    PROJECT_SLUGS_WITH_DATES_QUERY,
    RECENT_POSTS_QUERY,
    type PostListItem,
    type PostMeta,
    type PostWithBody,
    type ProjectListItem,
    type ProjectWithBody,
} from "@/lib/sanity-client";
import { checkModelPart } from "@/lib/viewer/registry";
import type {
    POST_BY_SLUG_QUERY_RESULT,
    POST_LIST_QUERY_RESULT,
    POST_META_QUERY_RESULT,
    POSTS_BY_PROJECT_QUERY_RESULT,
    PROJECT_BY_SLUG_QUERY_RESULT,
    PROJECT_LIST_QUERY_RESULT,
    RECENT_POSTS_QUERY_RESULT,
} from "@/sanity.types";

// The query strings are read, never fetched: keep the server-only client out.
vi.mock("@/lib/sanity-config", () => ({
    client: {},
    isSanityConfigured: false,
}));

describe("mission numbers", () => {
    it("offers one after the highest number in use", () => {
        expect(nextFreeDesignation([])).toBe(1);
        expect(nextFreeDesignation([1, 2, 4])).toBe(5);
        expect(nextFreeDesignation([3, null, undefined, 2.5, 0, 120])).toBe(4);
    });

    it("falls back to the lowest free number once MSN-99 is taken", () => {
        expect(nextFreeDesignation([1, 99])).toBe(2);
        const all = Array.from({ length: 99 }, (_, index) => index + 1);
        expect(nextFreeDesignation(all)).toBeUndefined();
    });

    it("formats the stored number with two digits", () => {
        expect(formatMissionDesignation(2)).toBe("MSN-02");
        expect(formatMissionDesignation(12)).toBe("MSN-12");
    });

    it("lets a draft keep the number of its own published version", () => {
        // Holders carry published ids, so drafts.project-a and project-a
        // are the same project.
        expect(
            checkDesignationUnique(2, "project-a", [{ id: "project-a" }]),
        ).toBe(true);
        expect(checkDesignationUnique(2, "project-a", [])).toBe(true);
    });

    it("rejects a number another project already uses", () => {
        expect(
            checkDesignationUnique(2, "project-b", [
                { id: "project-a", title: "Homelab" },
                { id: "project-b" },
            ]),
        ).toBe("MSN-02 is already used by “Homelab”. Pick another number.");
        expect(
            checkDesignationUnique(7, undefined, [{ id: "project-a" }]),
        ).toEqual(expect.stringContaining("another project"));
    });
});

describe("project and post rules", () => {
    it("warns about a parameter row with fewer than three items", () => {
        expect(checkParameterCount(undefined)).toBe(true);
        expect(checkParameterCount([])).toBe(true);
        expect(checkParameterCount([{}])).toEqual(expect.any(String));
        expect(checkParameterCount([{}, {}])).toEqual(expect.any(String));
        expect(checkParameterCount([{}, {}, {}])).toBe(true);
    });

    it("keeps a revision on or after the publication date", () => {
        expect(checkRevisedAt("2026-03-30", "2026-03-29")).toEqual(
            expect.any(String),
        );
        expect(checkRevisedAt("2026-03-30", "2026-03-30")).toBe(true);
        expect(checkRevisedAt("2026-03-30", "2026-04-02")).toBe(true);
        expect(checkRevisedAt(undefined, "2026-04-02")).toBe(true);
        expect(checkRevisedAt("2026-03-30", undefined)).toBe(true);
    });

    it("accepts a callout anchor only when the heading id exists", () => {
        const ids = ["tier-0-the-raspberry-pis", "two-hundred-watts"];
        expect(checkAnchorHeading("two-hundred-watts", ids, "the post")).toBe(
            true,
        );
        expect(checkAnchorHeading(undefined, ids, "the post")).toBe(true);
        expect(
            checkAnchorHeading("Two Hundred Watts", ids, "the linked post"),
        ).toBe(
            "No heading in the linked post has the id “Two Hundred Watts”. Use one of: tier-0-the-raspberry-pis, two-hundred-watts.",
        );
        expect(checkAnchorHeading("intro", [], "this project’s essay")).toBe(
            "This project’s essay has no headings (h2 to h4) to link to.",
        );
    });

    it("keeps Studio labels for every status, including planned and stopped", () => {
        expect(PROJECT_STATUSES.map((status) => status.value)).toEqual([
            "active",
            "completed",
            "paused",
            "archived",
            "planned",
            "stopped",
        ]);
    });
});

describe("query results", () => {
    it("match the hand-written project types", () => {
        // Fails `pnpm typecheck` when a query, the schema or the site's
        // types drift apart.
        expectTypeOf<
            PROJECT_LIST_QUERY_RESULT[number]
        >().toExtend<ProjectListItem>();
        expectTypeOf<
            NonNullable<PROJECT_BY_SLUG_QUERY_RESULT>
        >().toExtend<ProjectWithBody>();
    });

    it("match the hand-written post types", () => {
        expectTypeOf<POST_LIST_QUERY_RESULT[number]>().toExtend<PostListItem>();
        expectTypeOf<
            POSTS_BY_PROJECT_QUERY_RESULT[number]
        >().toExtend<PostListItem>();
        expectTypeOf<
            RECENT_POSTS_QUERY_RESULT[number]
        >().toExtend<PostWithBody>();
        expectTypeOf<
            NonNullable<POST_BY_SLUG_QUERY_RESULT>
        >().toExtend<PostWithBody>();
        expectTypeOf<
            NonNullable<POST_META_QUERY_RESULT>
        >().toExtend<PostMeta>();
    });
});

describe("fixture projects", () => {
    const params = { today: "2026-09-28" };

    it("list only the fixture projects, without their essays", () => {
        const list = resolveFixtureQuery<ProjectListItem[]>(
            PROJECT_LIST_QUERY,
            params,
        );
        expect(list?.map((project) => project.slug)).toEqual(
            FIXTURE_PROJECTS.map((project) => project.slug),
        );
        expect(list?.some((project) => "body" in project)).toBe(false);
        expect(
            resolveFixtureQuery<string[]>(PROJECT_SLUGS_QUERY, params),
        ).not.toContain(PROJECT_ESSAY_FIXTURE.slug);
        expect(
            resolveFixtureQuery<{ slug: string }[]>(
                PROJECT_SLUGS_WITH_DATES_QUERY,
                params,
            )?.map(({ slug }) => slug),
        ).toEqual(FIXTURE_PROJECTS.map((project) => project.slug));
    });

    it("resolve every project page, including the renderer fixture", () => {
        for (const project of [...FIXTURE_PROJECTS, PROJECT_ESSAY_FIXTURE]) {
            expect(
                resolveFixtureQuery<ProjectWithBody>(PROJECT_BY_SLUG_QUERY, {
                    ...params,
                    slug: project.slug,
                })?._id,
            ).toBe(project._id);
        }
        expect(
            resolveFixtureQuery(PROJECT_BY_SLUG_QUERY, {
                ...params,
                slug: "missing",
            }),
        ).toBeNull();
    });

    it("use unique mission numbers and listed statuses", () => {
        const numbers = FIXTURE_PROJECTS.map((project) => project.designation);
        expect(new Set(numbers).size).toBe(numbers.length);
        for (const project of FIXTURE_PROJECTS) {
            expect(PROJECT_STATUSES.map((status) => status.value)).toContain(
                project.status,
            );
        }
    });

    it("anchor every callout to a heading that exists", () => {
        const posts = resolveFixtureQuery<PostWithBody[]>(
            RECENT_POSTS_QUERY,
            params,
        );
        for (const project of FIXTURE_PROJECTS) {
            for (const hotspot of project.model?.hotspots ?? []) {
                expect(
                    checkModelPart(
                        project.model?.procedural ?? undefined,
                        hotspot.part ?? undefined,
                    ),
                ).toBe(true);
                const anchor = hotspot.anchor;
                if (!anchor) continue;
                const source = anchor.postId
                    ? posts?.find((post) => post._id === anchor.postId)
                    : project;
                expect(source, hotspot._key).toBeDefined();
                expect(
                    checkAnchorHeading(
                        anchor.heading,
                        extractHeadings(source ?? {}).map(({ id }) => id),
                        hotspot._key,
                    ),
                ).toBe(true);
            }
        }
    });

    it("list a post among its project's Flight Log entries", () => {
        const entries = resolveFixtureQuery<PostListItem[]>(
            POSTS_BY_PROJECT_QUERY,
            { ...params, projectId: "fixture-project-flagship" },
        );
        expect(entries?.map((post) => post._id)).toEqual(["fixture-post-1"]);
        expect(entries?.some((post) => "body" in post)).toBe(false);
        expect(
            resolveFixtureQuery<PostListItem[]>(POSTS_BY_PROJECT_QUERY, {
                ...params,
                projectId: "fixture-project-planned",
            }),
        ).toEqual([]);
    });

    it("publish no email address or phone number", () => {
        const text = JSON.stringify([FIXTURE_PROJECTS, PROJECT_ESSAY_FIXTURE]);
        expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
        expect(text).not.toMatch(/mailto:|tel:/i);
    });
});

describe("post fixture queries", () => {
    it("keep the plain post list separate from the body queries", () => {
        const list = resolveFixtureQuery<PostListItem[]>(POST_LIST_QUERY, {
            today: "2026-09-28",
        });
        expect(list?.length).toBeGreaterThan(0);
        expect(list?.some((post) => "body" in post)).toBe(false);
        expect(
            resolveFixtureQuery<PostWithBody>(POST_BY_SLUG_QUERY, {
                today: "2026-09-28",
                slug: "small-kubernetes-cluster-notes",
            })?.projectIds,
        ).toEqual(["fixture-project-flagship"]);
    });
});
