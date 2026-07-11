import { describe, expect, it } from "vitest";
import { classifyMediaEmbed } from "@/lib/media-embed";

describe("classifyMediaEmbed", () => {
    it("converts YouTube watch and short URLs to privacy-enhanced embeds", () => {
        expect(
            classifyMediaEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        ).toMatchObject({
            kind: "video",
            provider: "youtube",
            embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        });
        expect(
            classifyMediaEmbed("https://youtu.be/dQw4w9WgXcQ"),
        ).toMatchObject({
            kind: "video",
            provider: "youtube",
            embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        });
    });

    it("converts Vimeo URLs to player embeds", () => {
        expect(classifyMediaEmbed("https://vimeo.com/76979871")).toMatchObject({
            kind: "video",
            provider: "vimeo",
            embedUrl: "https://player.vimeo.com/video/76979871",
        });
    });

    it("returns a link target for an arbitrary HTTP provider", () => {
        expect(
            classifyMediaEmbed("https://example.com/watch/a-documentary"),
        ).toEqual({
            kind: "link",
            href: "https://example.com/watch/a-documentary",
            hostname: "example.com",
        });
    });

    it("does not iframe provider lookalikes or malformed provider URLs", () => {
        expect(
            classifyMediaEmbed(
                "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
            ),
        ).toMatchObject({ kind: "link" });
        expect(
            classifyMediaEmbed("https://youtube.com/watch?v=not-a-video-id"),
        ).toMatchObject({ kind: "link" });
    });

    it("rejects invalid and non-HTTP URLs", () => {
        expect(classifyMediaEmbed("not a url")).toBeNull();
        expect(classifyMediaEmbed("javascript:alert(1)")).toBeNull();
        expect(classifyMediaEmbed(undefined)).toBeNull();
    });
});
