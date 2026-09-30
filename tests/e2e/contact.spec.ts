import type { Page } from "@playwright/test";
import type { ContactTopic } from "@/lib/contact";
import { contactCopy, lossOfSignalCopy } from "@/lib/copy";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import { primaryNavigation } from "@/lib/navigation";
import { expect, test } from "./support/test";

/**
 * Comms (G4, plan §2.5.6): the form's topic is the one topic control (a
 * route's fragment picks it on arrival), the whole form is in the first
 * viewport, Hiring shows only beside what the owner is open to, the form
 * checks the email on leaving it and every field from the first submit,
 * each error under its field; a send that does not go (refused, or lost
 * on the network) stays on the page with the text kept and the ways on,
 * and the draft survives a reload; a sent message says "Message
 * received." with the reply address; the 404's report arrives with the
 * missed address; Consulting stays hidden while it is off, and without
 * JavaScript the routes and the LinkedIn alternative stand in for the
 * form. Nothing on the page is an email address or a phone number.
 *
 * The fixture build has no Resend credentials, so a send is refused there
 * without leaving the machine; a sent message is that refusal answered as
 * sent (`answerAsSent`). A preview deployment has real credentials, so no
 * test sends from it.
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

/** The email and message fields. */
function fields(page: Page) {
    return {
        email: page.getByRole("textbox", { name: form.emailLabel }),
        message: page.getByRole("textbox", { name: form.messageLabel }),
    };
}

/** Sends from this page answer as sent: the fixture's refusal, rewritten,
 *  so no email leaves the machine. */
async function answerAsSent(page: Page) {
    await page.route("**/contact", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch();
        const body = (await response.text()).replace(
            JSON.stringify({ status: "error", message: form.failures.unsent }),
            JSON.stringify({ status: "success" }),
        );
        await route.fulfill({ response, body });
    });
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

test("the form checks the email on leaving it, and every field from the first submit, under each field", async ({
    page,
}) => {
    await page.goto("/contact");
    const { email, message } = fields(page);
    // Leaving an empty field says nothing; leaving a malformed address
    // says how to fix it, and fixing it clears it.
    await email.focus();
    await message.focus();
    await expect(email).not.toHaveAttribute("aria-invalid", /.*/);
    await email.fill("you@example");
    await message.focus();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription(form.errors.emailInvalid);
    await expect(message).not.toHaveAttribute("aria-invalid", /.*/);
    await email.fill("");
    await expect(email).not.toHaveAttribute("aria-invalid", /.*/);

    // The first submit checks every field, the empty ones too.
    await page.getByRole("button", { name: form.send }).click();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription(form.errors.emailMissing);
    await expect(message).toHaveAccessibleDescription(
        new RegExp(form.errors.messageMissing),
    );
    // Each error sits under its own field.
    for (const [field, error] of [
        [email, form.errors.emailMissing],
        [message, form.errors.messageMissing],
    ] as const) {
        const box = (await field.boundingBox())!;
        const under = (await page.getByText(error).boundingBox())!;
        expect(under.y).toBeGreaterThanOrEqual(box.y + box.height);
        expect(under.y - (box.y + box.height)).toBeLessThan(24);
    }

    await email.fill("you@example.com");
    await expect(email).not.toHaveAttribute("aria-invalid", /.*/);
    // The counter shows only near the limit.
    await message.fill("x".repeat(899));
    await expect(page.getByText("899 / 1000")).toHaveCount(0);
    await message.fill("x".repeat(950));
    await expect(page.getByText("950 / 1000")).toBeVisible();
    await expect(message).not.toHaveAttribute("aria-invalid", /.*/);
});

test("a refused send says so under Send, keeps the message and offers the ways on", async ({
    page,
}, testInfo) => {
    test.skip(
        testInfo.project.name !== "fixture",
        "A deployment has Resend credentials: this would send a real email.",
    );
    await page.goto("/contact#hiring");
    const hiring = topicRadio(page, await routeTitle(page, "hiring"));
    const { email, message } = fields(page);
    await email.fill("reader@example.com");
    await message.fill("A message from the browser tests.");
    const send = page.getByRole("button", { name: form.send });
    await send.click();
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toHaveText(`${form.failures.unsent} ${form.kept}`);
    // Under Send, with Try again, Copy message and LinkedIn.
    expect((await alert.boundingBox())!.y).toBeGreaterThan(
        (await send.boundingBox())!.y,
    );
    const main = page.getByRole("main");
    await expect(main.getByRole("button", { name: form.retry })).toBeVisible();
    await expect(
        main.getByRole("button", { name: form.copyMessage }),
    ).toBeVisible();
    await expect(
        main.getByRole("link", { name: contactCopy.linkedIn }),
    ).toHaveAttribute("href", /^https:\/\/www\.linkedin\.com\//);
    await expect(email).toHaveValue("reader@example.com");
    await expect(message).toHaveValue("A message from the browser tests.");
    await expect(hiring).toBeChecked();

    // Away and back: Cache Components keeps the page mounted but hidden,
    // so the stale alert goes and the draft stays.
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Writing", exact: true }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await nav.getByRole("link", { name: "Contact", exact: true }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(message).toHaveValue("A message from the browser tests.");
});

test("a send lost on the network stays on the page, keeps the text and tries again", async ({
    page,
}, testInfo) => {
    test.skip(
        testInfo.project.name !== "fixture",
        "A deployment has Resend credentials: this would send a real email.",
    );
    await page.goto("/contact");
    let posts = 0;
    await page.route("**/contact", (route) => {
        if (route.request().method() !== "POST") return route.continue();
        posts += 1;
        return route.abort();
    });
    const { email, message } = fields(page);
    await email.fill("reader@example.com");
    await message.fill("A message the network drops.");
    await page.getByRole("button", { name: form.send }).click();
    // The form's own failure, not the route's error page.
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
        `${form.failures.unsent} ${form.kept}`,
    );
    await expect(page).toHaveURL(/\/contact$/);
    await expect(
        page.getByRole("heading", { level: 1, name: "Contact", exact: true }),
    ).toBeVisible();
    await expect(message).toHaveValue("A message the network drops.");
    expect(posts).toBe(1);

    await page.getByRole("button", { name: form.retry }).click();
    await expect.poll(() => posts).toBe(2);

    // The draft is kept for the tab's session: a reload restores it.
    await page.unroute("**/contact");
    await page.reload();
    await expect(email).toHaveValue("reader@example.com");
    await expect(message).toHaveValue("A message the network drops.");
});

test("a sent message is received in place, with the reply address and the way back", async ({
    page,
}, testInfo) => {
    test.skip(
        testInfo.project.name !== "fixture",
        "A deployment has Resend credentials: this would send a real email.",
    );
    await page.goto("/contact");
    await answerAsSent(page);
    const { email, message } = fields(page);
    await email.fill("reader@example.com");
    await message.fill("A message that arrives.");
    await page.getByRole("button", { name: form.send }).click();
    const received = page.getByRole("heading", { name: form.successTitle });
    await expect(received).toBeFocused();
    await expect(page.getByRole("main")).toContainText(
        `${form.repliesTo} reader@example.com.`,
    );

    // Change: back to the filled form, the address first.
    await page.getByRole("button", { name: form.changeLabel }).click();
    await expect(email).toBeFocused();
    await expect(email).toHaveValue("reader@example.com");
    await expect(message).toHaveValue("A message that arrives.");

    // Sent again, then a fresh form; a sent message is no draft.
    await page.getByRole("button", { name: form.send }).click();
    await expect(received).toBeFocused();
    await page.getByRole("button", { name: form.again }).click();
    await expect(email).toBeFocused();
    await expect(email).toHaveValue("");
    await expect(message).toHaveValue("");
    await page.reload();
    await expect(message).toHaveValue("");
});

test("the 404's report arrives with the missed address in the message", async ({
    page,
}) => {
    await page.goto("/blog/e2e-missing-post");
    await page
        .getByRole("main")
        .getByRole("link", { name: lossOfSignalCopy.reportLink })
        .click();
    // The address leaves the address bar once it is in the message.
    await expect(page).toHaveURL(/\/contact#hello$/);
    await expect(fields(page).message).toHaveValue(
        form.brokenLink("/blog/e2e-missing-post"),
    );
    await expect(
        topicRadio(page, await routeTitle(page, "hello")),
    ).toBeChecked();
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
            name: contactCopy.linkedIn,
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
