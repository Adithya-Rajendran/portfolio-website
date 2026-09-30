import { describe, expect, it } from "vitest";
import { profileRows } from "@/lib/directory";
import { FIXTURE_PROFILE } from "@/lib/fixtures";

describe("profileRows", () => {
    it("lists the profile's web links with their addresses", () => {
        const rows = profileRows({
            ...FIXTURE_PROFILE,
            socialLinks: [
                {
                    _key: "gh",
                    label: "GitHub",
                    url: "https://github.com/example/",
                },
                {
                    _key: "li",
                    label: "LinkedIn",
                    url: "https://www.linkedin.com/in/example",
                },
                { _key: "x", label: "Other", url: "ftp://example.com" },
            ],
        });
        expect(rows).toEqual([
            {
                key: "gh",
                href: "https://github.com/example/",
                plain: "GitHub",
                blurb: "github.com/example",
                external: true,
            },
            {
                key: "li",
                href: "https://www.linkedin.com/in/example",
                plain: "LinkedIn",
                blurb: "linkedin.com/in/example",
                external: true,
            },
        ]);
    });
});
