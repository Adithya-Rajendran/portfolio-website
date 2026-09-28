import { cvCopy } from "@/lib/copy";
import { expect, test } from "./support/test";

/**
 * The printed CV (G3, plan §6.2 PR 11): /resume prints as a controlled
 * document of two sheets on both A4 and Letter, each opening with its
 * control line, with the orbit map, the chrome and the controls left off
 * the paper, and no email address or phone number on it.
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

test("paper leaves off the map, the chrome and the controls", async ({
    page,
}) => {
    await page.goto("/resume");
    await page.emulateMedia({ media: "print" });
    const main = page.getByRole("main");
    await expect(
        main.getByRole("heading", { name: cvCopy.mapTitle }),
    ).toBeHidden();
    await expect(page.getByRole("banner")).toBeHidden();
    await expect(page.getByRole("contentinfo")).toBeHidden();
    await expect(main.getByRole("button")).toHaveCount(0);
    await expect(main.getByRole("radio")).toHaveCount(0);
    for (const sheet of [1, 2]) {
        await expect(main.getByText(cvCopy.sheet(sheet, 2))).toBeVisible();
    }
    await expect(
        main.getByRole("heading", { name: cvCopy.experience }),
    ).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/mailto:|tel:/i);
});
