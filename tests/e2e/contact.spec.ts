import type { Page } from "@playwright/test";
import { contactRoutes, topicOptions, type ContactTopic } from "@/lib/contact";
import { contactCopy, lossOfSignalCopy } from "@/lib/copy";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import { primaryNavigation } from "@/lib/navigation";
import { expect, test } from "./support/test";

/**
 * Comms (G4, plan §2.5.6): the form's Topic radios are the routes, each
 * described by the owner's line where there is one and named by its title
 * alone, with no column of routes or links beside them (premium D3); a
 * route's fragment picks its topic on arrival, the whole form is in the
 * first viewport, Hiring shows only beside what the owner is open to, the form
 * checks the email on leaving it and every field from the first submit,
 * each error under its field, in ink with its cross, the field marked by
 * one 2px orange rule (premium D1); a send that does not go (refused, or lost
 * on the network) stays on the page with the text kept and the ways on,
 * and the draft survives a reload; a sent message says "Message
 * received." and promises nothing; the 404's report arrives with the
 * missed address; Consulting stays hidden while it is off, and without
 * JavaScript the LinkedIn alternative stands in for the form. Nothing on
 * the page is an email address or a phone number.
 *
 * The fixture build has no Resend credentials, so a send is refused there
 * without leaving the machine; a sent message is that refusal answered as
 * sent (`answerAsSent`). A preview deployment has real credentials, so no
 * test sends from it.
 *
 * Route titles and prompts are the profile's words (Site copy), so the
 * specs find a topic by its value and fit fixture and real content alike.
 */
const { form, topics } = contactCopy;

/** A route's radio in the form, by its topic. */
function topicRadio(page: Page, topic: ContactTopic) {
    return page
        .getByRole("main")
        .locator(`input[type="radio"][name="topic"][value="${topic}"]`);
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
    await expect(topicRadio(page, "hello")).toBeChecked();
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
        await expect(page.getByRole("main")).not.toContainText(placeholder);
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
});

test("the routes are the form's topics, each described by the owner's line, with nothing beside them", async ({
    page,
}, testInfo) => {
    await page.goto("/contact");
    const main = page.getByRole("main");
    // No column of routes: no Topics heading, no route rows, and no
    // links in the Message section (the profiles below are the way
    // elsewhere).
    await expect(main.getByRole("heading", { name: "Topics" })).toHaveCount(0);
    await expect(main.locator("[data-topic]")).toHaveCount(0);
    await expect(page.locator("#message").getByRole("link")).toHaveCount(0);
    // Each topic shows no number.
    for (const radio of await main.getByRole("radio").all()) {
        const label = await radio.evaluate(
            (input) => input.closest("label")?.textContent ?? "",
        );
        expect(label.trim()).not.toMatch(/^\d/);
    }
    if (testInfo.project.name === "fixture") {
        // Every route shown is a topic, and no other; a route's line is
        // its radio's description, and its title alone the radio's name.
        const options = topicOptions(contactRoutes(FIXTURE_PROFILE));
        await expect(main.getByRole("radio")).toHaveCount(options.length);
        for (const option of options) {
            const radio = main.getByRole("radio", {
                name: option.label,
                exact: true,
            });
            await expect(radio).toHaveValue(option.value);
            if (option.description) {
                await expect(radio).toHaveAccessibleDescription(
                    option.description,
                );
                await expect(main.getByText(option.description)).toBeVisible();
            }
        }
    }

    const hello = topicRadio(page, "hello");
    await expect(hello).not.toBeChecked();
    await hello.click();
    await expect(hello).toBeChecked();
    await expect(page).toHaveURL(/\/contact#hello$/);
});

test("Hiring shows only beside what the owner is open to", async ({ page }) => {
    await page.goto("/contact");
    const open = await page
        .getByRole("main")
        .getByText(contactCopy.openTo, { exact: true })
        .count();
    await expect(topicRadio(page, "hiring")).toHaveCount(open ? 1 : 0);
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
        // The words are ink with the cross; the field carries the one
        // orange mark, a 2px rule at its start.
        const [accent, ink] = await page.evaluate(() =>
            ["--accent", "--ink-1"].map((token) => {
                const probe = document.createElement("span");
                probe.style.color = `var(${token})`;
                document.body.append(probe);
                const colour = getComputedStyle(probe).color;
                probe.remove();
                return colour;
            }),
        );
        const words = page.locator(".field__error").filter({ hasText: error });
        await expect(words).toHaveCSS("color", ink);
        await expect(words.locator(".icon")).toBeVisible();
        await expect(field).toHaveCSS(
            "box-shadow",
            `${accent} 2px 0px 0px 0px inset`,
        );
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
    const hiring = topicRadio(page, "hiring");
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

test("a sent message is received in place, promising nothing, with the way back", async ({
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
    // No reply promise: the address the reader typed is not repeated,
    // and nothing offers to change it.
    await expect(page.getByRole("main")).not.toContainText(
        "reader@example.com",
    );
    await expect(
        page.getByRole("main").getByRole("button", { name: /change/i }),
    ).toHaveCount(0);

    // A fresh form; a sent message is no draft.
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
    await expect(topicRadio(page, "hello")).toBeChecked();
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
    await expect(topicRadio(page, "consulting")).toHaveCount(0);
    await expect(page.getByRole("radio", { name: consulting })).toHaveCount(0);
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

    test("LinkedIn stands in for the form", async ({ page }) => {
        await page.goto("/contact");
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
    });
});
