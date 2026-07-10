import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSendMock = vi.fn();
const resendContactsCreateMock = vi.fn();
const resolveMxMock = vi.fn();
const headersMock = vi.fn();
const checkBotIdMock = vi.fn();
const checkRateLimitMock = vi.fn();
const confirmEmailMock = vi.fn((_props: { confirmUrl: string }) => null);

vi.mock("resend", () => ({
    Resend: class Resend {
        emails = { send: resendSendMock };
        contacts = { create: resendContactsCreateMock };
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

vi.mock("@/email/newsletter-confirm-email", () => ({
    default: confirmEmailMock,
}));

vi.mock("server-only", () => ({}));

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

async function importSubscribe() {
    const mod = await import("@/actions/subscribe");
    return mod.subscribe;
}

beforeEach(() => {
    vi.resetModules();
    resendSendMock.mockReset();
    resendContactsCreateMock.mockReset();
    resolveMxMock.mockReset();
    headersMock.mockReset();
    checkBotIdMock.mockReset();
    checkRateLimitMock.mockReset();
    confirmEmailMock.mockClear();
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

describe("subscribe — configuration", () => {
    it("returns a friendly error when newsletter env vars are missing", async () => {
        const saved = process.env.RESEND_AUDIENCE_ID;
        delete process.env.RESEND_AUDIENCE_ID;
        try {
            const subscribe = await importSubscribe();

            const result = await subscribe(
                formDataOf({ email: "a@example.com" }),
            );

            expect(result).toHaveProperty("error");
            expect((result as { error: string }).error).toMatch(
                /not configured/i,
            );
            expect(resendSendMock).not.toHaveBeenCalled();
        } finally {
            process.env.RESEND_AUDIENCE_ID = saved;
        }
    });
});

describe("subscribe — BotID", () => {
    it("blocks requests flagged as bots", async () => {
        withIp("10.0.0.1");
        checkBotIdMock.mockResolvedValue({ isBot: true });
        const subscribe = await importSubscribe();

        const result = await subscribe(formDataOf({ email: "a@example.com" }));

        expect(result).toHaveProperty("error");
        expect((result as { error: string }).error).toMatch(/verification/i);
        expect(resendSendMock).not.toHaveBeenCalled();
        // BotID is checked first — schema validation shouldn't even run.
        expect(resolveMxMock).not.toHaveBeenCalled();
    });
});

describe("subscribe — schema validation", () => {
    it("rejects malformed email addresses", async () => {
        withIp("10.0.0.2");
        const subscribe = await importSubscribe();

        const result = await subscribe(formDataOf({ email: "not-an-email" }));

        expect(result).toHaveProperty("error");
        expect(resendSendMock).not.toHaveBeenCalled();
        expect(resolveMxMock).not.toHaveBeenCalled();
    });

    it("coerces non-string form fields to strings before validation", async () => {
        withIp("10.0.0.3");
        const subscribe = await importSubscribe();
        const fd = new FormData();
        fd.append("email", new File(["payload"], "evil.txt"));

        const result = await subscribe(fd);

        // File coerced to "[object File]" — fails the email regex
        expect(result).toHaveProperty("error");
        expect(resendSendMock).not.toHaveBeenCalled();
    });
});

describe("subscribe — Vercel WAF rate limit", () => {
    it("blocks requests when checkRateLimit reports rate-limited", async () => {
        withIp("10.0.2.1");
        checkRateLimitMock.mockResolvedValue({ rateLimited: true });
        const subscribe = await importSubscribe();

        const result = await subscribe(formDataOf({ email: "a@example.com" }));

        expect(result).toHaveProperty("error");
        expect((result as { error: string }).error).toMatch(/too many/i);
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("calls checkRateLimit with the newsletter-subscribe rule id and request headers", async () => {
        withIp("10.0.2.2");
        const subscribe = await importSubscribe();

        await subscribe(formDataOf({ email: "a@example.com" }));

        expect(checkRateLimitMock).toHaveBeenCalledWith(
            "newsletter-subscribe",
            expect.objectContaining({
                headers: expect.objectContaining({ get: expect.any(Function) }),
            }),
        );
    });
});

describe("subscribe — DNS / MX validation", () => {
    it("rejects domains with no MX records", async () => {
        withIp("10.0.1.1");
        resolveMxMock.mockResolvedValue([]);
        const subscribe = await importSubscribe();

        const result = await subscribe(formDataOf({ email: "a@nomx.example" }));

        expect(result).toEqual({
            error: "The email domain does not appear to exist. Please check your email address.",
        });
        expect(resendSendMock).not.toHaveBeenCalled();
    });

    it("rejects domains that fail the format pattern without querying DNS", async () => {
        withIp("10.0.1.2");
        const subscribe = await importSubscribe();

        // Trailing hyphen segment — invalid per RFC 1035
        const result = await subscribe(
            formDataOf({ email: "a@-bad-.example" }),
        );

        expect(result).toHaveProperty("error");
        expect(resolveMxMock).not.toHaveBeenCalled();
    });
});

describe("subscribe — double opt-in confirmation email", () => {
    it("emails the subscriber a valid confirmation link and stores nothing", async () => {
        withIp("10.0.3.1");
        const subscribe = await importSubscribe();

        const result = await subscribe(
            formDataOf({ email: "subscriber@example.com" }),
        );

        expect(result).toHaveProperty("data");
        expect(resendSendMock).toHaveBeenCalledTimes(1);
        const callArgs = resendSendMock.mock.calls[0][0];
        // The confirmation goes to the subscriber, not the site owner.
        expect(callArgs.to).toBe("subscriber@example.com");
        expect(callArgs.subject).toMatch(/confirm/i);

        // Double opt-in: signing up must NOT add the contact yet.
        expect(resendContactsCreateMock).not.toHaveBeenCalled();

        // The emailed link carries a token that round-trips verification.
        const { confirmUrl } = confirmEmailMock.mock.calls[0][0];
        const url = new URL(confirmUrl);
        expect(url.pathname).toBe("/api/newsletter/confirm");
        const { verifyConfirmToken } = await import("@/lib/newsletter");
        expect(
            verifyConfirmToken(
                url.searchParams.get("token") ?? "",
                process.env.NEWSLETTER_CONFIRM_SECRET ?? "",
            ),
        ).toEqual({ email: "subscriber@example.com" });
    });

    it("returns a generic error and does not leak details when Resend throws", async () => {
        withIp("10.0.3.2");
        resendSendMock.mockRejectedValue(
            new Error("Resend API token revoked: re_abc123"),
        );
        const subscribe = await importSubscribe();

        const result = await subscribe(
            formDataOf({ email: "subscriber@example.com" }),
        );

        expect(result).toHaveProperty("error");
        expect((result as { error: string }).error).not.toContain("re_abc123");
    });

    it("returns a generic error when the confirmation send is rejected", async () => {
        withIp("10.0.3.3");
        resendSendMock.mockResolvedValue({
            data: null,
            error: { name: "application_error", message: "boom" },
        });
        const subscribe = await importSubscribe();

        const result = await subscribe(
            formDataOf({ email: "subscriber@example.com" }),
        );

        expect(result).toEqual({
            error: "Failed to send the confirmation email. Please try again later.",
        });
    });
});
