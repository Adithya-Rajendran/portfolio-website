import { describe, expect, it } from "vitest";
import { BREAKPOINTS, maxWidth, minWidth } from "@/lib/breakpoints";

const KEYS = Object.keys(BREAKPOINTS) as (keyof typeof BREAKPOINTS)[];

describe("minWidth", () => {
    it("names the breakpoint's own value", () => {
        expect(minWidth("sm")).toBe("(min-width: 37.5rem)");
        expect(minWidth("tablet")).toBe("(min-width: 48rem)");
        expect(minWidth("md")).toBe("(min-width: 60rem)");
        expect(minWidth("lg")).toBe("(min-width: 80rem)");
    });
});

describe("maxWidth", () => {
    it("names 0.01rem under the breakpoint, as the stylesheets do", () => {
        expect(maxWidth("sm")).toBe("(max-width: 37.49rem)");
        expect(maxWidth("tablet")).toBe("(max-width: 47.99rem)");
        expect(maxWidth("md")).toBe("(max-width: 59.99rem)");
        expect(maxWidth("compact")).toBe("(max-width: 22.49rem)");
    });

    it("leaves no float noise in any breakpoint", () => {
        for (const key of KEYS)
            expect(maxWidth(key)).toMatch(
                /^\(max-width: \d+(\.\d{1,2})?rem\)$/,
            );
    });

    it("meets minWidth with no width matching both", () => {
        for (const key of KEYS) {
            const min = Number(/[\d.]+/.exec(minWidth(key))?.[0]);
            const max = Number(/[\d.]+/.exec(maxWidth(key))?.[0]);
            expect(min - max).toBeCloseTo(0.01, 5);
        }
    });
});
