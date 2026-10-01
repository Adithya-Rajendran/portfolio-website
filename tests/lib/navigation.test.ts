import { describe, expect, it } from "vitest";
import {
    contactHref,
    cvLink,
    lostSection,
    movedFragment,
    navCurrent,
    primaryNavigation,
    reportHref,
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
        expect(cvLink.href).toBe("/resume#cv");
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

describe("the 404's ways on", () => {
    it("offers a missed address its section's index, else nothing", () => {
        expect(lostSection("/blog/no-such-post")?.plain).toBe("Writing");
        expect(lostSection("/blog/tags/no-such-tag")?.plain).toBe("Writing");
        expect(lostSection("/portfolio/no-such-project")?.plain).toBe(
            "Projects",
        );
        // Anywhere else, or on the server (no address), the primary is Home.
        for (const path of ["/nowhere", "/blogroll", "/resume/x", null]) {
            expect(lostSection(path), String(path)).toBeUndefined();
        }
    });

    it("reports a broken link to Hello with its address", () => {
        expect(reportHref("/blog/no such")).toBe(
            "/contact?broken=%2Fblog%2Fno%20such#hello",
        );
        expect(reportHref(null)).toBe("/contact#hello");
    });
});

describe("movedFragment", () => {
    it("sends the old /portfolio sections to their pages", () => {
        expect(movedFragment("/portfolio", "#experience")).toBe(
            "/resume#experience",
        );
        expect(movedFragment("/portfolio/", "#skills")).toBe("/resume#skills");
        expect(movedFragment("/portfolio", "#certifications")).toBe(
            "/resume#certifications",
        );
        expect(movedFragment("/portfolio", "#engineering-writing")).toBe(
            "/blog",
        );
        expect(movedFragment("/portfolio", "#contact")).toBe("/contact");
    });

    it("leaves every other address alone", () => {
        expect(movedFragment("/portfolio", "#projects")).toBeNull();
        expect(movedFragment("/portfolio", "")).toBeNull();
        expect(movedFragment("/resume", "#experience")).toBeNull();
        expect(movedFragment("/portfolio/homelab", "#contact")).toBeNull();
        expect(movedFragment(null, "#contact")).toBeNull();
    });
});
