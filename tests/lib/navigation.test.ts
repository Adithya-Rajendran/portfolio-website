import { describe, expect, it } from "vitest";
import {
    contactHref,
    cvLink,
    headerMode,
    navCurrent,
    pairName,
    primaryNavigation,
} from "@/lib/navigation";

describe("site navigation", () => {
    it("has the five themed and plain pairs in voyage order", () => {
        expect(primaryNavigation.map(pairName)).toEqual([
            "Flight Log, Blog",
            "Missions, Projects",
            "Trajectory, Experience",
            "Crew File, About",
            "Comms, Contact",
        ]);
        expect(primaryNavigation.map((item) => item.num)).toEqual([
            "01",
            "02",
            "03",
            "04",
            "05",
        ]);
    });

    it("keeps plain URLs and links the CV", () => {
        expect(primaryNavigation.map((item) => item.href)).toEqual([
            "/blog",
            "/portfolio",
            "/resume",
            "/about",
            "/contact",
        ]);
        expect(cvLink.href).toBe("/resume");
    });

    it("links a contact route by its fragment", () => {
        expect(contactHref()).toBe("/contact");
        expect(contactHref("hiring")).toBe("/contact#hiring");
    });

    it("marks the section's own page and the pages below it", () => {
        const [log, missions, , , comms] = primaryNavigation;
        expect(navCurrent("/blog", log)).toBe("page");
        expect(navCurrent("/blog/", log)).toBe("page");
        expect(navCurrent("/blog/my-homelab", log)).toBe("true");
        expect(navCurrent("/blogroll", log)).toBeUndefined();
        expect(navCurrent("/portfolio/homelab", missions)).toBe("true");
        expect(navCurrent("/portfolio", comms)).toBeUndefined();
        expect(navCurrent("/contact", comms)).toBe("page");
        expect(navCurrent(undefined, log)).toBeUndefined();
    });
});

describe("headerMode", () => {
    it("is solid on reading pages only", () => {
        for (const path of [
            "/blog/my-homelab",
            "/blog/my-homelab/",
            "/portfolio/homelab",
            "/resume",
            "/about",
            "/contact",
        ]) {
            expect(headerMode(path), path).toBe("solid");
        }
        for (const path of [
            "/",
            "/blog",
            "/blog/archive",
            "/blog/tags/homelab",
            "/portfolio",
            null,
        ]) {
            expect(headerMode(path), String(path)).toBeUndefined();
        }
    });
});
