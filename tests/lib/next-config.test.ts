import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

async function remotePatterns() {
    vi.resetModules();
    const { default: config } = await import("@/next.config.mjs");
    return config.images?.remotePatterns ?? [];
}

describe("the image optimizer", () => {
    it("fetches only this project's and dataset's Sanity images, from the env", async () => {
        vi.stubEnv("NEXT_PUBLIC_STORE_SANITY_PROJECT_ID", "testproj");
        vi.stubEnv("NEXT_PUBLIC_STORE_SANITY_DATASET", "staging");
        expect(await remotePatterns()).toEqual([
            {
                protocol: "https",
                hostname: "cdn.sanity.io",
                pathname: "/images/testproj/staging/**",
            },
        ]);
    });

    it("matches lib/sanity-image.ts's defaults without the env", async () => {
        vi.stubEnv("NEXT_PUBLIC_STORE_SANITY_PROJECT_ID", "");
        vi.stubEnv("NEXT_PUBLIC_STORE_SANITY_DATASET", "");
        const [pattern] = await remotePatterns();
        expect(pattern).toMatchObject({
            pathname: "/images/fallback/production/**",
        });
    });
});
