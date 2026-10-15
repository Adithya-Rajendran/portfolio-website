import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sunrise from "@/lib/hero-sunrise.json";
import {
    HOME_PROJECT_ROWS,
    heroLatest,
    homeActs,
    homeProjects,
} from "@/lib/home";

describe("the home sections", () => {
    it("shows every section that has something to show, in order", () => {
        expect(homeActs({ projects: 4, entries: 3 })).toEqual([
            "projects",
            "writing",
            "contact",
        ]);
    });

    it("leaves an empty section out and always closes on contact", () => {
        expect(homeActs({ projects: 0, entries: 2 })).toEqual([
            "writing",
            "contact",
        ]);
    });
});

describe("the hero's latest entry", () => {
    it("names the newest entry, the first in the log's order", () => {
        expect(
            heroLatest([
                { slug: "my-homelab", title: " My homelab " },
                { slug: "older", title: "An older entry" },
            ]),
        ).toEqual({ title: "My homelab", href: "/blog/my-homelab" });
    });

    it("is absent without an entry or a title to name it by", () => {
        expect(heroLatest([])).toBeNull();
        expect(heroLatest([{ slug: "untitled", title: "  " }])).toBeNull();
    });
});

type Project = { slug: string; featured?: number; quiet?: boolean };

describe("the home projects", () => {
    it("stages the flagship, gives the next ones rows and lists the rest", () => {
        const { flagship, rows, also } = homeProjects<Project>([
            { slug: "gmail" },
            { slug: "homelab", featured: 1 },
            { slug: "kubernetes" },
            { slug: "website" },
        ]);
        expect(HOME_PROJECT_ROWS).toBe(2);
        expect(flagship?.slug).toBe("homelab");
        expect(rows.map((project) => project.slug)).toEqual([
            "gmail",
            "kubernetes",
        ]);
        expect(also.map((project) => project.slug)).toEqual(["website"]);
    });

    it("gives a quiet project no row: it is /portfolio's", () => {
        const { flagship, rows, also } = homeProjects<Project>([
            { slug: "homelab", featured: 1 },
            { slug: "gmail" },
            { slug: "kubernetes", quiet: true },
            { slug: "website" },
        ]);
        expect(flagship?.slug).toBe("homelab");
        expect(rows.map((project) => project.slug)).toEqual([
            "gmail",
            "website",
        ]);
        // All projects shows while /portfolio holds it.
        expect(also.map((project) => project.slug)).toEqual(["kubernetes"]);
    });

    it("leaves a row empty rather than give it to a quiet project", () => {
        const { flagship, rows, also } = homeProjects<Project>([
            { slug: "homelab", featured: 1 },
            { slug: "kubernetes", quiet: true },
            { slug: "website" },
        ]);
        expect(flagship?.slug).toBe("homelab");
        expect(rows.map((project) => project.slug)).toEqual(["website"]);
        expect(also.map((project) => project.slug)).toEqual(["kubernetes"]);
    });

    it("stages the first project when none is featured", () => {
        const { flagship, rows, also } = homeProjects<Project>([
            { slug: "a" },
            { slug: "b" },
        ]);
        expect(flagship?.slug).toBe("a");
        expect(rows.map((project) => project.slug)).toEqual(["b"]);
        expect(also).toEqual([]);
        expect(homeProjects([])).toEqual({
            flagship: null,
            rows: [],
            also: [],
        });
    });
});

describe("the hero photograph", () => {
    it("is credited, and every encode it lists is in public/", () => {
        expect(sunrise.credit).toBe("Photo: NASA / Expedition 72");
        expect(sunrise.id).toBe("ISS072-E-30246");
        expect(sunrise.source).toBe(
            "https://images.nasa.gov/details/iss072e030246",
        );
        for (const crop of [sunrise.desktop, sunrise.mobile]) {
            const widths = crop.sources.map((source) => source.width);
            expect(widths).toEqual([...widths].sort((a, b) => a - b));
            expect(widths.at(-1)).toBe(crop.width);
            for (const source of crop.sources) {
                for (const file of [source.avif, source.webp]) {
                    expect(file).toMatch(/^\/images\/hero-sunrise-v\d+\//);
                    expect(existsSync(join("public", file))).toBe(true);
                }
            }
            expect(crop.preview).toMatch(/^data:image\/webp;base64,/);
        }
    });

    it("keeps the drawn limb and the sun inside each crop", () => {
        for (const crop of [sunrise.desktop, sunrise.mobile]) {
            const { limb, surface, sun } = crop;
            // The sun sits in the lower half, on the limb.
            expect(sun.x).toBeGreaterThan(0);
            expect(sun.x).toBeLessThan(crop.width);
            expect(sun.y / crop.height).toBeGreaterThan(0.5);
            expect(sun.y).toBeLessThan(crop.height);
            // The top of the atmosphere crosses the frame below the name
            // zone, and the surface lies under it.
            const top = limb.cy - limb.r;
            expect(top / crop.height).toBeGreaterThan(0.55);
            expect(top).toBeLessThan(crop.height);
            expect(surface.cy - surface.r).toBeGreaterThan(top);
        }
    });
});
