import type { Page } from "@playwright/test";
import { contactCopy } from "@/lib/copy";
import { isPostPage, sitemapPages } from "./support/routes";
import { expect, test } from "./support/test";
import { THEMES, storeTheme } from "./support/theme";

/**
 * International Orange means "now" (premium D1, contract §3): the Open To,
 * Active and Current dots, the flight's flown path and its now mark, the
 * contents' current bar, and focus. The patch's and the hero's suns are
 * identity marks (`data-identity`), outside the budget. Every other mark
 * is ink: buttons, the nav's bar, link rules, hovers and errors (only the
 * first invalid field, the one to fix now, takes its orange rule). The first
 * viewport of each page carries two orange marks at most, counting every
 * element and generated mark (`::before`, `::after`) whose text,
 * background, border, decoration, outline, shadow, fill or stroke is the
 * accent; focus rings are not counted. The flight's path and its now mark
 * are drawn in its canvas, which this does not read.
 */

const WIDTHS = [
    [1440, 900],
    [390, 844],
] as const;

/** The orange marks in the first viewport, named for the failure. */
async function orangeMarks(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--accent)";
        document.body.append(probe);
        const accent = getComputedStyle(probe).color;
        probe.remove();
        const orange = (value: string | null | undefined) =>
            Boolean(value && value.includes(accent));

        const found: string[] = [];
        const inView = (box: DOMRect) =>
            box.width > 0 &&
            box.height > 0 &&
            box.bottom > 0 &&
            box.right > 0 &&
            box.top < window.innerHeight &&
            box.left < window.innerWidth;
        for (const element of document.body.querySelectorAll("*")) {
            if (element.closest("[data-identity]")) continue;
            if (element.matches(":focus-visible")) continue;
            if (
                !element.checkVisibility({
                    opacityProperty: true,
                    visibilityProperty: true,
                }) ||
                !inView(element.getBoundingClientRect())
            ) {
                continue;
            }
            const ownText = [...element.childNodes].some(
                (node) =>
                    node.nodeType === Node.TEXT_NODE &&
                    node.textContent?.trim(),
            );
            for (const pseudo of [null, "::before", "::after"]) {
                const style = getComputedStyle(element, pseudo);
                if (
                    pseudo &&
                    (style.content === "none" ||
                        style.content === "normal" ||
                        style.display === "none")
                ) {
                    continue;
                }
                const sides = ["Top", "Right", "Bottom", "Left"] as const;
                const marks = [
                    ownText && !pseudo && orange(style.color) && "text",
                    orange(style.backgroundColor) && "background",
                    sides.some(
                        (side) =>
                            parseFloat(style[`border${side}Width`]) > 0 &&
                            orange(style[`border${side}Color`]),
                    ) && "border",
                    style.textDecorationLine !== "none" &&
                        orange(style.textDecorationColor) &&
                        "decoration",
                    style.outlineStyle !== "none" &&
                        parseFloat(style.outlineWidth) > 0 &&
                        orange(style.outlineColor) &&
                        "outline",
                    orange(style.boxShadow) && "shadow",
                    element instanceof SVGElement &&
                        (orange(style.fill) || orange(style.stroke)) &&
                        "fill or stroke",
                ].filter(Boolean);
                if (!marks.length) continue;
                const name =
                    element.getAttribute("class")?.split(" ")[0] ??
                    element.tagName.toLowerCase();
                const text = element.textContent?.trim().slice(0, 30) ?? "";
                found.push(
                    `${name}${pseudo ?? ""} (${marks.join(", ")}) "${text}"`,
                );
            }
        }
        return found;
    });
}

for (const theme of THEMES) {
    for (const [width, height] of WIDTHS) {
        test(`two orange marks at most in the first viewport, ${theme} at ${width}px`, async ({
            page,
        }) => {
            const listed = await sitemapPages(page.request);
            const projects = listed.filter((path) =>
                /^\/portfolio\/[^/]+$/.test(path),
            );
            const post = listed.find(isPostPage);
            const project =
                projects.find((path) => path === "/portfolio/homelab") ??
                projects[0];
            expect(post, "a post").toBeTruthy();
            expect(project, "a project").toBeTruthy();
            const paths = [
                "/",
                "/portfolio",
                project!,
                post!,
                "/resume",
                "/resume/trajectory",
                "/contact",
                "/about",
            ];
            test.setTimeout(30_000 + paths.length * 5_000);
            await storeTheme(page, theme);
            await page.setViewportSize({ width, height });
            for (const path of paths) {
                await page.goto(path);
                await page.waitForLoadState("networkidle");
                const marks = await orangeMarks(page);
                expect(
                    marks.length,
                    `${path}: ${marks.join("; ")}`,
                ).toBeLessThanOrEqual(2);
            }
        });
    }
}

for (const theme of THEMES) {
    for (const [width, height] of WIDTHS) {
        test(`a refused form keeps to the budget: the field to fix now is the orange one, ${theme} at ${width}px`, async ({
            page,
        }) => {
            await storeTheme(page, theme);
            await page.setViewportSize({ width, height });
            await page.goto("/contact");
            const { form } = contactCopy;
            const email = page.getByRole("textbox", { name: form.emailLabel });
            const message = page.getByRole("textbox", {
                name: form.messageLabel,
            });
            await email.fill("not-an-email");
            await page.getByRole("button", { name: form.send }).click();
            await expect(email).toHaveAttribute("aria-invalid", "true");
            await expect(message).toHaveAttribute("aria-invalid", "true");
            // The focused field's rule counts once its focus has moved on.
            await page.evaluate(() =>
                (document.activeElement as HTMLElement | null)?.blur(),
            );
            const marks = await orangeMarks(page);
            expect(marks.length, marks.join("; ")).toBeLessThanOrEqual(2);
            // The later field's rule is ink, beside its words and cross.
            const rules = await Promise.all(
                [email, message].map((field) =>
                    field.evaluate(
                        (input) => getComputedStyle(input).boxShadow,
                    ),
                ),
            );
            expect(rules[1]).not.toBe(rules[0]);
        });
    }
}

test("the primary is an ink fill; the nav's bar and the header's CV are ink", async ({
    page,
}) => {
    await page.goto("/resume");
    const accent = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--accent)";
        document.body.append(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        return colour;
    });
    const main = page.getByRole("main");
    const primary = main.locator(".btn--primary").first();
    await expect(primary).toBeVisible();
    const [fill, label, ink, ground] = await primary.evaluate((button) => {
        const root = getComputedStyle(document.documentElement);
        const style = getComputedStyle(button);
        const probe = (value: string) => {
            const span = document.createElement("span");
            span.style.color = value;
            document.body.append(span);
            const colour = getComputedStyle(span).color;
            span.remove();
            return colour;
        };
        return [
            style.backgroundColor,
            style.color,
            probe(root.getPropertyValue("--ink-1")),
            probe(root.getPropertyValue("--bg")),
        ];
    });
    expect(fill).toBe(ink);
    expect(label).toBe(ground);
    // The current section's bar and a link's rule are ink.
    const current = page
        .getByRole("banner")
        .locator(".nav__link[aria-current]");
    const bar = await current.evaluate(
        (link) => getComputedStyle(link, "::after").backgroundColor,
    );
    expect(bar).not.toBe(accent);
    const link = page
        .getByRole("banner")
        .getByRole("link", { name: "CV", exact: true });
    await link.hover();
    await expect(link).not.toHaveCSS("text-decoration-color", accent);
    await expect(link).not.toHaveCSS("color", accent);
});
