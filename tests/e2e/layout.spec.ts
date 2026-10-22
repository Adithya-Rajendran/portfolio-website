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
 * overlapping, with the owner's name beside the patch from 600 px. `body`
 * clips horizontal overflow, which would hide a sideways scroll, so the
 * body's own scroll width is measured too. No
 * visible text is set under 12 px (the type floor, contract §2). And the
 * type voice (premium D2): home, the posts, the projects, the CV, About
 * and Contact set six sizes at most; every caps line is a label (DM Mono
 * 13px, 0.08em), a control (Jost 500 13px, 0.10em), the hero's name, or
 * one of Michroma's two places, the header's wordmark and a page head's
 * themed tag; and 13px text is a label, a control or data, never UI text.
 * And every list under a head ends where the head's rule ends, from 390
 * to 3824 px: no list has a width of its own; and a page head's title
 * sits directly under its tag, at one height on every page, however far
 * the head's right column runs past it. And under a section head its
 * hairline is the only rule over the first row: no list draws one of its
 * own above the first words (contract §1).
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

/** The header's parts outside the viewport or the bar, or overlapping. */
function headerProblems(page: Page): Promise<string[]> {
    return page.evaluate(() => {
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
}

test("the header fits from 320 to 1920 px", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");
    const wordmark = page.getByRole("banner").locator(".brand__name");
    for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        expect(await headerProblems(page), `header at ${width}px`).toEqual([]);
        // The owner's name beside the patch wherever the bar has room for
        // it, which is everywhere but a phone (the patch alone there).
        await expect(wordmark, `wordmark at ${width}px`).toBeVisible({
            visible: width >= 600,
        });
    }
});

test("the header fits a phone with the root text at 150%", async ({ page }) => {
    // A browser that maps a large text setting to the root font size
    // grows the bar's labels (13px to 19.5px), never its spacing: the
    // row still fits, and from 390px the page does not scroll sideways.
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
        document.documentElement.style.fontSize = "150%";
    });
    for (const width of [320, 360, 375, 390, 414]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await headerProblems(page), `header at ${width}px`).toEqual([]);
        const labels = await page
            .locator(".site-header .header-tools > :is(a, button)")
            .evaluateAll((elements) =>
                elements
                    .filter((element) => element.getClientRects().length)
                    .map((element) =>
                        parseFloat(getComputedStyle(element).fontSize),
                    ),
            );
        expect(
            Math.min(...labels),
            `labels at ${width}px`,
        ).toBeGreaterThanOrEqual(13);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
        () =>
            Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
            ) - document.documentElement.clientWidth,
    );
    expect(overflow, "home at 390px and 150% overflows by").toBe(0);
    // A title's longest word stays inside its column.
    const spilled = await page
        .getByRole("main")
        .locator("h2, h3")
        .evaluateAll((headings) =>
            headings
                .filter(
                    (heading) =>
                        heading.getClientRects().length &&
                        heading.scrollWidth > heading.clientWidth + 1,
                )
                .map((heading) => heading.textContent?.trim()),
        );
    expect(spilled, "titles past their column").toEqual([]);
});

test("every page head sets its title under its tag, at one height", async ({
    page,
    request,
}, testInfo) => {
    // The title hangs from the tag row: the head's right column (the
    // intro, Open To, the actions) runs on past it as far as it needs,
    // so going from one section to the next never moves the title.
    const tagPage = (await contentPages(request, testInfo)).find((path) =>
        path.startsWith("/blog/tags/"),
    );
    const paths = [
        ...STATIC_PAGES.filter((path) => path !== "/"),
        ...(tagPage ? [tagPage] : []),
        MISSING_PAGES.unmatched,
    ];
    test.setTimeout(30_000 + paths.length * 5_000);
    const widths = [390, 960, 1280, 1440, 1920];
    const tops: number[][] = [];
    for (const path of paths) {
        await page.goto(path);
        const main = page.getByRole("main");
        const tag = main.locator(".page-head > .section-tag");
        const title = main.getByRole("heading", { level: 1 });
        const ys: number[] = [];
        for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            const row = (await tag.boundingBox())!;
            const box = (await title.boundingBox())!;
            expect(
                box.y - (row.y + row.height),
                `${path} at ${width}px: the title's distance under its tag`,
            ).toBeLessThanOrEqual(24);
            ys.push(Math.round(box.y));
        }
        tops.push(ys);
    }
    for (const [index, width] of widths.entries()) {
        const ys = tops.map((row) => row[index]);
        expect(
            Math.max(...ys) - Math.min(...ys),
            `the titles' tops at ${width}px (${paths.join(", ")}): ${ys.join(", ")}`,
        ).toBeLessThanOrEqual(1);
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
                .fill("a".repeat(1960));
            await expect(page.getByText("1,960 / 2,000")).toBeVisible();
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

/**
 * Under each visible section head, the rules (a top border alone, not a
 * box's edge) in the block that opens the section that sit above its
 * first words: the head's hairline is the division, so there are none.
 */
function rulesOverFirstRows(page: Page): Promise<string[]> {
    return page.evaluate(() =>
        Array.from(
            document.querySelectorAll(".section-tag:has(> .section-tag__h)"),
        )
            .filter((head) => head.checkVisibility())
            .flatMap((head) => {
                const next = head.nextElementSibling;
                const block = next?.matches(".doc-section__body")
                    ? next.querySelector(
                          ":scope > :not(.g-rail) > :first-child",
                      )
                    : next;
                if (!block) return [];
                const parts = [
                    block,
                    ...Array.from(block.querySelectorAll("*")),
                ].filter((element) => element.checkVisibility());
                const top = (element: Element) =>
                    element.getBoundingClientRect().top;
                const words = parts
                    .filter((element) =>
                        Array.from(element.childNodes).some(
                            (node) =>
                                node.nodeType === Node.TEXT_NODE &&
                                Boolean(node.textContent?.trim()),
                        ),
                    )
                    .map(top);
                if (!words.length) return [];
                const first = Math.min(...words);
                return parts
                    .filter((element) => {
                        const style = getComputedStyle(element);
                        return (
                            style.borderTopStyle !== "none" &&
                            parseFloat(style.borderTopWidth) > 0 &&
                            parseFloat(style.borderLeftWidth) === 0 &&
                            top(element) < first - 1
                        );
                    })
                    .map(
                        (element) =>
                            `${head.textContent?.trim()}: <${element.localName} class="${element.getAttribute("class") ?? ""}">`,
                    );
            }),
    );
}

test("a section head's hairline is the only rule over its first row", async ({
    page,
    request,
}, testInfo) => {
    const content = await contentPages(request, testInfo);
    const paths = [
        "/",
        "/about",
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
            expect(
                await rulesOverFirstRows(page),
                `${path} at ${width}px`,
            ).toEqual([]);
        }
    }
});

/**
 * Each list under a head that does not end where the head's rule ends: a
 * section's tag row (home's sections, a DocSection, a post's end matter)
 * against the lists beside it, and a page head's against its page's
 * (/blog's index). Only the outermost lists that draw a rule count (a
 * stack or a row's tags draws none), and none in a reading column or its
 * rail, which keep the measure's edge.
 */
async function listsOffTheirHead(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const found: string[] = [];
        const lists = "ol, ul, dl, table";
        const shown = (element: Element) =>
            element.checkVisibility() &&
            element.getBoundingClientRect().width > 1;
        // A border's computed width is 0 wherever its style is none.
        const ruled = (list: Element) =>
            [list, ...list.querySelectorAll("*")].some((element) => {
                const style = getComputedStyle(element);
                return (
                    parseFloat(style.borderTopWidth) > 0 ||
                    parseFloat(style.borderBottomWidth) > 0
                );
            });
        for (const head of document.querySelectorAll(
            ".section-tag:not(.crumb-row)",
        )) {
            if (!shown(head)) continue;
            const scope = head.closest(".page-head")
                ? head.closest("[data-page]")
                : head.parentElement;
            if (!scope) continue;
            const ends = [...scope.querySelectorAll(lists)]
                .filter(
                    (list) =>
                        shown(list) &&
                        !scope.contains(
                            list.parentElement?.closest(lists) ?? null,
                        ) &&
                        !list.closest(".g-prose, .g-rail") &&
                        ruled(list),
                )
                .map((list) => list.getBoundingClientRect().right);
            if (!ends.length) continue;
            const end = Math.max(...ends);
            const rule = head.getBoundingClientRect().right;
            if (Math.abs(end - rule) > 1) {
                const name = head.textContent?.trim().slice(0, 30);
                found.push(
                    `"${name}": the list ends at ${Math.round(end)}px, the head at ${Math.round(rule)}px`,
                );
            }
        }
        return found;
    });
}

test("every list under a head ends where the head's rule ends, from 390 to 3824 px", async ({
    page,
    request,
}, testInfo) => {
    const content = await contentPages(request, testInfo);
    // The CV's address opens the list, whatever view the visit picked.
    const paths = [
        "/",
        "/portfolio",
        "/blog",
        "/about",
        "/resume#cv",
        ...content,
    ];
    test.setTimeout(30_000 + paths.length * 6_000);
    for (const path of paths) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        if (path === "/resume#cv") {
            await expect(page.locator("#cv h2").first()).toBeVisible();
        }
        for (const width of [390, 768, 960, 1280, 1440, 1920, 3824]) {
            await page.setViewportSize({ width, height: 900 });
            expect(
                await listsOffTheirHead(page),
                `${path} at ${width}px`,
            ).toEqual([]);
        }
    }
});
