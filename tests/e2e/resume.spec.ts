import type { Page } from "@playwright/test";
import { siteConfig } from "@/lib/config";
import { cvCopy } from "@/lib/copy";
import { expect, test } from "./support/test";

/**
 * Experience & CV (G3, premium D3): /resume is the CV as one list, under a
 * head with what the owner is open to, the PDF and Contact, and one quiet
 * Timeline link to the flight (/resume/trajectory), with no view switch,
 * map or per-row map controls. A project row's link to one of the site's
 * posts opens in place, and every credential is the same plain row.
 * Without JavaScript the page is the same. Rows are found by their
 * content, so the spec fits fixture and real content alike.
 */

function main(page: Page) {
    return page.getByRole("main");
}

test("the head offers the CV, the way to get in touch and the Timeline, in the first viewport", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/resume");
    const contact = main(page).getByRole("link", {
        name: cvCopy.contact,
        exact: true,
    });
    await expect(contact).toBeInViewport();
    await expect(contact).toHaveAttribute("href", /^\/contact(#hiring)?$/);
    // What the owner is open to, when set, sits above it.
    const openTo = main(page).getByText(cvCopy.openTo, { exact: true });
    if (await openTo.count()) await expect(openTo.first()).toBeInViewport();
    // The flight is the record's one view in time: a quiet link, with no
    // view switch, map or orbit codes beside the list.
    const timeline = main(page).getByRole("link", {
        name: cvCopy.timeline,
        exact: true,
    });
    await expect(timeline).toBeInViewport();
    await expect(timeline).toHaveAttribute("href", "/resume/trajectory");
    await expect(main(page).getByRole("radio")).toHaveCount(0);
    await expect(main(page).getByRole("button")).toHaveCount(0);
    await expect(main(page)).not.toContainText(/\bOrbit \d{2}\b/);
    await expect(main(page)).not.toContainText(/show on timeline/i);
    // No Open PDF, Print or Share (the browser's Print still prints the
    // CV).
    for (const name of [/open pdf/i, /print/i, /share/i]) {
        await expect(main(page).getByRole("link", { name })).toHaveCount(0);
    }
});

test("the CV links the site in place and lists every credential alike", async ({
    page,
}) => {
    await page.goto("/resume");
    // A link to the site itself is never an external link: a post opens
    // in place, and the site's own address is left out.
    const site = new URL(siteConfig.url).hostname.replace(/^www\./, "");
    const outbound = main(page).locator("#projects a[target='_blank']");
    for (const href of await outbound.evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).href),
    )) {
        expect(new URL(href).hostname.replace(/^www\./, ""), href).not.toBe(
            site,
        );
    }
    // Every credential is the same plain row: no status label, and no
    // credential set as a heading of its own (only Prior certifications).
    const certifications = main(page).locator("#certifications");
    if (await certifications.count()) {
        await expect(certifications).not.toContainText(/no expiry|expired/i);
        await expect(
            certifications
                .getByRole("heading", { level: 3 })
                .filter({ hasNotText: cvCopy.priorCertifications }),
        ).toHaveCount(0);
    }
});

test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the CV and the Timeline link show as they do with it", async ({
        page,
    }) => {
        await page.goto("/resume");
        await expect(
            main(page).getByRole("heading", {
                level: 2,
                name: cvCopy.experience,
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            main(page).getByRole("link", {
                name: cvCopy.timeline,
                exact: true,
            }),
        ).toBeVisible();
        await expect(main(page).getByRole("button")).toHaveCount(0);
    });
});
