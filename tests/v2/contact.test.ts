import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { env } from "./worker-env";

vi.mock("cloudflare:workers", () => ({ env }));
vi.mock("../../src/lib/sanity", () => ({
    getProfile: vi.fn().mockResolvedValue(null),
}));
import { POST } from "../../src/pages/api/contact";

const secrets = {
    TURNSTILE_SECRET: "turnstile-secret-test",
    RESEND_API_KEY: "resend-secret-test",
};
const limit = vi.fn();
const fetchMock = vi.fn();
const fields = {
    senderEmail: "person@example.com",
    message: "Hello there",
    topic: "hello",
    "cf-turnstile-response": "test-token",
};
function request(
    overrides: Partial<typeof fields> = {},
    options: {
        origin?: string;
        type?: string;
        body?: string;
        ip?: string;
    } = {},
) {
    const body =
        options.body ??
        new URLSearchParams({ ...fields, ...overrides }).toString();
    const req = new Request("https://example.com/api/contact", {
        method: "POST",
        headers: {
            origin: options.origin ?? "https://example.com",
            "content-type": options.type ?? "application/x-www-form-urlencoded",
            ...(options.ip === ""
                ? {}
                : { "CF-Connecting-IP": options.ip ?? "192.0.2.1" }),
        },
        body,
    });
    return POST({ request: req, url: new URL(req.url) } as Parameters<
        typeof POST
    >[0]);
}
function provider(input: string | URL | Request) {
    const url = String(input);
    if (url.includes("siteverify"))
        return Response.json({
            success: true,
            hostname: "example.com",
            action: "contact",
        });
    if (url.includes("dns-query"))
        return Response.json({
            Status: 0,
            Answer: [{ type: 15, data: "10 mail.example.com." }],
        });
    if (url.includes("api.resend.com"))
        return Response.json({ id: "message-123" });
    throw new Error(`Unexpected provider ${url}`);
}
beforeEach(() => {
    Object.assign(env, {
        ...secrets,
        TURNSTILE_HOSTNAMES: "example.com",
        CONTACT_RATE_LIMIT: { limit },
        CONTACT_FORM_TO_EMAIL: "owner@example.com",
        CONTACT_FROM_EMAIL: "site@example.com",
    });
    limit.mockReset().mockResolvedValue({ success: true });
    fetchMock.mockReset().mockImplementation(provider);
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(env)) delete env[key];
});

describe("contact Worker", () => {
    it("rejects cross-origin, wrong content type, and oversized bodies before providers", async () => {
        expect(
            (await request({}, { origin: "https://evil.example" })).status,
        ).toBe(403);
        expect((await request({}, { type: "application/json" })).status).toBe(
            415,
        );
        expect((await request({}, { body: "a".repeat(16385) })).status).toBe(
            413,
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it.each([{ senderEmail: "bad" }, { message: "   " }, { topic: "invalid" }])(
        "rejects invalid input %o",
        async (invalid) => {
            expect((await request(invalid)).status).toBe(400);
            expect(limit).not.toHaveBeenCalled();
        },
    );
    it("fails closed when rate limiting is unavailable, fails, or exceeds the limit", async () => {
        delete env.CONTACT_RATE_LIMIT;
        expect((await request()).status).toBe(503);
        env.CONTACT_RATE_LIMIT = { limit };
        expect((await request({}, { ip: "" })).status).toBe(503);
        limit.mockRejectedValueOnce(new Error("limiter down"));
        expect((await request()).status).toBe(503);
        limit.mockResolvedValueOnce({ success: false });
        expect((await request()).status).toBe(429);
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it("rejects missing verification and does not contact providers", async () => {
        expect((await request({ "cf-turnstile-response": "" })).status).toBe(
            403,
        );
        delete env.TURNSTILE_SECRET;
        expect((await request()).status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it.each([
        { success: false, "error-codes": ["timeout-or-duplicate"] },
        { success: false, "error-codes": ["invalid-input-response"] },
        { success: true, hostname: "evil.example", action: "contact" },
        { success: true, hostname: "example.com", action: "login" },
    ])("rejects a failed or mismatched verification: %o", async (result) => {
        fetchMock.mockResolvedValueOnce(Response.json(result));
        expect((await request()).status).toBe(403);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it("fails closed on verification service failure", async () => {
        fetchMock.mockRejectedValueOnce(new Error("service unavailable"));
        expect((await request()).status).toBe(403);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it("sends a verified message through Resend", async () => {
        const response = await request();
        expect(response.status).toBe(200);
        const call = fetchMock.mock.calls.find(([url]) =>
            String(url).includes("api.resend.com"),
        );
        expect(call).toBeDefined();
        expect(JSON.parse(call![1].body)).toMatchObject({
            reply_to: "person@example.com",
            text: expect.stringContaining("Hello there"),
        });
        expect(response.headers.get("cache-control")).toBe("no-store");
        const html = await response.text();
        expect(html).toContain("<h1>Message sent</h1>");
        expect(html).toContain("Thank you for getting in touch.");
        expect(html).toContain(
            'sessionStorage.removeItem("contact:senderEmail")',
        );
        expect(html).toContain('sessionStorage.removeItem("contact:message")');
    });
    it.each([
        new Response("refused", { status: 400 }),
        Response.json({}),
        new Response("invalid json"),
    ])(
        "does not claim success when Resend refuses or does not confirm acceptance",
        async (resend) => {
            fetchMock.mockImplementation((url: string) =>
                url.includes("api.resend.com") ? resend : provider(url),
            );
            expect((await request()).status).toBe(502);
        },
    );
    it("does not expose secrets or provider errors to visitors or logs", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        fetchMock.mockImplementation((url: string) =>
            url.includes("api.resend.com")
                ? Promise.reject(new Error(`failed ${secrets.RESEND_API_KEY}`))
                : provider(url),
        );
        const response = await request();
        const text = await response.text();
        expect(response.status).toBe(502);
        expect(text).toContain("<h1>Contact</h1>");
        expect(text).toContain(
            "The message could not be sent. Please try again later.",
        );
        expect(text).toContain('href="/contact"');
        expect(text).not.toContain("sessionStorage.removeItem");
        for (const secret of Object.values(secrets)) {
            expect(text).not.toContain(secret);
            expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
        }
    });
});
