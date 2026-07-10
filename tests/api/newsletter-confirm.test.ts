import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getNewsletterConfigMock = vi.fn();
const verifyConfirmTokenMock = vi.fn();
const addContactMock = vi.fn();
const getConfirmBaseUrlMock = vi.fn();

vi.mock("@/lib/newsletter", () => ({
    getNewsletterConfig: getNewsletterConfigMock,
    verifyConfirmToken: verifyConfirmTokenMock,
    addContact: addContactMock,
    getConfirmBaseUrl: getConfirmBaseUrlMock,
}));

const CONFIG = {
    apiKey: "key",
    audienceId: "aud",
    confirmSecret: "secret",
};

function requestWith(query: string): NextRequest {
    // Deliberately a different host than the mocked base URL — redirects
    // must come from getConfirmBaseUrl(), never the request's Host.
    return new NextRequest(
        `https://attacker.example.net/api/newsletter/confirm${query}`,
    );
}

async function importGet() {
    const mod = await import("@/app/api/newsletter/confirm/route");
    return mod.GET;
}

beforeEach(() => {
    vi.resetModules();
    getNewsletterConfigMock.mockReset();
    verifyConfirmTokenMock.mockReset();
    addContactMock.mockReset();
    getNewsletterConfigMock.mockReturnValue(CONFIG);
    verifyConfirmTokenMock.mockReturnValue({ email: "a@example.com" });
    addContactMock.mockResolvedValue({ ok: true });
    getConfirmBaseUrlMock.mockReturnValue("https://preview.example.com");
});

describe("GET /api/newsletter/confirm", () => {
    it("adds the contact and redirects to /newsletter/confirmed for a valid token", async () => {
        const GET = await importGet();

        const res = await GET(requestWith("?token=valid-token"));

        expect(verifyConfirmTokenMock).toHaveBeenCalledWith(
            "valid-token",
            CONFIG.confirmSecret,
        );
        expect(addContactMock).toHaveBeenCalledWith("a@example.com");
        expect(res.status).toBeGreaterThanOrEqual(300);
        expect(res.headers.get("location")).toBe(
            "https://preview.example.com/newsletter/confirmed",
        );
    });

    it("redirects to /newsletter/invalid without adding a contact when the token fails verification", async () => {
        verifyConfirmTokenMock.mockReturnValue(null);
        const GET = await importGet();

        const res = await GET(requestWith("?token=tampered"));

        expect(addContactMock).not.toHaveBeenCalled();
        expect(res.headers.get("location")).toBe(
            "https://preview.example.com/newsletter/invalid",
        );
    });

    it("redirects to /newsletter/invalid when the token is missing", async () => {
        const GET = await importGet();

        const res = await GET(requestWith(""));

        expect(verifyConfirmTokenMock).not.toHaveBeenCalled();
        expect(addContactMock).not.toHaveBeenCalled();
        expect(res.headers.get("location")).toBe(
            "https://preview.example.com/newsletter/invalid",
        );
    });

    it("redirects to /newsletter/invalid when the newsletter is not configured", async () => {
        getNewsletterConfigMock.mockReturnValue(null);
        const GET = await importGet();

        const res = await GET(requestWith("?token=valid-token"));

        expect(addContactMock).not.toHaveBeenCalled();
        expect(res.headers.get("location")).toBe(
            "https://preview.example.com/newsletter/invalid",
        );
    });

    it("redirects to /newsletter/invalid when adding the contact fails", async () => {
        addContactMock.mockResolvedValue({ ok: false });
        const GET = await importGet();

        const res = await GET(requestWith("?token=valid-token"));

        expect(res.headers.get("location")).toBe(
            "https://preview.example.com/newsletter/invalid",
        );
    });
});
