import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSendMock = vi.fn();
const resolveMxMock = vi.fn();
const resolve4Mock = vi.fn();
const resolve6Mock = vi.fn();
const headersMock = vi.fn();
const checkBotIdMock = vi.fn();
const checkRateLimitMock = vi.fn();
const getProfileMock = vi.fn();

vi.mock("resend", () => ({
    Resend: class Resend {
        emails = { send: resendSendMock };
    },
}));

vi.mock("dns/promises", () => {
    class Resolver {
        resolveMx = resolveMxMock;
        resolve4 = resolve4Mock;
        resolve6 = resolve6Mock;
        cancel = vi.fn();
    }
    return { default: { Resolver }, Resolver };
});

vi.mock("next/headers", () => ({
    headers: headersMock,
}));

vi.mock("botid/server", () => ({
    checkBotId: checkBotIdMock,
}));

vi.mock("@vercel/firewall", () => ({
    checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/email/contact-form-email", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/email/contact-form-email")>()),
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

/** A DNS failure as Node reports it, by its code. */
function dnsError(code: string) {
    return Object.assign(new Error(`queryMx ${code} example`), { code });
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
    resolve4Mock.mockReset();
    resolve6Mock.mockReset();
    headersMock.mockReset();
    checkBotIdMock.mockReset();
    checkRateLimitMock.mockReset();
    getProfileMock.mockReset();
    getProfileMock.mockResolvedValue(EVERY_ROUTE);
    resendSendMock.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    resolveMxMock.mockResolvedValue([
        { exchange: "mx.example.com", priority: 10 },
    ]);
    resolve4Mock.mockRejectedValue(dnsError("ENODATA"));
    resolve6Mock.mockRejectedValue(dnsError("ENODATA"));
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

    it("accepts every address the form accepts: an apostrophe, a tag, a domain in any script", async () => {
        withIp("10.0.0.5");
        const sendEmail = await importSendEmail();

        for (const [typed, sent] of [
            ["o'brien@example.com", "o'brien@example.com"],
            [
                "first.last+tag@sub.example.co.uk",
                "first.last+tag@sub.example.co.uk",
            ],
            // The domain goes out in ASCII, as DNS and mail servers take it.
            ["user@bücher.de", "user@xn--bcher-kva.de"],
        ]) {
            resendSendMock.mockClear();
            const result = await sendEmail(
                formDataOf({ senderEmail: typed, message: "hello" }),
            );
            expect(result, typed).toHaveProperty("data");
            expect(resendSendMock.mock.calls[0][0].replyTo, typed).toBe(sent);
        }
        expect(resolveMxMock).toHaveBeenCalledWith("xn--bcher-kva.de");
    });

    it("refuses an empty address as the form does", async () => {
        withIp("10.0.0.6");
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "  ", message: "hello" }),
        );

        expect(result).toEqual({
            error: "Enter your email address.",
            field: "senderEmail",
        });
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

describe("sendEmail — fallback limit while the WAF rule is missing", () => {
    it("allows five sends an address in ten minutes, then refuses, logging once", async () => {
        checkRateLimitMock.mockResolvedValue({
            rateLimited: false,
            error: "not-found",
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const sendEmail = await importSendEmail();
        const send = () =>
            sendEmail(
                formDataOf({ senderEmail: "a@example.com", message: "hi" }),
            );

        withIp("10.0.5.1");
        for (let i = 0; i < 5; i += 1) {
            await expect(send()).resolves.toHaveProperty("data");
        }
        await expect(send()).resolves.toEqual({
            error: "Too many messages were sent in a short time. Try again in a few minutes.",
        });
        expect(resendSendMock).toHaveBeenCalledTimes(5);

        // Another address has its own count.
        withIp("10.0.5.2");
        await expect(send()).resolves.toHaveProperty("data");

        const notes = warn.mock.calls.filter(([line]) =>
            String(line).includes('"contact-form"'),
        );
        expect(notes).toHaveLength(1);
        warn.mockRestore();
    });

    it("leaves the count to the WAF rule while it exists", async () => {
        const sendEmail = await importSendEmail();

        withIp("10.0.5.3");
        for (let i = 0; i < 7; i += 1) {
            await expect(
                sendEmail(
                    formDataOf({ senderEmail: "a@example.com", message: "hi" }),
                ),
            ).resolves.toHaveProperty("data");
        }
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

    it("rejects a domain DNS says does not exist", async () => {
        withIp("10.0.1.2");
        resolveMxMock.mockRejectedValue(dnsError("ENOTFOUND"));
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@broken.example", message: "hi" }),
        );

        expect(result).toEqual({
            error: "The domain after the @ does not receive email. Check the address.",
            field: "senderEmail",
        });
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("sends when a lookup cannot finish, and logs it", async () => {
        withIp("10.0.1.4");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const sendEmail = await importSendEmail();

        for (const code of ["ETIMEOUT", "ESERVFAIL", "ECONNREFUSED"]) {
            resendSendMock.mockClear();
            resolveMxMock.mockRejectedValue(dnsError(code));
            const result = await sendEmail(
                formDataOf({ senderEmail: "a@slow.example", message: "hi" }),
            );
            expect(result, code).toHaveProperty("data");
            expect(warn).toHaveBeenLastCalledWith(
                expect.stringContaining(code),
            );
        }
        warn.mockRestore();
    });

    it("sends to a domain without MX that has an address (implicit MX)", async () => {
        withIp("10.0.1.5");
        resolveMxMock.mockRejectedValue(dnsError("ENODATA"));
        resolve4Mock.mockResolvedValue(["192.0.2.10"]);
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@a-only.example", message: "hi" }),
        );

        expect(result).toHaveProperty("data");
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

describe("sendEmail — the email", () => {
    it("keeps the sender's paragraphs in the HTML and the plain-text part", async () => {
        withIp("10.0.6.1");
        const sendEmail = await importSendEmail();
        const message = "Hi Adithya,\n\nSecond paragraph.\n- one\n- two";

        await sendEmail(formDataOf({ senderEmail: "a@example.com", message }));

        const { text } = resendSendMock.mock.calls[0][0];
        expect(text).toContain(message);
        expect(text).toContain("Topic: Hello");
        expect(text).toContain("The sender's email is: a@example.com");

        const { default: Email } = await vi.importActual<
            typeof import("@/email/contact-form-email")
        >("@/email/contact-form-email");
        const { render } = await import("react-email");
        const html = await render(
            Email({ message, senderEmail: "a@example.com", topic: "hello" }),
        );
        const paragraph = /<p[^>]*white-space:pre-wrap[^>]*>([^<]*)<\/p>/.exec(
            html,
        );
        expect(paragraph?.[1]).toBe(message);
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
