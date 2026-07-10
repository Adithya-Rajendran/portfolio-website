import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// lib/newsletter.ts is server-only; the guard module throws outside RSC.
vi.mock("server-only", () => ({}));

// Not exercised by the token functions, but imported by the module.
vi.mock("@/email/newsletter-confirm-email", () => ({
    default: vi.fn(() => null),
}));

import {
    CONFIRM_TOKEN_TTL_MS,
    createConfirmToken,
    verifyConfirmToken,
} from "@/lib/newsletter";

const SECRET = "unit-test-secret";
const NOW = 1_700_000_000_000;

describe("newsletter confirm tokens", () => {
    it("round-trips a valid email", () => {
        const token = createConfirmToken("a@example.com", SECRET, NOW);

        expect(verifyConfirmToken(token, SECRET, NOW)).toEqual({
            email: "a@example.com",
        });
    });

    it("accepts a token right up to its expiry and rejects it after", () => {
        const token = createConfirmToken("a@example.com", SECRET, NOW);
        const expiry = NOW + CONFIRM_TOKEN_TTL_MS;

        expect(verifyConfirmToken(token, SECRET, expiry)).not.toBeNull();
        expect(verifyConfirmToken(token, SECRET, expiry + 1)).toBeNull();
    });

    it("rejects a tampered payload", () => {
        const token = createConfirmToken("a@example.com", SECRET, NOW);
        const [, signature] = token.split(".");
        const forgedPayload = Buffer.from(
            `b@example.com|${NOW + CONFIRM_TOKEN_TTL_MS}`,
        ).toString("base64url");

        expect(
            verifyConfirmToken(`${forgedPayload}.${signature}`, SECRET, NOW),
        ).toBeNull();
    });

    it("rejects a tampered signature", () => {
        const token = createConfirmToken("a@example.com", SECRET, NOW);
        const [payload] = token.split(".");
        const forgedSignature = Buffer.from("x".repeat(32)).toString(
            "base64url",
        );

        expect(
            verifyConfirmToken(`${payload}.${forgedSignature}`, SECRET, NOW),
        ).toBeNull();
    });

    it("rejects a token signed with a different secret", () => {
        const token = createConfirmToken("a@example.com", "other-secret", NOW);

        expect(verifyConfirmToken(token, SECRET, NOW)).toBeNull();
    });

    it("rejects malformed tokens", () => {
        for (const bad of [
            "",
            "just-one-part",
            "a.b.c",
            "!!!not-base64url!!!.sig",
            `${Buffer.from("no-separator").toString("base64url")}.sig`,
        ]) {
            expect(verifyConfirmToken(bad, SECRET, NOW)).toBeNull();
        }
    });

    it("refuses to sign an email that fails the shared charset allowlist", () => {
        // "|" is the payload separator; the charset regex already forbids it.
        expect(() =>
            createConfirmToken("a|b@example.com", SECRET, NOW),
        ).toThrow();
    });

    it("rejects a signed payload whose email fails the charset allowlist", () => {
        // Forge structurally (valid HMAC, bad email) via the same primitives.
        const payload = `a|b@example.com|${NOW + CONFIRM_TOKEN_TTL_MS}`;
        const sig = createHmac("sha256", SECRET)
            .update(payload)
            .digest()
            .toString("base64url");
        const token = `${Buffer.from(payload).toString("base64url")}.${sig}`;

        expect(verifyConfirmToken(token, SECRET, NOW)).toBeNull();
    });
});
