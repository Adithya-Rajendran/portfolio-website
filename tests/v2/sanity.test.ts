import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
    env: { SANITY_PROJECT_ID: "projectid", SANITY_DATASET: "production" },
    fetch: vi.fn(),
    createClient: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: mocks.env }));
vi.mock("@sanity/client", () => ({
    createClient: mocks.createClient.mockReturnValue({ fetch: mocks.fetch }),
}));
import {
    getPostBySlug,
    getAllPosts,
    POST_BY_SLUG_QUERY,
    POST_LIST_QUERY,
} from "../../src/lib/sanity";

beforeEach(() => {
    mocks.fetch.mockReset();
});
describe("published content reads", () => {
    it("filters future posts in list and detail queries and supplies today", async () => {
        mocks.fetch.mockResolvedValue([]);
        await getAllPosts();
        expect(POST_LIST_QUERY).toMatch(/publishedAt\s*<=\s*\$today/);
        expect(mocks.fetch).toHaveBeenCalledWith(
            POST_LIST_QUERY,
            expect.objectContaining({
                today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            }),
        );
        mocks.fetch.mockResolvedValue(null);
        await expect(getPostBySlug("missing")).resolves.toBeNull();
        expect(POST_BY_SLUG_QUERY).toMatch(/publishedAt\s*<=\s*\$today/);
        expect(mocks.fetch).toHaveBeenLastCalledWith(
            POST_BY_SLUG_QUERY,
            expect.objectContaining({ slug: "missing" }),
        );
    });
    it("propagates upstream failure instead of turning it into missing content", async () => {
        mocks.fetch.mockRejectedValue(new Error("upstream failure"));
        let failure: unknown;
        try {
            await getPostBySlug("existing");
        } catch (error) {
            failure = error;
        }
        expect(failure).toEqual(new Error("upstream failure"));
    });
});
