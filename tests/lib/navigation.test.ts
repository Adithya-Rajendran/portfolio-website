import { describe, expect, it } from "vitest";
import {
    contactHref,
    cvLink,
    headerMode,
    navCurrent,
    primaryNavigation,
} from "@/lib/navigation";

describe("site navigation", () => {
    it("names the five sections plainly, the work first", () => {
        expect(primaryNavigation.map((item) => item.plain)).toEqual([
            "Projects",
            "Writing",
            "Experience",
            "About",
            "Contact",
        ]);
        // The themed names survive only as each page's small tag.
        expect(primaryNavigation.map((item) => item.themed)).toEqual([
            "Missions",
            "Flight Log",
            "Trajectory",
            "Crew File",
            "Comms",
        ]);
    });

    it("keeps the URLs and links the CV", () => {
        expect(primaryNavigation.map((item) => item.href)).toEqual([
            "/portfolio",
            "/blog",
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
        const [missions, log, , , comms] = primaryNavigation;
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
