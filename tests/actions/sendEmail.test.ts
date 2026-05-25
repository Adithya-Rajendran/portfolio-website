import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSendMock = vi.fn();
const resolveMxMock = vi.fn();
const headersMock = vi.fn();

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

vi.mock("@/email/contact-form-email", () => ({
    default: vi.fn(() => null),
}));

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

beforeEach(() => {
    vi.resetModules();
    resendSendMock.mockReset();
    resolveMxMock.mockReset();
    headersMock.mockReset();
    resendSendMock.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    resolveMxMock.mockResolvedValue([
        { exchange: "mx.example.com", priority: 10 },
    ]);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("sendEmail — schema validation", () => {
    it("rejects malformed email addresses", async () => {
        withIp("10.0.0.1");
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "not-an-email", message: "hello" }),
        );

        expect(result).toHaveProperty("error");
        expect(resendSendMock).not.toHaveBeenCalled();
        expect(resolveMxMock).not.toHaveBeenCalled();
    });

    it("rejects empty messages", async () => {
        withIp("10.0.0.2");
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@example.com", message: "" }),
        );

        expect(result).toHaveProperty("error");
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

        expect(result).toHaveProperty("error");
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

describe("sendEmail — DNS / MX validation", () => {
    it("rejects domains with no MX records", async () => {
        withIp("10.0.1.1");
        resolveMxMock.mockResolvedValue([]);
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({ senderEmail: "a@nomx.example", message: "hi" }),
        );

        expect(result).toEqual({
            error: "The email domain does not appear to exist. Please check your email address.",
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

    it("blocks an IP after repeated invalid-domain attempts", async () => {
        const ip = "10.0.1.99";
        withIp(ip);
        resolveMxMock.mockResolvedValue([]);
        const sendEmail = await importSendEmail();

        // INVALID_DOMAIN_MAX is 5 — trip the limit
        for (let i = 0; i < 5; i++) {
            await sendEmail(
                formDataOf({
                    senderEmail: `a${i}@nomx.example`,
                    message: "hi",
                }),
            );
        }

        // Sixth attempt should now be blocked outright, even with a valid email
        resolveMxMock.mockResolvedValue([
            { exchange: "mx.example.com", priority: 10 },
        ]);
        const blocked = await sendEmail(
            formDataOf({ senderEmail: "real@example.com", message: "hi" }),
        );

        expect(blocked).toHaveProperty("error");
        expect((blocked as { error: string }).error).toMatch(/blocked/i);
        expect(resendSendMock).not.toHaveBeenCalled();
    });
});

describe("sendEmail — rate limiting", () => {
    it("rate-limits after RATE_LIMIT_MAX successful submissions from the same IP", async () => {
        const ip = "10.0.2.1";
        withIp(ip);
        const sendEmail = await importSendEmail();

        // RATE_LIMIT_MAX is 3 — fourth call should be rate-limited
        for (let i = 0; i < 3; i++) {
            const result = await sendEmail(
                formDataOf({ senderEmail: "a@example.com", message: "hi" }),
            );
            expect(result).toHaveProperty("data");
        }

        const fourth = await sendEmail(
            formDataOf({ senderEmail: "a@example.com", message: "hi" }),
        );

        expect(fourth).toHaveProperty("error");
        expect((fourth as { error: string }).error).toMatch(/exceeded/i);
        expect(resendSendMock).toHaveBeenCalledTimes(3);
    });

    it("rate-limits independently per IP", async () => {
        const sendEmail = await importSendEmail();

        for (let i = 0; i < 3; i++) {
            withIp("10.0.2.10");
            await sendEmail(
                formDataOf({ senderEmail: "a@example.com", message: "hi" }),
            );
        }

        // Different IP — should still go through
        withIp("10.0.2.11");
        const result = await sendEmail(
            formDataOf({ senderEmail: "a@example.com", message: "hi" }),
        );

        expect(result).toHaveProperty("data");
    });

    it("extracts the last entry from x-forwarded-for (the trusted proxy IP)", async () => {
        // Spoofed IP first, real Vercel IP last
        headersMock.mockResolvedValue({
            get: (name: string) =>
                name.toLowerCase() === "x-forwarded-for"
                    ? "1.2.3.4, 5.6.7.8, 10.0.2.42"
                    : null,
        });
        const sendEmail = await importSendEmail();

        for (let i = 0; i < 3; i++) {
            await sendEmail(
                formDataOf({ senderEmail: "a@example.com", message: "hi" }),
            );
        }

        // The trusted IP (10.0.2.42) is the rate-limit key.
        // A request from the spoofed IP claimed in the leftmost position
        // would otherwise reset the counter — verify it doesn't.
        headersMock.mockResolvedValue({
            get: (name: string) =>
                name.toLowerCase() === "x-forwarded-for"
                    ? "9.9.9.9, 8.8.8.8, 10.0.2.42"
                    : null,
        });
        const fourth = await sendEmail(
            formDataOf({ senderEmail: "a@example.com", message: "hi" }),
        );

        expect(fourth).toHaveProperty("error");
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

        expect(result).toEqual({
            error: "Failed to send the email. Please try again later.",
        });
        expect((result as { error: string }).error).not.toContain("re_abc123");
    });

    it("falls back to 127.0.0.1 when x-forwarded-for is missing", async () => {
        headersMock.mockResolvedValue({ get: () => null });
        const sendEmail = await importSendEmail();

        const result = await sendEmail(
            formDataOf({
                senderEmail: "sender@example.com",
                message: "hello",
            }),
        );

        // No XFF header — the action should still process the request
        expect(result).toHaveProperty("data");
    });
});
