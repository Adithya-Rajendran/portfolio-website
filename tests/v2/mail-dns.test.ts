import { afterEach, describe, expect, it, vi } from "vitest";
import { asciiAddress, mayReceiveMail } from "../../src/lib/mail-dns";

afterEach(() => vi.unstubAllGlobals());
describe("Worker mail DNS", () => {
    it("normalizes international domain names to ASCII", () => {
        expect(asciiAddress("person@bücher.example")).toBe(
            "person@xn--bcher-kva.example",
        );
        expect(asciiAddress("person@-bad.example")).toBeNull();
    });
    it("rejects a null MX without falling back to address records", async () => {
        const fetch = vi.fn().mockResolvedValue(
            Response.json({
                Status: 0,
                Answer: [{ type: 15, data: "0 ." }],
            }),
        );
        vi.stubGlobal("fetch", fetch);
        expect(await mayReceiveMail("person@example.com")).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it("accepts address records when no MX exists", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockImplementation((url: URL) =>
                Response.json({
                    Status: 0,
                    Answer:
                        url.searchParams.get("type") === "A"
                            ? [{ type: 1, data: "192.0.2.1" }]
                            : [],
                }),
            ),
        );
        expect(await mayReceiveMail("person@example.com")).toBe(true);
    });
    it("rejects NXDOMAIN but allows transient DNS failures", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(Response.json({ Status: 3 }))
            .mockRejectedValueOnce(new Error("DNS unavailable"));
        vi.stubGlobal("fetch", fetch);
        expect(await mayReceiveMail("person@example.com")).toBe(false);
        expect(await mayReceiveMail("person@example.com")).toBe(true);
    });
});
