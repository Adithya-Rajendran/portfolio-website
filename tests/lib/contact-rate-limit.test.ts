import { describe, expect, it } from "vitest";
import {
    CONTACT_FALLBACK_LIMITS,
    createFallbackLimiter,
    senderAddress,
} from "@/lib/contact-rate-limit";

const LIMITS = { windowMs: 1000, perAddress: 2, total: 3 };

describe("the contact form's fallback limit", () => {
    it("allows an address its sends in a window, then refuses until the window ends", () => {
        const limited = createFallbackLimiter(LIMITS);
        expect(limited("a", 0)).toBe(false);
        expect(limited("a", 10)).toBe(false);
        expect(limited("a", 20)).toBe(true);
        expect(limited("a", 999)).toBe(true);
        // A new window starts from the next send after it ends.
        expect(limited("a", 1000)).toBe(false);
    });

    it("caps what the instance sends from every address together", () => {
        const limited = createFallbackLimiter(LIMITS);
        expect(limited("a", 0)).toBe(false);
        expect(limited("b", 1)).toBe(false);
        expect(limited("c", 2)).toBe(false);
        expect(limited("d", 3)).toBe(true);
        expect(limited("d", 1000)).toBe(false);
    });

    it("counts a refused send against nothing", () => {
        const limited = createFallbackLimiter(LIMITS);
        limited("a", 0);
        limited("a", 1);
        // Refused: neither the address's count nor the total moves.
        expect(limited("a", 2)).toBe(true);
        expect(limited("b", 3)).toBe(false);
    });

    it("is the WAF rule's figure: five an address in ten minutes", () => {
        expect(CONTACT_FALLBACK_LIMITS).toMatchObject({
            windowMs: 600_000,
            perAddress: 5,
        });
        expect(CONTACT_FALLBACK_LIMITS.total).toBeGreaterThan(
            CONTACT_FALLBACK_LIMITS.perAddress,
        );
    });
});

describe("the sender's address", () => {
    const headersOf = (values: Record<string, string>) => ({
        get: (name: string) => values[name.toLowerCase()] ?? null,
    });

    it("reads Vercel's x-real-ip, else the first x-forwarded-for entry", () => {
        expect(
            senderAddress(
                headersOf({
                    "x-real-ip": "198.51.100.7",
                    "x-forwarded-for": "203.0.113.1",
                }),
            ),
        ).toBe("198.51.100.7");
        expect(
            senderAddress(
                headersOf({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }),
            ),
        ).toBe("203.0.113.1");
        expect(senderAddress(headersOf({}))).toBe("unknown");
    });
});
