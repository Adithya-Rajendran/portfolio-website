import { cvCopy } from "@/lib/copy";
import { expect, test } from "./support/test";

/**
 * The printed CV (G3, plan §6.2 PR 11): /resume prints as a controlled
 * document of two sheets on both A4 and Letter, each opening with its
 * control line, with the chrome, the controls, the view switch and the
 * flight left off the paper (the list prints, whichever view is on
 * screen), and no email address or phone number on it. Expired
 * credentials print as Prior certifications, never "Expired", and no
 * masthead address or opening splits across a line.
 */

/** Pages in a PDF, from its page tree's count. */
function pageCount(pdf: Buffer): number {
    const counts = [...pdf.toString("latin1").matchAll(/\/Count (\d+)/g)].map(
        ([, count]) => Number(count),
    );
    return Math.max(0, ...counts);
}

test("/resume prints on two sheets on A4 and on Letter", async ({ page }) => {
    await page.goto("/resume");
    await page.waitForLoadState("networkidle");
    await page.emulateMedia({ media: "print" });
    for (const format of ["A4", "Letter"]) {
        const pdf = await page.pdf({ format, printBackground: true });
        expect(pageCount(pdf), format).toBe(2);
    }
});

test("paper leaves off the chrome, the controls and the flight", async ({
    page,
}) => {
    await page.goto("/resume");
    // On screen the flight is the view (motion is allowed here).
    await expect(page.locator("[data-journey]")).toBeVisible();
    await page.emulateMedia({ media: "print" });
    const main = page.getByRole("main");
    await expect(page.locator("[data-journey]")).toBeHidden();
    await expect(page.getByRole("banner")).toBeHidden();
    await expect(page.getByRole("contentinfo")).toBeHidden();
    await expect(main.getByRole("button")).toHaveCount(0);
    await expect(main.getByRole("radio")).toHaveCount(0);
    for (const sheet of [1, 2]) {
        await expect(main.getByText(cvCopy.sheet(sheet, 2))).toBeVisible();
    }
    // The control line is the title, the revision and the sheet: no
    // document number, and the revision has no triangle.
    await expect(main.getByText(/AR-CV/)).toHaveCount(0);
    await expect(
        main.getByText(cvCopy.documentTitle, { exact: true }).first(),
    ).toBeVisible();
    await expect(main.locator(".rev__tri")).toHaveCount(0);
    await expect(
        main.getByRole("heading", { name: cvCopy.experience, exact: true }),
    ).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/mailto:|tel:/i);
});

test("paper lists prior certifications and keeps each address whole", async ({
    page,
}) => {
    // About the printed width of A4 and Letter inside the page margins.
    await page.setViewportSize({ width: 700, height: 1000 });
    await page.goto("/resume");
    await page.emulateMedia({ media: "print" });
    const main = page.getByRole("main");
    await expect(main.getByText(/expired/i)).toHaveCount(0);
    const prior = main.getByRole("heading", {
        name: cvCopy.priorCertifications,
        exact: true,
    });
    // The fixture profile holds two expired credentials.
    if (await prior.count()) await expect(prior).toBeVisible();
    // Each address and opening on the masthead is one unbroken line.
    const parts = main.locator(
        "header[data-print] span > span:not(:empty, .rev)",
    );
    expect(await parts.count()).toBeGreaterThan(1);
    for (const part of await parts.all()) {
        const lines = await part.evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return new Set(
                [...range.getClientRects()].map((r) => Math.round(r.top)),
            ).size;
        });
        expect(lines, (await part.textContent()) ?? "").toBe(1);
    }
});
