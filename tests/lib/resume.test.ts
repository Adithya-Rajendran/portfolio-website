import { describe, expect, it } from "vitest";
import { RESUME_FILENAME, resolveResumeAssetUrl } from "@/lib/resume";

const asset =
    "https://cdn.sanity.io/files/example/production/abc123.pdf?dl=old-name.pdf&token=kept";

describe("resolveResumeAssetUrl", () => {
    it("builds a native-viewing URL without the download flag", () => {
        const result = new URL(resolveResumeAssetUrl(asset, "view")!);

        expect(result.hostname).toBe("cdn.sanity.io");
        expect(result.searchParams.has("dl")).toBe(false);
        expect(result.searchParams.get("token")).toBe("kept");
    });

    it("builds a download URL with a stable filename", () => {
        const result = new URL(resolveResumeAssetUrl(asset, "download")!);

        expect(result.searchParams.get("dl")).toBe(RESUME_FILENAME);
        expect(result.searchParams.get("token")).toBe("kept");
    });

    it.each([
        undefined,
        null,
        "",
        "not a URL",
        "http://cdn.sanity.io/files/example/production/resume.pdf",
        "https://cdn.sanity.io.evil.example/files/example/resume.pdf",
        "https://cdn.sanity.io/images/example/production/resume.pdf",
        "https://cdn.sanity.io/files/example/production/resume.docx",
    ])("rejects unsafe or non-PDF input: %s", (value) => {
        expect(resolveResumeAssetUrl(value, "view")).toBeNull();
    });

    it("removes fragments before redirecting", () => {
        const result = new URL(
            resolveResumeAssetUrl(
                "https://cdn.sanity.io/files/example/production/resume.pdf#page=2",
                "view",
            )!,
        );

        expect(result.hash).toBe("");
    });
});
