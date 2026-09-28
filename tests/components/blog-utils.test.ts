import { describe, expect, it } from "vitest";
import { codeListingLabel, numberCodeListings } from "@/components/blogs/utils";

describe("code listing labels", () => {
    it("numbers listings in reading order by block key", () => {
        expect(
            numberCodeListings([{ _key: "x" }, { _key: "y" }, { _key: "z" }]),
        ).toEqual({ x: 1, y: 2, z: 3 });
    });

    it("gives listings with the same language distinct names", () => {
        const numbers = numberCodeListings([{ _key: "a" }, { _key: "b" }]);
        const labels = ["a", "b"].map((key) =>
            codeListingLabel({ number: numbers[key], language: "bash" }),
        );

        expect(labels).toEqual([
            "Code listing 1 (bash)",
            "Code listing 2 (bash)",
        ]);
    });

    it("includes the filename when there is one", () => {
        expect(
            codeListingLabel({
                number: 3,
                language: "bash",
                filename: "install.sh",
            }),
        ).toBe("Code listing 3 (bash, install.sh)");
        expect(codeListingLabel({ number: 4 })).toBe("Code listing 4");
    });
});
