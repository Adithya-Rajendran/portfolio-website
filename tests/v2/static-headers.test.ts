import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Rule = { pattern: string; headers: Map<string, string> };

function parse(text: string): Rule[] {
    const rules: Rule[] = [];
    for (const line of text.split("\n")) {
        if (!line.trim() || line.trim().startsWith("#")) continue;
        if (/^\s/.test(line)) {
            const at = line.indexOf(":");
            rules
                .at(-1)!
                .headers.set(
                    line.slice(0, at).trim().toLowerCase(),
                    line.slice(at + 1).trim(),
                );
        } else rules.push({ pattern: line.trim(), headers: new Map() });
    }
    return rules;
}

const rules = parse(readFileSync("public/_headers", "utf8"));
const cache = (pattern: string) =>
    rules.find((r) => r.pattern === pattern)?.headers.get("cache-control");
const maxAge = (value: string | undefined) =>
    Number(/max-age=(\d+)/.exec(value ?? "")?.[1] ?? 0);

describe("public/_headers", () => {
    it("keeps the one-year immutable policy for hashed and versioned assets", () => {
        for (const pattern of [
            "/_astro/*",
            "/models/*.glb",
            "/images/scenes/*.webp",
            "/images/hero-sunrise-v1/*",
            "/lighting/*",
            "/terrain/*",
        ])
            expect(cache(pattern)).toBe("public, max-age=31536000, immutable");
    });

    it("gives unversioned assets a moderate lifetime that is never immutable", () => {
        for (const pattern of [
            "/fonts/*",
            "/draco/*",
            "/images/trajectory/*",
        ]) {
            const value = cache(pattern);
            expect(value, pattern).toMatch(/stale-while-revalidate=\d+/);
            expect(value, pattern).not.toContain("immutable");
            expect(maxAge(value), pattern).toBeGreaterThan(0);
            expect(maxAge(value), pattern).toBeLessThanOrEqual(604800);
        }
    });

    it("never makes the catch-all, the Studio or dynamic routes cacheable", () => {
        for (const pattern of ["/*", "/studio/*"])
            expect(cache(pattern), pattern).toBeUndefined();
        for (const rule of rules) {
            const value = rule.headers.get("cache-control");
            if (!value) continue;
            expect(rule.pattern, rule.pattern).toMatch(
                /^\/(_astro|models|images|lighting|terrain|fonts|draco)\//,
            );
            expect(rule.pattern).not.toMatch(
                /^\/(studio|api|blog|portfolio|feed|contact)/,
            );
        }
    });

    it("sets Cache-Control in at most one rule per path family", () => {
        const withCache = rules
            .filter((r) => r.headers.has("cache-control"))
            .map((r) => r.pattern);
        expect(new Set(withCache).size).toBe(withCache.length);
        // Rules join duplicate values with a comma, so none may overlap.
        const dirs = withCache.map((p) => p.split("/")[1]);
        for (const dir of new Set(dirs))
            if (dir !== "images" && dir !== "models")
                expect(dirs.filter((d) => d === dir)).toHaveLength(1);
        expect(
            withCache.filter((p) => p.startsWith("/images/trajectory/")),
        ).toEqual(["/images/trajectory/*"]);
    });

    it("keeps the security headers on every response", () => {
        const all = rules.find((r) => r.pattern === "/*")!;
        for (const name of [
            "x-content-type-options",
            "x-frame-options",
            "strict-transport-security",
        ])
            expect(all.headers.has(name)).toBe(true);
    });
});
