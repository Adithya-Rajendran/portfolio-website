import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import {
    MISSING_PAGES,
    STATIC_PAGES,
    contentPages,
    isPostPage,
} from "./support/routes";

/**
 * No page scrolls sideways from 320 to 1920 px (plan §7.2), and the header
 * fits at every width: its parts stay inside the viewport without
 * overlapping. `body` clips horizontal overflow, which would hide a
 * sideways scroll, so the body's own scroll width is measured too. No
 * visible text is set under 12 px (the type floor, contract §2). And the
 * type voice (premium D2): home, the posts, the projects, the CV, About
 * and Contact set six sizes at most; every caps line is a label (DM Mono
 * 13px, 0.08em), a control (Jost 500 13px, 0.10em), the hero's name, or
 * one of Michroma's two places, the header's wordmark and a page head's
 * themed tag; and 13px text is a label, a control or data, never UI text.
 */
const WIDTHS = [320, 390, 600, 960, 1024, 1280, 1440, 1920];

async function expectNoSidewaysScroll(page: Page, path: string) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(
            () =>
                Math.max(
                    document.documentElement.scrollWidth,
                    document.body.scrollWidth,
                ) - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${width}px overflows by`).toBe(0);
    }
}

for (const path of [...STATIC_PAGES, MISSING_PAGES.unmatched]) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
        await expectNoSidewaysScroll(page, path);
    });
}

test("no post, tag or project page scrolls sideways", async ({
    page,
    request,
}, testInfo) => {
    const paths = await contentPages(request, testInfo);
    test.setTimeout(30_000 + paths.length * 5_000);
    for (const path of paths) {
        await test.step(path, () => expectNoSidewaysScroll(page, path));
    }
});

test("the header fits from 320 to 1920 px", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");
    for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const problems = await page.evaluate(() => {
            const visible = (element: Element) => {
                const box = element.getBoundingClientRect();
                return box.width > 0 && box.height > 0;
            };
            const boxes = [
                ...document.querySelectorAll(
                    ".site-header .brand, .site-header .nav__link, .site-header .header-tools > *",
                ),
            ]
                .filter(visible)
                .map((element) => ({
                    name:
                        element.getAttribute("aria-label") ??
                        element.textContent?.trim() ??
                        element.className,
                    box: element.getBoundingClientRect(),
                }));
            const out: string[] = [];
            const header = document
                .querySelector(".site-header")!
                .getBoundingClientRect();
            for (const { name, box } of boxes) {
                if (box.left < 0 || box.right > window.innerWidth) {
                    out.push(`${name} outside the viewport`);
                }
                if (box.top < header.top || box.bottom > header.bottom + 2) {
                    out.push(`${name} outside the header bar`);
                }
            }
            boxes.sort((a, b) => a.box.left - b.box.left);
            for (let i = 1; i < boxes.length; i++) {
                if (boxes[i].box.left < boxes[i - 1].box.right - 0.5) {
                    out.push(`${boxes[i - 1].name} overlaps ${boxes[i].name}`);
                }
            }
            return out;
        });
        expect(problems, `header at ${width}px`).toEqual([]);
    }
});

/**
 * Visible text set under 12 px, the page's own and the text a stylesheet
 * generates (`::before`, `::after`: a mark or a counter): its size and its
 * first words.
 */
async function textUnderFloor(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const found: string[] = [];
        const shown = (element: Element) => {
            const box = element.getBoundingClientRect();
            // Visually hidden text (sr-only) is clipped to a pixel.
            return (
                element.checkVisibility({
                    opacityProperty: true,
                    visibilityProperty: true,
                }) &&
                box.width > 1 &&
                box.height > 1
            );
        };
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
        );
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const element = node.parentElement;
            const text = node.textContent?.trim();
            if (!element || !text || !shown(element)) continue;
            const size = parseFloat(getComputedStyle(element).fontSize);
            if (size < 12) found.push(`${size}px "${text.slice(0, 40)}"`);
        }
        for (const element of document.body.querySelectorAll("*")) {
            for (const pseudo of ["::before", "::after"]) {
                const style = getComputedStyle(element, pseudo);
                // A quoted string with a visible character, or a counter;
                // an empty string only draws a rule or a shape.
                const words = /^"((?:[^"\\]|\\.)*)"/.exec(style.content)?.[1];
                const text = words?.trim() || /counter/.test(style.content);
                if (!text || !shown(element)) continue;
                const size = parseFloat(style.fontSize);
                if (size < 12)
                    found.push(`${size}px ${pseudo} ${style.content}`);
            }
        }
        return found;
    });
}

test("no visible text is under 12 px on home, the posts, the projects, the CV and Contact", async ({
    page,
    request,
}, testInfo) => {
    const content = await contentPages(request, testInfo);
    const posts = content.filter(isPostPage);
    const projects = content.filter((path) =>
        /^\/portfolio\/[^/]+$/.test(path),
    );
    expect(posts.length, "posts").toBeGreaterThan(0);
    expect(projects.length, "projects").toBeGreaterThan(0);
    const paths = ["/", "/resume", "/contact", ...posts, ...projects];
    test.setTimeout(30_000 + paths.length * 5_000);
    for (const path of paths) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        if (path === "/contact") {
            // The counter, shown only near the limit: 40 characters from
            // the end.
            await page
                .locator('textarea[name="message"]')
                .fill("a".repeat(960));
            await expect(page.getByText("960 / 1000")).toBeVisible();
        }
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            expect(await textUnderFloor(page), `${path} at ${width}px`).toEqual(
                [],
            );
        }
    }
});

/**
 * The page's visible text: its distinct sizes, and each caps line that is
 * not a label, a control, the hero's name or Michroma's two places.
 */
async function typeVoice(
    page: Page,
): Promise<{ sizes: number[]; offVoice: string[] }> {
    return page.evaluate(() => {
        const sizes = new Set<number>();
        const offVoice: string[] = [];
        const shown = (element: Element) => {
            const box = element.getBoundingClientRect();
            return (
                element.checkVisibility({
                    opacityProperty: true,
                    visibilityProperty: true,
                }) &&
                box.width > 1 &&
                box.height > 1
            );
        };
        const near = (a: number, b: number) => Math.abs(a - b) < 0.006;
        const seen = new Set<Element>();
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
        );
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const element = node.parentElement;
            const text = node.textContent?.trim();
            if (!element || !text || seen.has(element) || !shown(element)) {
                continue;
            }
            seen.add(element);
            const style = getComputedStyle(element);
            const size = parseFloat(style.fontSize);
            sizes.add(Math.round(size * 2) / 2);
            const family = style.fontFamily;
            const tracking = parseFloat(style.letterSpacing) / size || 0;
            const name = `${element.className || element.tagName} "${text.slice(0, 30)}"`;
            if (/Michroma/.test(family)) {
                if (!element.closest(".brand__name, .page-head__tag")) {
                    offVoice.push(`Michroma: ${name}`);
                }
                continue;
            }
            const caps = style.textTransform === "uppercase";
            const control =
                caps &&
                /Jost/.test(family) &&
                style.fontWeight === "500" &&
                size === 13 &&
                near(tracking, 0.1);
            // 13px is the labels', the controls' and the data's size: no
            // UI text is set that small (its step is --step-0).
            if (size === 13 && !/DM Mono/.test(family) && !control) {
                offVoice.push(`13px text: ${family.split(",")[0]} ${name}`);
                continue;
            }
            if (!caps) continue;
            const label =
                /DM Mono/.test(family) && size === 13 && near(tracking, 0.08);
            if (!label && !control && !element.closest("#hero-name")) {
                offVoice.push(
                    `${family.split(",")[0]} ${style.fontWeight} ${size}px ${tracking.toFixed(3)}em: ${name}`,
                );
            }
        }
        return { sizes: [...sizes].sort((a, b) => a - b), offVoice };
    });
}

test("home, the posts, the projects, the CV, About and Contact keep to six sizes and one caps voice", async ({
    page,
    request,
}, testInfo) => {
    const content = await contentPages(request, testInfo);
    const paths = [
        "/",
        "/resume",
        "/about",
        "/contact",
        ...content.filter(
            (path) => isPostPage(path) || /^\/portfolio\/[^/]+$/.test(path),
        ),
    ];
    test.setTimeout(30_000 + paths.length * 6_000);
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of paths) {
            await page.goto(path);
            await page.waitForLoadState("networkidle");
            const { sizes, offVoice } = await typeVoice(page);
            expect(
                sizes.length,
                `${path} at ${width}px sets ${sizes.join(", ")} px`,
            ).toBeLessThanOrEqual(6);
            expect(offVoice, `${path} at ${width}px`).toEqual([]);
        }
    }
});
