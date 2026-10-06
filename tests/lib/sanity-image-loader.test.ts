import { describe, expect, it } from "vitest";
import sanityImageLoader from "@/lib/sanity-image-loader";

const SRC =
    "https://cdn.sanity.io/images/project/dataset/abc-3000x4000.jpg?w=1200&fit=max&auto=format";

describe("sanityImageLoader", () => {
    it("asks Sanity's CDN for each srcset width, once encoded", () => {
        const url = new URL(sanityImageLoader({ src: SRC, width: 640 }));
        expect(url.origin + url.pathname).toBe(
            "https://cdn.sanity.io/images/project/dataset/abc-3000x4000.jpg",
        );
        expect(url.searchParams.getAll("w")).toEqual(["640"]);
        expect(url.searchParams.get("q")).toBe("75");
        expect(url.searchParams.get("fit")).toBe("max");
        expect(url.searchParams.get("auto")).toBe("format");
    });

    it("never asks for more than the widest file the plate requested", () => {
        const url = new URL(sanityImageLoader({ src: SRC, width: 2048 }));
        expect(url.searchParams.getAll("w")).toEqual(["1200"]);
    });

    it("keeps the quality asked for", () => {
        const url = new URL(
            sanityImageLoader({ src: SRC, width: 828, quality: 90 }),
        );
        expect(url.searchParams.get("q")).toBe("90");
    });

    it("returns any other source as given", () => {
        expect(sanityImageLoader({ src: "/images/a.jpg", width: 640 })).toBe(
            "/images/a.jpg",
        );
    });
});
