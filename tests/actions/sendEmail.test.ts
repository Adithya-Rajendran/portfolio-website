import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSendMock = vi.fn();
const resolveMxMock = vi.fn();
const headersMock = vi.fn();
const checkBotIdMock = vi.fn();
const checkRateLimitMock = vi.fn();
const getProfileMock = vi.fn();

vi.mock("resend", () => ({
    Resend: class Resend {
        emails = { send: resendSendMock };
    },
}));

vi.mock("dns/promises", () => ({
    default: { resolveMx: resolveMxMock },
    resolveMx: resolveMxMock,
}));

vi.mock("next/headers", () => ({
    headers: headersMock,
}));

vi.mock("botid/server", () => ({
    checkBotId: checkBotIdMock,
}));

vi.mock("@vercel/firewall", () => ({
    checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/email/contact-form-email", () => ({
    default: vi.fn(() => null),
}));

vi.mock("@/lib/sanity-client", () => ({
    getProfile: getProfileMock,
}));

/** A profile whose page shows all four routes. */
const EVERY_ROUTE = {
    availability: {
        status: "open",
        seeking: [{ _key: "a", label: "Summer 2027 internships" }],
        consultingOpen: true,
    },
    contactInvitation: "Write about research.",
};

function formDataOf(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return fd;
}

function withIp(ip: string) {
    headersMock.mockResolvedValue({
        get: (name: string) =>
            name.toLowerCase() === "x-forwarded-for" ? ip : null,
    });
}

async function importSendEmail() {
    const mod = await import("@/actions/sendEmail");
    return mod.sendEmail;
}

async function importEmailTemplate() {
    const mod = await import("@/email/contact-form-email");
    return vi.mocked(mod.default);
}

beforeEach(() => {
    vi.resetModules();
    resendSendMock.mockReset();
    resolveMxMock.mockReset();
    headersMock.mockReset();
    checkBotIdMock.mockReset();
    checkRateLimitMock.mockReset();
    getProfileMock.mockReset();
    getProfileMock.mockResolvedValue(EVERY_ROUTE);
    resendSendMock.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    resolveMxMock.mockResolvedValue([
        { exchange: "mx.example.com", priority: 10 },
    ]);
    // Default mocks: human user, not rate-limited.
    checkBotIdMock.mockResolvedValue({ isBot: false });
    checkRateLimitMock.mockResolvedValue({ rateLimited: false });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("sendEmail — configuration", () => {
    it("answers an unconfigured server with the plain failure line", async () => {
        const key = process.env.RESEND_API_KEY;
        delete process.env.RESEND_API_KEY;
        try {
            const sendEmail = await importSendEmail();
            const result = await sendEmail(
                formDataOf({ senderEmail: "a@example.com", message: "hi" }),
            );
            expect(result).toEqual({ error: "The message could not be sent." });
            expect(checkBotIdMock).not.toHaveBeenCalled();
            expect(resendSendMock).not.toHaveBeenCalled();
        } finally {
            process.env.RESEND_API_KEY = key;
        }
    });
});

describe("sendEmail — BotID", () => {
    it("blocks requests flagged as bots", async () => {
        withIp("10.0.0.1");
        checkBotIdMock.mockResolvedValue({ isBot: true });
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@example.com", message: "hi" }),
        );

        expect(result).toEqual({
            error: "The message could not be verified. Reload the page, then try again.",
        });
        expect(resendSendMock).not.toHaveBeenCalled();
        // BotID is checked first — schema validation shouldn't even run.
        expect(resolveMxMock).not.toHaveBeenCalled();
    });
});

describe("sendEmail — schema validation", () => {
    it("rejects malformed email addresses", async () => {
        withIp("10.0.0.1");
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "not-an-email", message: "hello" }),
        );

        // A field problem, in the form's words, for under its field.
        expect(result).toEqual({
            error: "Enter an email address like you@example.com.",
            field: "senderEmail",
        });
        expect(resendSendMock).not.toHaveBeenCalled();
        expect(resolveMxMock).not.toHaveBeenCalled();
    });

    it("rejects empty messages", async () => {
        withIp("10.0.0.2");
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@example.com", message: "" }),
        );

        expect(result).toEqual({
            error: "Write a message before sending.",
            field: "message",
        });
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("rejects messages over 1000 characters", async () => {
        withIp("10.0.0.3");
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({
                senderEmail: "a@example.com",
                message: "x".repeat(1001),
            }),
        );

        expect(result).toEqual({
            error: "Shorten the message to 1,000 characters or fewer.",
            field: "message",
        });
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("coerces non-string form fields to strings before validation", async () => {
        withIp("10.0.0.4");
        const sendEmail = await importSendEmail();
        const fd = new FormData();
        fd.append("senderEmail", new File(["payload"], "evil.txt"));
        fd.append("message", "hello");

        const result = await sendEmail(fd);

        // File coerced to "[object File]" — fails the email regex
        expect(result).toHaveProperty("error");
        expect(resendSendMock).not.toHaveBeenCalled();
    });
});

describe("sendEmail — Vercel WAF rate limit", () => {
    it("blocks requests when checkRateLimit reports rate-limited", async () => {
        withIp("10.0.2.1");
        checkRateLimitMock.mockResolvedValue({ rateLimited: true });
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@example.com", message: "hi" }),
        );

        expect(result).toEqual({
            error: "Too many messages were sent in a short time. Try again in a few minutes.",
        });
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("calls checkRateLimit with the contact-form rule id and request headers", async () => {
        withIp("10.0.2.2");
        const sendEmail = await importSendEmail();

        await sendEmail(
            formDataOf({ senderEmail: "a@example.com", message: "hi" }),
        );

        expect(checkRateLimitMock).toHaveBeenCalledWith(
            "contact-form",
            expect.objectContaining({
                headers: expect.objectContaining({ get: expect.any(Function) }),
            }),
        );
    });
});

describe("sendEmail — DNS / MX validation", () => {
    it("rejects domains with no MX records", async () => {
        withIp("10.0.1.1");
        resolveMxMock.mockResolvedValue([]);
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@nomx.example", message: "hi" }),
        );

        expect(result).toEqual({
            error: "The domain after the @ does not receive email. Check the address.",
            field: "senderEmail",
        });
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("rejects domains where DNS resolution throws", async () => {
        withIp("10.0.1.2");
        resolveMxMock.mockRejectedValue(new Error("ENOTFOUND"));
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@broken.example", message: "hi" }),
        );

        expect(result).toHaveProperty("error");
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("rejects domains that fail the format pattern without querying DNS", async () => {
        withIp("10.0.1.3");
        const sendEmail = await importSendEmail();

        // Trailing hyphen segment — invalid per RFC 1035
        const result = await sendEmail(
            formDataOf({ senderEmail: "a@-bad-.example", message: "hi" }),
        );

        expect(result).toHaveProperty("error");
        expect(resolveMxMock).not.toHaveBeenCalled();
    });
});

describe("sendEmail — happy path and Resend integration", () => {
    it("sends through Resend with replyTo set to the sender", async () => {
        withIp("10.0.3.1");
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({
                senderEmail: "sender@example.com",
                message: "hello world",
            }),
        );

        expect(result).toHaveProperty("data");
        expect(resendSendMock).toHaveBeenCalledTimes(1);
        const callArgs = resendSendMock.mock.calls[0][0];
        expect(callArgs.replyTo).toBe("sender@example.com");
        expect(callArgs.to).toBe("test@example.com");
        expect(callArgs.subject).toMatch(/contact form/i);
    });

    it("returns a generic error and does not leak details when Resend throws", async () => {
        withIp("10.0.3.2");
        resendSendMock.mockRejectedValue(
            new Error("Resend API token revoked: re_abc123"),
        );
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({
                senderEmail: "sender@example.com",
                message: "hello",
            }),
        );

        expect(result).toEqual({ error: "The message could not be sent." });
        expect((result as { error: string }).error).not.toContain("re_abc123");
    });

    it("reports a send Resend refuses as a failure, not as sent", async () => {
        withIp("10.0.3.3");
        // Resend 6 returns API errors instead of throwing them.
        resendSendMock.mockResolvedValue({
            data: null,
            error: {
                name: "validation_error",
                statusCode: 403,
                message:
                    "The email.adithya-rajendran.com domain is not verified.",
            },
        });
        const { sendEmailAction } = await import("@/actions/sendEmail");
        const { INITIAL_CONTACT_FORM_STATE } = await import("@/lib/contact");

        const result = await sendEmailAction(
            INITIAL_CONTACT_FORM_STATE,
            formDataOf({
                senderEmail: "sender@example.com",
                message: "hello",
            }),
        );

        expect(resendSendMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            status: "error",
            message: "The message could not be sent.",
        });
    });

    it("processes the request when x-forwarded-for is missing", async () => {
        headersMock.mockResolvedValue({ get: () => null });
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({
                senderEmail: "sender@example.com",
                message: "hello",
            }),
        );

        // No XFF header — the action should still process the request.
        // Vercel WAF receives the synthetic Request without that header
        // and falls back to its own IP resolution server-side.
        expect(result).toHaveProperty("data");
    });
});

describe("sendEmail — topic", () => {
    it("sends as a hello when no topic is chosen", async () => {
        withIp("10.0.4.1");
        const sendEmail = await importSendEmail();
        const template = await importEmailTemplate();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@example.com", message: "hi" }),
        );

        expect(result).toMatchObject({ topic: "hello" });
        expect(resendSendMock.mock.calls[0][0].subject).toBe(
            "[Hello] Contact Form for My Website",
        );
        expect(template).toHaveBeenCalledWith({
            message: "hi",
            senderEmail: "a@example.com",
            topic: "hello",
        });
    });

    it("prefixes the subject with the chosen route's topic", async () => {
        withIp("10.0.4.2");
        const sendEmail = await importSendEmail();

        for (const [topic, subject] of [
            ["hiring", "[Hiring] Contact Form for My Website"],
            ["research", "[Research] Contact Form for My Website"],
            ["consulting", "[Consulting] Contact Form for My Website"],
            ["", "[Hello] Contact Form for My Website"],
        ]) {
            resendSendMock.mockClear();
            const result = await sendEmail(
                formDataOf({
                    senderEmail: "a@example.com",
                    message: "hi",
                    topic,
                }),
            );
            expect(result, topic).toMatchObject({ topic: topic || "hello" });
            expect(resendSendMock.mock.calls[0][0].subject, topic).toBe(
                subject,
            );
        }
    });

    it("sends a topic whose route is hidden as a hello", async () => {
        withIp("10.0.4.6");
        // Consulting is off and there is no research invitation.
        getProfileMock.mockResolvedValue({
            availability: { status: "open", consultingOpen: false },
        });
        const sendEmail = await importSendEmail();

        for (const topic of ["consulting", "research"]) {
            resendSendMock.mockClear();
            const result = await sendEmail(
                formDataOf({
                    senderEmail: "a@example.com",
                    message: "hi",
                    topic,
                }),
            );
            expect(result, topic).toMatchObject({ topic: "hello" });
            expect(resendSendMock.mock.calls[0][0].subject, topic).toBe(
                "[Hello] Contact Form for My Website",
            );
        }

        // Hiring shows only while the profile says what the owner is open
        // to: not while availability is Closed, nor without an Open To line.
        for (const availability of [
            { status: "closed" },
            { status: "open", consultingOpen: false },
        ]) {
            getProfileMock.mockResolvedValue({ availability });
            resendSendMock.mockClear();
            await expect(
                sendEmail(
                    formDataOf({
                        senderEmail: "a@example.com",
                        message: "hi",
                        topic: "hiring",
                    }),
                ),
            ).resolves.toMatchObject({ topic: "hello" });
        }
    });

    it("still sends, as a hello, when the profile cannot be read", async () => {
        withIp("10.0.4.7");
        getProfileMock.mockRejectedValue(new Error("Sanity is down"));
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({
                senderEmail: "a@example.com",
                message: "hi",
                topic: "hiring",
            }),
        );

        expect(result).toMatchObject({ topic: "hello" });
        expect(resendSendMock).toHaveBeenCalledTimes(1);
    });

    it("refuses an unknown topic before any lookup or send", async () => {
        withIp("10.0.4.3");
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({
                senderEmail: "a@example.com",
                message: "hi",
                topic: "role",
            }),
        );

        expect(result).toEqual({ error: "Choose one of the listed topics." });
        expect(getProfileMock).not.toHaveBeenCalled();
        expect(resolveMxMock).not.toHaveBeenCalled();
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("still checks BotID first, whatever the topic", async () => {
        withIp("10.0.4.4");
        checkBotIdMock.mockResolvedValue({ isBot: true });
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({
                senderEmail: "a@example.com",
                message: "hi",
                topic: "hiring",
            }),
        );

        expect((result as { error: string }).error).toMatch(/verified/i);
        expect(checkRateLimitMock).not.toHaveBeenCalled();
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("reports a sent message, a field to fix, or a send that did not go", async () => {
        withIp("10.0.4.5");
        const { sendEmailAction } = await import("@/actions/sendEmail");
        const { INITIAL_CONTACT_FORM_STATE } = await import("@/lib/contact");

        await expect(
            sendEmailAction(
                INITIAL_CONTACT_FORM_STATE,
                formDataOf({
                    senderEmail: "a@example.com",
                    message: "hi",
                    topic: "research",
                }),
            ),
        ).resolves.toEqual({ status: "success" });
        await expect(
            sendEmailAction(
                INITIAL_CONTACT_FORM_STATE,
                formDataOf({
                    senderEmail: "a@example.com",
                    message: "",
                    topic: "research",
                }),
            ),
        ).resolves.toEqual({
            status: "invalid",
            field: "message",
            message: "Write a message before sending.",
        });
        checkRateLimitMock.mockResolvedValue({ rateLimited: true });
        await expect(
            sendEmailAction(
                INITIAL_CONTACT_FORM_STATE,
                formDataOf({ senderEmail: "a@example.com", message: "hi" }),
            ),
        ).resolves.toEqual({
            status: "error",
            message:
                "Too many messages were sent in a short time. Try again in a few minutes.",
        });
    });
});
