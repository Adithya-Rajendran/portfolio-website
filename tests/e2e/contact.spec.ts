import type { Page } from "@playwright/test";
import type { ContactTopic } from "@/lib/contact";
import { contactCopy } from "@/lib/copy";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import { primaryNavigation } from "@/lib/navigation";
import { expect, test } from "./support/test";

/**
 * Comms (G4, plan §2.5.6): the form's topic is the one topic control (a
 * route's fragment picks it on arrival), the whole form is in the first
 * viewport, Hiring shows only beside what the owner is open to, the form
 * checks its fields and keeps what was written when a send is refused,
 * Consulting stays hidden while it is off, and without JavaScript the
 * routes and the LinkedIn alternative stand in for the form. Nothing on
 * the page is an email address or a phone number.
 *
 * The fixture build has no Resend credentials, so a send is refused there
 * ("not configured") without leaving the machine. A preview deployment has
 * real credentials, so no test sends from it.
 *
 * Route titles and prompts are the profile's words (Site copy), so the
 * specs read them from the page and fit fixture and real content alike.
 */
const { form, topics } = contactCopy;

/** The route rows beside the form. */
function routeRows(page: Page) {
    return page.getByRole("main").locator("li[data-topic]");
}

function topicRadio(page: Page, title: string) {
    return page.getByRole("radio", { name: title });
}

/** A route's row on /contact: `li#hello`. */
function routeRow(page: Page, topic: ContactTopic) {
    return page.locator(`li#${topic}`);
}

/** A route's title as the page prints it. */
async function routeTitle(page: Page, topic: ContactTopic): Promise<string> {
    return (
        await routeRow(page, topic).getByRole("heading").innerText()
    ).trim();
}

test("Contact in the header opens the contact page", async ({ page }) => {
    await page.goto("/");
    const comms = primaryNavigation.find((item) => item.id === "comms")!;
    await page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: comms.plain, exact: true })
        .click();
    await expect(page).toHaveURL(/\/contact$/);
    // The plain name is the title; the themed one only a small tag.
    await expect(
        page.getByRole("heading", { level: 1, name: "Contact", exact: true }),
    ).toBeVisible();
    await expect(
        page
            .getByRole("navigation", { name: "Main" })
            .getByRole("link", { name: comms.plain, exact: true }),
    ).toHaveAttribute("aria-current", "page");
});

test("/comms redirects to the contact page", async ({ page }) => {
    await page.goto("/comms");
    await expect(page).toHaveURL(/\/contact$/);
});

test("a route's fragment picks its topic on arrival, and its prompt is only the field's placeholder", async ({
    page,
}, testInfo) => {
    await page.goto("/contact#hello");
    await expect(
        topicRadio(page, await routeTitle(page, "hello")),
    ).toBeChecked();
    // The message field suggests what to write with the route's own
    // prompt (the profile's), or its plain one when the route has none;
    // the page gives no instructions besides.
    const message = page.getByRole("textbox", { name: form.messageLabel });
    const placeholder = (await message.getAttribute("placeholder")) ?? "";
    expect(placeholder.length).toBeGreaterThan(0);
    if (testInfo.project.name === "fixture") {
        expect(placeholder).toBe(
            FIXTURE_PROFILE.contactRoutes?.hello?.prompt ??
                form.messagePlaceholder,
        );
    }
    if (placeholder !== form.messagePlaceholder) {
        await expect(routeRow(page, "hello")).not.toContainText(placeholder);
    }
    await expect(page.getByRole("main")).not.toContainText(/\bInclude\b/);
});

test("the form comes first, whole, in the first viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/contact");
    for (const field of [form.emailLabel, form.messageLabel]) {
        await expect(
            page.getByRole("textbox", { name: field }),
        ).toBeInViewport();
    }
    await expect(page.getByRole("button", { name: form.send })).toBeInViewport({
        ratio: 1,
    });
    // The routes are short rows: no numbers.
    await expect(routeRow(page, "hello")).not.toContainText(/^0\d/);
});

test("the form's topic is the one topic control, and follows through to the address", async ({
    page,
}) => {
    await page.goto("/contact");
    // The routes beside the form describe the topics; they carry no
    // buttons or links that pick one.
    await expect(routeRows(page).getByRole("button")).toHaveCount(0);
    await expect(routeRows(page).locator('a[href^="#"]')).toHaveCount(0);

    const hello = topicRadio(page, await routeTitle(page, "hello"));
    await expect(hello).not.toBeChecked();
    await hello.click();
    await expect(hello).toBeChecked();
    await expect(page).toHaveURL(/\/contact#hello$/);
    // Every route shown is a topic in the form, and no other.
    await expect(page.getByRole("main").getByRole("radio")).toHaveCount(
        await routeRows(page).count(),
    );
});

test("Hiring shows only beside what the owner is open to", async ({ page }) => {
    await page.goto("/contact");
    const open = await page
        .getByRole("main")
        .getByText(contactCopy.openTo, { exact: true })
        .count();
    await expect(routeRow(page, "hiring")).toHaveCount(open ? 1 : 0);
});

test("the form points out what is missing before it sends", async ({
    page,
}) => {
    await page.goto("/contact");
    const email = page.getByRole("textbox", { name: form.emailLabel });
    const message = page.getByRole("textbox", { name: form.messageLabel });
    await page.getByRole("button", { name: form.send }).click();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription(form.errors.emailMissing);
    await expect(message).toHaveAccessibleDescription(
        new RegExp(form.errors.messageMissing),
    );

    await email.fill("you@example");
    await expect(email).toHaveAccessibleDescription(form.errors.emailInvalid);
    await email.fill("you@example.com");
    await expect(email).not.toHaveAttribute("aria-invalid", /.*/);
    await message.fill("x".repeat(950));
    await expect(page.getByText("950 / 1000")).toBeVisible();
    await expect(message).not.toHaveAttribute("aria-invalid", /.*/);
});

test("a refused send says why and keeps the message", async ({
    page,
}, testInfo) => {
    test.skip(
        testInfo.project.name !== "fixture",
        "A deployment has Resend credentials: this would send a real email.",
    );
    await page.goto("/contact#hiring");
    const hiring = topicRadio(page, await routeTitle(page, "hiring"));
    await page
        .getByRole("textbox", { name: form.emailLabel })
        .fill("reader@example.com");
    await page
        .getByRole("textbox", { name: form.messageLabel })
        .fill("A message from the browser tests.");
    await page.getByRole("button", { name: form.send }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "The contact form is not configured on this server.",
    );
    await expect(
        page.getByRole("textbox", { name: form.emailLabel }),
    ).toHaveValue("reader@example.com");
    await expect(
        page.getByRole("textbox", { name: form.messageLabel }),
    ).toHaveValue("A message from the browser tests.");
    await expect(hiring).toBeChecked();

    // Away and back: Cache Components keeps the page mounted but hidden,
    // so the stale alert goes and the draft stays.
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Writing", exact: true }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await nav.getByRole("link", { name: "Contact", exact: true }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(
        page.getByRole("textbox", { name: form.messageLabel }),
    ).toHaveValue("A message from the browser tests.");
});

test("Consulting stays hidden while it is off", async ({ page }, testInfo) => {
    test.skip(
        testInfo.project.name !== "fixture",
        "Only the fixture profile is known to have consulting off.",
    );
    await page.goto("/contact");
    const consulting =
        FIXTURE_PROFILE.contactRoutes?.consulting?.title ??
        topics.consulting.name;
    await expect(routeRow(page, "consulting")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: consulting })).toHaveCount(
        0,
    );
    await expect(topicRadio(page, consulting)).toHaveCount(0);
});

test("the page shows no email address or phone number", async ({ request }) => {
    const html = await (await request.get("/contact")).text();
    expect(html).not.toMatch(/mailto:|tel:/i);
    // The one address on the page is the field's placeholder.
    const addresses = html.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
    expect(
        addresses.filter((address) => address !== form.emailPlaceholder),
    ).toEqual([]);
});

test("/portfolio#contact is sent on to the form", async ({ page }) => {
    await page.goto("/portfolio#contact");
    await expect(page).toHaveURL(/\/contact$/);
    await expect(
        page.getByRole("textbox", { name: form.emailLabel }),
    ).toBeVisible();
});

test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the routes stay and LinkedIn stands in for the form", async ({
        page,
    }) => {
        await page.goto("/contact");
        await expect(
            routeRow(page, "hello").getByRole("heading"),
        ).toBeVisible();
        await expect(page.getByRole("textbox")).toHaveCount(0);
        await expect(page.getByRole("radio")).toHaveCount(0);
        const linkedIn = page.getByRole("link", {
            name: contactCopy.noScript.linkedIn,
        });
        await expect(linkedIn).toBeVisible();
        await expect(linkedIn).toHaveAttribute(
            "href",
            /^https:\/\/www\.linkedin\.com\//,
        );
        // The fragment still lights its route.
        await page.goto("/contact#hello");
        await expect(routeRow(page, "hello")).toBeInViewport();
    });
});
