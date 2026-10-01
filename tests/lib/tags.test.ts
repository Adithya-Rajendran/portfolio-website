import { describe, expect, it } from "vitest";
import {
    collectTags,
    filterPostsByTag,
    linkedTags,
    tagLabel,
} from "@/lib/tags";

describe("linkedTags", () => {
    it("keeps the tags that gather two or more entries, in order", () => {
        expect(
            linkedTags([
                { tag: "kubernetes", count: 3 },
                { tag: "homelab", count: 2 },
                { tag: "security", count: 1 },
            ]),
        ).toEqual([
            { tag: "kubernetes", count: 3 },
            { tag: "homelab", count: 2 },
        ]);
        expect(linkedTags([{ tag: "linux", count: 1 }])).toEqual([]);
    });
});

describe("tagLabel", () => {
    it("reads a tag as words: spaces, sentence case, acronyms in capitals", () => {
        expect(tagLabel("gpu-computing")).toBe("GPU computing");
        expect(tagLabel("homelab")).toBe("Homelab");
        expect(tagLabel("lxd")).toBe("LXD");
        expect(tagLabel("ai-infrastructure")).toBe("AI infrastructure");
        expect(tagLabel("nfs-and-oidc")).toBe("NFS and OIDC");
        expect(tagLabel("kubernetes-on-arm64")).toBe("Kubernetes on arm64");
    });
});

describe("collectTags", () => {
    it("counts tags across posts and sorts by count desc, then alpha", () => {
        const tags = collectTags([
            { tags: ["kubernetes", "homelab"] },
            { tags: ["kubernetes", "security"] },
            { tags: ["kubernetes", "homelab"] },
        ]);

        expect(tags).toEqual([
            { tag: "kubernetes", count: 3 },
            { tag: "homelab", count: 2 },
            { tag: "security", count: 1 },
        ]);
    });

    it("breaks count ties alphabetically", () => {
        const tags = collectTags([{ tags: ["zfs", "ansible"] }]);

        expect(tags.map((t) => t.tag)).toEqual(["ansible", "zfs"]);
    });

    it("ignores posts without tags (pre-taxonomy posts stay valid)", () => {
        const tags = collectTags([
            {},
            { tags: undefined },
            { tags: ["openstack"] },
        ]);

        expect(tags).toEqual([{ tag: "openstack", count: 1 }]);
    });

    it("drops tags that fail the slug-safe pattern", () => {
        const tags = collectTags([
            { tags: ["Valid-Not", "k8s", "spaces here", "ai-infra"] },
        ]);

        expect(tags.map((t) => t.tag)).toEqual(["ai-infra", "k8s"]);
    });
});

describe("filterPostsByTag", () => {
    it("matches the exact tag only", () => {
        const posts = [
            { tags: ["kubernetes"] },
            { tags: ["kubernetes-networking"] },
            { tags: undefined },
        ];

        expect(filterPostsByTag(posts, "kubernetes")).toEqual([
            { tags: ["kubernetes"] },
        ]);
    });
});
