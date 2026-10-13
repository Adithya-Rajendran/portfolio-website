import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveMxMock, resolve4Mock, resolve6Mock, cancelMock } = vi.hoisted(
    () => ({
        resolveMxMock: vi.fn(),
        resolve4Mock: vi.fn(),
        resolve6Mock: vi.fn(),
        cancelMock: vi.fn(),
    }),
);

vi.mock("dns/promises", () => {
    class Resolver {
        resolveMx = resolveMxMock;
        resolve4 = resolve4Mock;
        resolve6 = resolve6Mock;
        cancel = cancelMock;
    }
    return { default: { Resolver }, Resolver };
});

import {
    MAIL_CHECK_TIMEOUT_MS,
    asciiAddress,
    mayReceiveMail,
} from "@/lib/email-validation";

/** A DNS failure as Node reports it, by its code. */
function dnsError(code: string) {
    return Object.assign(new Error(`query ${code} example`), { code });
}

beforeEach(() => {
    resolveMxMock.mockReset();
    resolve4Mock.mockReset();
    resolve6Mock.mockReset();
    cancelMock.mockReset();
    resolveMxMock.mockResolvedValue([{ exchange: "mx.example", priority: 10 }]);
    resolve4Mock.mockRejectedValue(dnsError("ENODATA"));
    resolve6Mock.mockRejectedValue(dnsError("ENODATA"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("asciiAddress", () => {
    it("writes the domain in ASCII and keeps the local part", () => {
        expect(asciiAddress("o'brien@example.com")).toBe("o'brien@example.com");
        expect(asciiAddress("user@Bücher.de")).toBe("user@xn--bcher-kva.de");
    });

    it("has no answer for a domain DNS could not take", () => {
        expect(asciiAddress("a@-bad-.example")).toBeNull();
        expect(asciiAddress("a@localhost")).toBeNull();
        expect(asciiAddress("no-at-sign")).toBeNull();
    });

    it("has no answer when the ASCII address passes 254 characters", () => {
        // "bücher" is "xn--bcher-kva" in ASCII: seven characters longer.
        const typed = (n: number) =>
            `${"a".repeat(64)}@${"d".repeat(63)}.${"e".repeat(63)}.${"f".repeat(n)}.bücher.de`;
        expect(typed(40)).toHaveLength(243);
        expect(asciiAddress(typed(40))).toHaveLength(250);
        // 253 as typed, which the form takes, but 260 sent: refused.
        expect(typed(50)).toHaveLength(253);
        expect(asciiAddress(typed(50))).toBeNull();
    });
});

describe("mayReceiveMail", () => {
    it("says yes for a domain with an MX record", async () => {
        await expect(mayReceiveMail("a@example.com")).resolves.toBe(true);
        expect(resolveMxMock).toHaveBeenCalledWith("example.com");
    });

    it("says no only when DNS says the domain takes no mail", async () => {
        // No such domain.
        resolveMxMock.mockRejectedValue(dnsError("ENOTFOUND"));
        await expect(mayReceiveMail("a@nowhere.example")).resolves.toBe(false);
        // No MX and no address to fall back to.
        resolveMxMock.mockRejectedValue(dnsError("ENODATA"));
        await expect(mayReceiveMail("a@bare.example")).resolves.toBe(false);
        // A null MX (RFC 7505).
        resolveMxMock.mockResolvedValue([{ exchange: "", priority: 0 }]);
        await expect(mayReceiveMail("a@nomail.example")).resolves.toBe(false);
    });

    it("falls back to the domain's own address without an MX record", async () => {
        resolveMxMock.mockRejectedValue(dnsError("ENODATA"));
        resolve6Mock.mockResolvedValue(["2001:db8::1"]);
        await expect(mayReceiveMail("a@v6.example")).resolves.toBe(true);
    });

    it("lets the message through, logged, when a lookup cannot finish", async () => {
        for (const code of ["ETIMEOUT", "ESERVFAIL", "ECONNREFUSED"]) {
            resolveMxMock.mockRejectedValue(dnsError(code));
            await expect(mayReceiveMail("a@flaky.example"), code).resolves.toBe(
                true,
            );
            expect(console.warn).toHaveBeenLastCalledWith(
                expect.stringContaining(code),
            );
        }
    });

    it("gives up after its time limit and cancels the lookup", async () => {
        vi.useFakeTimers();
        resolveMxMock.mockReturnValue(new Promise(() => {}));
        const answer = mayReceiveMail("a@slow.example");
        await vi.advanceTimersByTimeAsync(MAIL_CHECK_TIMEOUT_MS);
        await expect(answer).resolves.toBe(true);
        expect(cancelMock).toHaveBeenCalledTimes(1);
        expect(MAIL_CHECK_TIMEOUT_MS).toBeLessThanOrEqual(3000);
    });

    it("asks DNS nothing for a malformed domain", async () => {
        await expect(mayReceiveMail("a@-bad-.example")).resolves.toBe(false);
        expect(resolveMxMock).not.toHaveBeenCalled();
    });
});
