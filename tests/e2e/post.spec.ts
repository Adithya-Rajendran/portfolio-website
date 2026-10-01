import type { Locator, Page } from "@playwright/test";
import { postCopy } from "@/lib/copy";
import { expect, test } from "./support/test";
import { contentPages, isPostPage } from "./support/routes";
import { THEMES, storeTheme } from "./support/theme";

/**
 * An entry (G1, plan §6.2 PR 10): the first paragraph reaches the first
 * screen, the text keeps a 60–75 character measure, code comments stay
 * readable, the rail lists the sections and repeats no record, listings
 * copy, footnotes sit in the margin and in the notes, the phone's contents
 * box works, and in-page links land in the visible entry after a client-side
 * navigation (Cache Components keeps the previous entry mounted, hidden).
 * Premium WS3: one numbering per thing (LOG in the crumb only, no margin
 * numbers or line counts), the type (h2 at 32px or less, leading 1.52),
 * the listings at one width, and one close (no Author block). Premium D3:
 * no printed listing number and no numbers in the contents (the headings
 * have names). The fixture-only tests read the fixture posts in
 * lib/fixtures.ts.
 */

const FIXTURE_POST = "/blog/fixture-post-code-and-links";
const FIXTURE_QUOTE = "/blog/fixture-post-quotation";

async function postPaths(
    request: Parameters<typeof contentPages>[0],
    testInfo: Parameters<typeof contentPages>[1],
): Promise<string[]> {
    const posts = (await contentPages(request, testInfo)).filter(isPostPage);
    expect(posts.length, "posts in the sitemap").toBeGreaterThan(0);
    return posts;
}

/** The visible entry's body text (the one `.prose` of the visible post). */
function body(page: Page): Locator {
    return page.locator('[data-page="post"]:visible .prose').first();
}

for (const [width, height] of [
    [1280, 800],
    [390, 844],
]) {
    for (const theme of THEMES) {
        test(`every entry's first paragraph is in the first viewport at ${width}×${height} in ${theme}`, async ({
            page,
            request,
        }, testInfo) => {
            const paths = await postPaths(request, testInfo);
            await page.setViewportSize({ width, height });
            await storeTheme(page, theme);
            for (const path of paths) {
                await test.step(path, async () => {
                    await page.goto(path);
                    await expect(page.locator("html")).toHaveAttribute(
                        "data-theme",
                        theme,
                    );
                    const first = body(page).locator(":scope > p").first();
                    const box = await first.boundingBox();
                    const line = await first.evaluate((el) =>
                        parseFloat(getComputedStyle(el).lineHeight),
                    );
                    expect(box, `${path} first paragraph`).not.toBeNull();
                    // At least its first two lines are on the first screen.
                    expect(
                        box!.y + 2 * line,
                        `${path}: first paragraph at ${Math.round(box!.y)}px`,
                    ).toBeLessThanOrEqual(height);
                });
            }
        });
    }
}

test("the text keeps a 60–75 character measure", async ({
    page,
    request,
}, testInfo) => {
    const paths = await postPaths(request, testInfo);
    for (const width of [1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of paths) {
            await page.goto(path);
            // Characters per line: the paragraph's width over the average
            // width of the characters of the entry's own paragraphs, in
            // their font (CSS `ch` would count the wide "0" instead).
            const perLine = await body(page)
                .locator(":scope > p")
                .first()
                .evaluate((el) => {
                    const style = getComputedStyle(el);
                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d")!;
                    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
                    const text = [
                        ...(el.parentElement?.querySelectorAll(":scope > p") ??
                            []),
                    ]
                        .map((p) => p.textContent ?? "")
                        .join(" ");
                    const average =
                        context.measureText(text).width / text.length;
                    return el.getBoundingClientRect().width / average;
                });
            expect(perLine, `${path} at ${width}px`).toBeGreaterThanOrEqual(60);
            expect(perLine, `${path} at ${width}px`).toBeLessThanOrEqual(75);
        }
    }
});

test("code comments are at least 4.5:1 on their listing in both themes", async ({
    page,
    request,
}, testInfo) => {
    const paths = await postPaths(request, testInfo);
    let checked = 0;
    for (const theme of THEMES) {
        await storeTheme(page, theme);
        for (const path of paths) {
            await page.goto(path);
            const ratios = await page
                .locator('[data-page="post"] .listing')
                .evaluateAll((listings) => {
                    // Any CSS colour (oklab, color-mix…) to sRGB, through a
                    // canvas pixel.
                    const canvas = document.createElement("canvas");
                    canvas.width = canvas.height = 1;
                    const context = canvas.getContext("2d", {
                        willReadFrequently: true,
                    })!;
                    const rgba = (colour: string) => {
                        context.clearRect(0, 0, 1, 1);
                        context.fillStyle = colour;
                        context.fillRect(0, 0, 1, 1);
                        return [...context.getImageData(0, 0, 1, 1).data];
                    };
                    const luminance = ([r, g, b]: number[]) => {
                        const [R, G, B] = [r, g, b].map((c) => {
                            const v = c / 255;
                            return v <= 0.03928
                                ? v / 12.92
                                : ((v + 0.055) / 1.055) ** 2.4;
                        });
                        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
                    };
                    /** The first opaque background behind an element. */
                    const background = (el: Element) => {
                        for (
                            let node: Element | null = el;
                            node;
                            node = node.parentElement
                        ) {
                            const colour = rgba(
                                getComputedStyle(node).backgroundColor,
                            );
                            if (colour[3] === 255) return colour;
                        }
                        return rgba(
                            getComputedStyle(document.documentElement)
                                .backgroundColor,
                        );
                    };
                    const out: number[] = [];
                    for (const listing of listings) {
                        for (const span of listing.querySelectorAll(
                            'span[style*="--code-token-comment"]',
                        )) {
                            const fore = rgba(getComputedStyle(span).color);
                            const back = background(span);
                            const [hi, lo] = [
                                luminance(fore),
                                luminance(back),
                            ].sort((a, b) => b - a);
                            out.push((hi + 0.05) / (lo + 0.05));
                        }
                    }
                    return out;
                });
            for (const ratio of ratios) {
                expect(ratio, `${path} in ${theme}`).toBeGreaterThanOrEqual(
                    4.5,
                );
            }
            checked += ratios.length;
        }
    }
    expect(checked, "comments found").toBeGreaterThan(0);
});

test("the rail lists the sections and repeats no record", async ({
    page,
    request,
}, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of await postPaths(request, testInfo)) {
        await page.goto(path);
        const text = body(page);
        const rail = page.getByRole("navigation", {
            name: postCopy.contentsLabel,
        });
        // The date and read time are the head's alone: no record box, no
        // word count.
        await expect(page.getByText("In this entry")).toHaveCount(0);
        await expect(
            page.getByRole("main").getByText(/\b[\d,]+ words\b/),
        ).toHaveCount(0);
        // The contents list every section (the top heading level), in
        // order; there are none without a heading.
        let headings: string[] = [];
        for (const level of ["h2", "h3", "h4"]) {
            headings = await text
                .locator(`:scope > ${level}`)
                .allTextContents();
            if (headings.length) break;
        }
        if (headings.length) {
            await expect(rail.getByRole("link")).toHaveText(headings);
            // By name only: no number before a section.
            const marks = await rail
                .getByRole("link")
                .evaluateAll((links) =>
                    links.map(
                        (link) => getComputedStyle(link, "::before").content,
                    ),
                );
            for (const mark of marks) {
                expect(["none", "normal"], path).toContain(mark);
            }
        } else {
            await expect(rail).toHaveCount(0);
        }
    }
});

/** The first entry whose page holds `selector`, to test on any content. */
async function firstPostWith(
    page: Page,
    paths: readonly string[],
    selector: string,
): Promise<string | null> {
    for (const path of paths) {
        await page.goto(path);
        if (await page.locator(`[data-page="post"] ${selector}`).count()) {
            return path;
        }
    }
    return null;
}

const FIXTURE_ONLY = "Reads the fixture posts (lib/fixtures.ts).";

test("a listing is named, prints no number and copies its code", async ({
    page,
    context,
    request,
}, testInfo) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const path = await firstPostWith(
        page,
        await postPaths(request, testInfo),
        ".listing",
    );
    test.skip(!path, "No entry has a code listing.");
    // The number only keeps the names apart: the bar never prints it.
    const listing = page.getByRole("region", { name: /^Listing 1, / });
    await expect(listing).toBeVisible();
    await expect(
        page.locator('[data-page="post"]:visible .listing__bar').first(),
    ).not.toContainText(/listing/i);
    const copy = page.getByRole("button", {
        name: postCopy.listing.copyLabel(1),
    });
    await expect(copy).toBeVisible();
    await expect(copy).toHaveText(postCopy.listing.copy);
    const shown = (await listing.innerText()).replace(/\s+$/, "");
    await copy.click();
    await expect(copy).toHaveText(postCopy.listing.copied);
    await expect(
        page.getByRole("status").filter({
            hasText: postCopy.listing.announceCopied(1),
        }),
    ).toHaveCount(1);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\s+$/, "")).toBe(shown);
});

test("an entry's LOG number is printed once, above its title, in the crumb", async ({
    page,
    request,
}, testInfo) => {
    for (const path of await postPaths(request, testInfo)) {
        for (const width of [390, 1280]) {
            await page.setViewportSize({ width, height: 844 });
            await page.goto(path);
            const title = page.locator('[data-page="post"]:visible h1');
            await expect(title).toBeVisible();
            const above = await title.evaluate((h1) => {
                const top = h1.getBoundingClientRect().top;
                return [
                    ...h1.closest("[data-page]")!.querySelectorAll("span, p"),
                ].filter(
                    (el) =>
                        /^LOG \d{3}$/.test(el.textContent?.trim() ?? "") &&
                        el.checkVisibility() &&
                        el.getBoundingClientRect().bottom <= top,
                ).length;
            });
            expect(above, `${path} at ${width}px`).toBe(1);
            // Nowhere else: not the end mark, the pager or a plate.
            const text = await page
                .locator('[data-page="post"]:visible')
                .innerText();
            expect(
                text.match(/LOG \d{3}/g) ?? [],
                `${path} at ${width}px`,
            ).toHaveLength(1);
        }
    }
});

test("one numbering per thing, and the text's type", async ({
    page,
    request,
}, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of await postPaths(request, testInfo)) {
        await page.goto(path);
        const text = body(page);
        // The headings carry their names: no margin number before an h2.
        const h2 = await text.locator(":scope > h2").evaluateAll((headings) =>
            headings.map((heading) => ({
                before: getComputedStyle(heading, "::before").content,
                size: parseFloat(getComputedStyle(heading).fontSize),
            })),
        );
        for (const { before, size } of h2) {
            expect(["none", "normal"], path).toContain(before);
            expect(size, `${path} h2`).toBeLessThanOrEqual(32);
        }
        const leading = await text.evaluate((prose) => {
            const style = getComputedStyle(prose);
            return parseFloat(style.lineHeight) / parseFloat(style.fontSize);
        });
        expect(leading, path).toBeCloseTo(1.52, 2);
        // A listing's bar names its file, language and Copy: never a line
        // count or a listing number.
        const bars = await page
            .locator('[data-page="post"]:visible .listing__bar')
            .allInnerTexts();
        for (const bar of bars) {
            expect(bar, path).not.toMatch(/\blines?\b/);
            expect(bar, path).not.toMatch(/\blisting\b/i);
        }
    }
});

test("the entry closes once: the end mark, a question, the follow line, then the pager by name", async ({
    page,
    request,
}, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of await postPaths(request, testInfo)) {
        await page.goto(path);
        const main = page.getByRole("main");
        await expect(main.getByText(/^End of entry$/)).toBeVisible();
        // No Author block (the footer carries the name) and no heading
        // over the pager.
        for (const name of ["Author", postCopy.pager]) {
            await expect(
                main.getByRole("heading", { name, exact: true }),
            ).toHaveCount(0);
        }
        await expect(main.getByText(/^Written by/)).toHaveCount(0);
        const follow = main.getByText(/^Follow:/);
        await expect(follow).toBeVisible();
        await expect(
            follow.getByRole("link", { name: "RSS", exact: true }),
        ).toHaveAttribute("href", "/feed.xml");
        await expect(main.locator(".btn", { hasText: /^RSS$/ })).toHaveCount(0);
        // The pager names the entries: no LOG number, date or read time.
        const pager = main.getByRole("navigation", { name: postCopy.pager });
        for (const link of await pager.getByRole("link").all()) {
            await expect(link).toContainText(
                new RegExp(`^(${postCopy.previous}|${postCopy.next})`),
            );
            await expect(link).not.toContainText(/LOG|\d{4}|\bmin\b/);
        }
    }
});

test("the phone's contents box opens, and a contents link closes it", async ({
    page,
    request,
}, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const path = await firstPostWith(
        page,
        await postPaths(request, testInfo),
        "[data-entry-box] [data-contents]",
    );
    test.skip(!path, "No entry has sections.");
    const box = page.locator("[data-entry-box]");
    await expect(box).not.toHaveAttribute("open", "");
    const summary = box.locator("summary");
    await expect(summary).toContainText(postCopy.contents);
    await summary.click();
    await expect(box).toHaveAttribute("open", "");
    const link = page
        .getByRole("navigation", { name: postCopy.contentsLabel })
        .getByRole("link")
        .last();
    const name = (await link.textContent()) ?? "";
    const hash = (await link.getAttribute("href")) ?? "";
    await link.click();
    await expect(box).not.toHaveAttribute("open", "");
    await expect(
        page.getByRole("heading", { level: 2, name, exact: true }),
    ).toBeInViewport();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
});

test("reading pages get the solid header, index pages do not", async ({
    page,
    request,
}, testInfo) => {
    const [path] = await postPaths(request, testInfo);
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-header", "solid");
    await page.getByRole("link", { name: postCopy.allEntries }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.locator("html")).not.toHaveAttribute("data-header", /.*/);
});

test("printing an entry keeps the text and drops the rail and actions", async ({
    page,
    request,
}, testInfo) => {
    const [path] = await postPaths(request, testInfo);
    await page.goto(path);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByText(/^Writing · LOG \d{3}$/)).toBeVisible();
    await expect(
        page.getByRole("navigation", { name: postCopy.contentsLabel }),
    ).toBeHidden();
    await expect(
        page.getByRole("button", { name: postCopy.copyLinkLabel }),
    ).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(body(page).locator(":scope > p").first()).toBeVisible();
});

test("one listing past the measure takes every listing wide; a highlighted line is marked", async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
    await page.goto(FIXTURE_POST);
    const short = page.locator(".listing").filter({
        has: page.getByRole("region", { name: "Listing 1, Bash, fixture.sh" }),
    });
    const wide = page.locator(".listing").filter({
        has: page.getByRole("region", {
            name: "Listing 2, Bash, fixture-wide.sh",
        }),
    });
    const text = await body(page).locator(":scope > p").first().boundingBox();
    const shortBox = await short.boundingBox();
    const wideBox = await wide.boundingBox();
    // One width per entry, wider than the text, and no line cut.
    expect(shortBox!.width).toBe(wideBox!.width);
    expect(wideBox!.width).toBeGreaterThan(text!.width + 100);
    for (const listing of await page
        .locator('[data-page="post"]:visible .listing__code')
        .all()) {
        expect(
            await listing.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
    }
    await expect(wide.locator(".line-highlight")).toHaveCount(1);
    await expect(wide.locator(".line-highlight")).toContainText(
        "A fixture comment",
    );
});

test("footnotes: a raised number, a margin note on wide screens, the notes at the end", async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
    await page.goto(FIXTURE_POST);
    const ref = page.getByRole("link", {
        name: postCopy.notes.ref(1),
        exact: true,
    });
    await expect(ref).toHaveAttribute("href", "#fn-1");
    const notes = page.getByRole("region", { name: postCopy.notes.title });
    await expect(notes.getByRole("listitem")).toHaveCount(2);
    await expect(notes.getByRole("listitem").first()).toContainText(
        "Fixture footnote one",
    );

    // ≥ 1280px: the note also sits in the margin, beside its line and
    // right of the text; it is hidden from assistive technology.
    const sidenote = page.locator(".sidenote").first();
    await expect(sidenote).toBeVisible();
    await expect(sidenote).toHaveAttribute("aria-hidden", "true");
    const refBox = (await ref.boundingBox())!;
    const noteBox = (await sidenote.boundingBox())!;
    const textBox = (await body(page)
        .locator(":scope > p")
        .first()
        .boundingBox())!;
    expect(noteBox.x).toBeGreaterThan(textBox.x + textBox.width);
    expect(Math.abs(noteBox.y - refBox.y)).toBeLessThan(40);
    expect(noteBox.x + noteBox.width).toBeLessThanOrEqual(1440);

    // The number and the back link lead to each other.
    await ref.click();
    await expect(page).toHaveURL(/#fn-1$/);
    await expect(notes.getByRole("listitem").first()).toBeInViewport();
    await notes.getByRole("link", { name: postCopy.notes.back(1) }).click();
    await expect(page).toHaveURL(/#fnref-1$/);
    await expect(ref).toBeInViewport();

    // Below 1280px there is no margin copy.
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(sidenote).toBeHidden();
});

test("a caution callout, the revisions and the end mark", async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
    await page.goto(FIXTURE_POST);
    // A quiet note led by its tone and title in bold: no frame or band.
    const caution = page
        .getByRole("note")
        .filter({ hasText: "Fixture caution" });
    await expect(caution.locator("strong").first()).toHaveText(
        "Caution: Fixture caution",
    );
    await expect(caution).toHaveCSS("border-top-width", "0px");
    const revisions = page.getByRole("region", {
        name: postCopy.revisions.title,
    });
    // Oldest first, each dated with a revision mark.
    await expect(revisions.getByRole("listitem")).toHaveText([
        /Rev 2026-06-30.*Correction.*Fixture correction/,
        /Rev 2026-07-02.*Update.*Fixture update/,
    ]);
    await expect(page.getByText(/^End of entry$/)).toBeVisible();
    await expect(
        page.getByRole("link", { name: postCopy.reply }),
    ).toHaveAttribute("href", "/contact#hello");
});

test("the fixture's footnotes, caution and revisions reach the RSS feed", async ({
    request,
}, testInfo) => {
    test.skip(
        testInfo.project.name !== "fixture",
        "Reads the fixture post's footnotes, callout and changelog.",
    );
    const xml = await (await request.get("/feed.xml")).text();
    const decoded = xml
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&");
    expect(decoded).toContain('<sup><a href="#fn-1" id="fnref-1">1</a></sup>');
    expect(decoded).toContain("<h2>Notes</h2>");
    expect(decoded).toContain("Caution: Fixture caution");
    expect(decoded).toContain("Bash · <code>fixture-wide.sh</code>");
    expect(decoded).not.toMatch(/Listing \d/);
    expect(decoded).toContain("2026-06-30 · Correction.");
});

test("after a client-side navigation, the skip link and a contents link land in the visible entry", async ({
    page,
}, testInfo) => {
    test.skip(
        testInfo.project.name !== "fixture",
        "Needs two fixture entries that share a heading id.",
    );
    await page.goto(FIXTURE_QUOTE);
    await page.getByRole("link", { name: /^Next entry/ }).click();
    await expect(page).toHaveURL(new RegExp(`${FIXTURE_POST}$`));
    const title = page.getByRole("heading", {
        level: 1,
        name: "Fixture post: code listings and links",
    });
    await expect(title).toBeVisible();
    // The previous entry is still mounted, hidden, with the same heading id.
    await expect(page.locator("#fixture-section-in-a-post")).toHaveCount(2);

    const skip = page.getByRole("link", { name: "Skip to content" });
    await skip.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await expect(
        page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText("Fixture post: code listings and links");

    await page
        .getByRole("navigation", { name: postCopy.contentsLabel })
        .getByRole("link", { name: "Fixture section in a post" })
        .click();
    await expect(page).toHaveURL(/#fixture-section-in-a-post$/);
    await expect(
        page.getByRole("heading", {
            level: 2,
            name: "Fixture section in a post",
        }),
    ).toBeInViewport();
    await expect(
        page
            .getByRole("navigation", { name: postCopy.contentsLabel })
            .getByRole("link", { name: "Fixture section in a post" }),
    ).toHaveAttribute("aria-current", "location");
});

test("an entry carries BlogPosting and BreadcrumbList data and no email address", async ({
    page,
    request,
}, testInfo) => {
    const [path] = await postPaths(request, testInfo);
    await page.goto(path);
    const data = (
        await page
            .locator('script[type="application/ld+json"]')
            .allTextContents()
    ).map((text) => JSON.parse(text) as Record<string, unknown>);
    const posting = data.find((item) => item["@type"] === "BlogPosting");
    const crumbs = data.find((item) => item["@type"] === "BreadcrumbList");
    expect(posting?.url).toMatch(new RegExp(`${path}$`));
    expect(String(posting?.image)).toMatch(/opengraph-image-|cdn\.sanity\.io/);
    const items = crumbs?.itemListElement as { name: string; item: string }[];
    expect(items.map((item) => new URL(item.item).pathname)).toEqual([
        "/",
        "/blog",
        path,
    ]);
    const html = await page.content();
    expect(html).not.toMatch(/mailto:|tel:/);
});
