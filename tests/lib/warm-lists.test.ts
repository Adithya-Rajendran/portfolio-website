import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWarmLists, WARM_LISTS_QUERY } from "@/lib/sanity-client";

const { fetchMock, withConfigMock } = vi.hoisted(() => {
    const fetchMock = vi.fn();
    return {
        fetchMock,
        withConfigMock: vi.fn(() => ({ fetch: fetchMock })),
    };
});

vi.mock("@/lib/sanity-config", () => ({
    client: { withConfig: withConfigMock, fetch: vi.fn() },
    isSanityConfigured: true,
}));

beforeEach(() => {
    fetchMock.mockReset();
    withConfigMock.mockClear();
});

describe("getWarmLists", () => {
    it("reads the published lists uncached from the live API", async () => {
        fetchMock.mockResolvedValue({
            posts: [
                { slug: "fresh-post", tags: ["robotics"] },
                { slug: "untagged", tags: null },
            ],
            projectSlugs: ["homelab"],
        });

        await expect(getWarmLists()).resolves.toEqual({
            posts: [
                { slug: "fresh-post", tags: ["robotics"] },
                { slug: "untagged", tags: [] },
            ],
            projectSlugs: ["homelab"],
        });
        // Not the Sanity CDN, and not the Next.js data cache that was just
        // revalidated: a post published a moment ago is in the list.
        expect(withConfigMock).toHaveBeenCalledWith({ useCdn: false });
        expect(fetchMock).toHaveBeenCalledWith(WARM_LISTS_QUERY, {
            today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        });
        // The same visibility gate as the pages.
        expect(WARM_LISTS_QUERY).toContain("publishedAt <= $today");
    });

    it("returns empty lists when the dataset has none", async () => {
        fetchMock.mockResolvedValue(null);
        await expect(getWarmLists()).resolves.toEqual({
            posts: [],
            projectSlugs: [],
        });
    });
});
