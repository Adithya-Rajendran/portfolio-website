import { describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", () => ({
    defineMiddleware: (handler: unknown) => handler,
}));
import { onRequest } from "../../src/middleware";

async function policy(path: string): Promise<string> {
    const url = new URL(path, "https://adithya-rajendran.com");
    const response = await onRequest(
        { url } as Parameters<typeof onRequest>[0],
        async () => new Response("ok"),
    );
    return response.headers.get("content-security-policy") ?? "";
}
function directive(csp: string, name: string): string {
    return csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("experience asset security policy", () => {
    it.each(["/", "/resume", "/resume/"])(
        "allows embedded model blob fetches on %s",
        async (path) => {
            const csp = await policy(path);
            expect(directive(csp, "connect-src").split(" ")).toContain("blob:");
        },
    );
    it.each(["/about", "/blog/example", "/resume/view", "/resume-extra"])(
        "keeps blob connections disallowed on %s",
        async (path) => {
            const csp = await policy(path);
            expect(directive(csp, "connect-src").split(" ")).not.toContain(
                "blob:",
            );
        },
    );
});
