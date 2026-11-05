import { describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", () => ({
    defineMiddleware: (handler: unknown) => handler,
}));
import { onRequest } from "../../src/middleware";

async function policy(path: string): Promise<string> {
    const url = new URL(path, "https://adithya-rajendran.com");
    const response = await onRequest(
        { url, locals: {} } as Parameters<typeof onRequest>[0],
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

describe("response security", () => {
    async function run(
        path: string,
        next = async () =>
            new Response("error", {
                status: 500,
                headers: { "Content-Type": "text/html" },
            }),
    ) {
        const locals: Record<string, string> = {};
        const url = new URL(path, "https://adithya-rajendran.com");
        const response = await onRequest(
            { url, locals } as Parameters<typeof onRequest>[0],
            next,
        );
        return { response, locals };
    }
    it("applies headers to redirects and errors without losing their status or location", async () => {
        const redirect = await run("/blogs");
        expect(redirect.response.status).toBe(308);
        expect(redirect.response.headers.get("location")).toBe("/blog");
        expect(
            redirect.response.headers.get("strict-transport-security"),
        ).toContain("max-age=");
        const www = await run("https://www.adithya-rajendran.com/about");
        expect(www.response.status).toBe(308);
        expect(www.response.headers.get("location")).toBe(
            "https://adithya-rajendran.com/about",
        );
        expect(www.response.headers.get("strict-transport-security")).toContain(
            "max-age=",
        );
        const error = await run("/missing");
        expect(error.response.status).toBe(500);
        expect(await error.response.text()).toBe("error");
        expect(error.response.headers.get("cache-control")).toBe("no-store");
        expect(error.response.headers.get("x-content-type-options")).toBe(
            "nosniff",
        );
        const other = await run("https://preview.example/blogs");
        expect(other.response.headers.get("x-robots-tag")).toBe(
            "noindex, nofollow",
        );
    });
    it("uses a fresh nonce per request and only authorizes that nonce in public policy", async () => {
        const first = await run("/about");
        const second = await run("/about");
        expect(first.locals.cspNonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(first.locals.cspNonce).not.toBe(second.locals.cspNonce);
        const scripts = directive(
            first.response.headers.get("content-security-policy")!,
            "script-src",
        );
        expect(scripts).toContain(`'nonce-${first.locals.cspNonce}'`);
        expect(scripts).not.toContain("'unsafe-inline'");
        expect(scripts).not.toContain("'unsafe-eval'");
        expect(scripts).not.toContain(`'nonce-${second.locals.cspNonce}'`);
    });
    it("limits public Sanity and Turnstile permissions by route while retaining Studio access", async () => {
        const publicPolicy = (await run("/about")).response.headers.get(
            "content-security-policy",
        )!;
        expect(directive(publicPolicy, "connect-src")).not.toContain(
            "*.sanity.io",
        );
        expect(directive(publicPolicy, "frame-src")).not.toContain(
            "challenges.cloudflare.com",
        );
        const contactPolicy = (await run("/contact")).response.headers.get(
            "content-security-policy",
        )!;
        expect(directive(contactPolicy, "connect-src")).toContain(
            "challenges.cloudflare.com",
        );
        expect(directive(contactPolicy, "frame-src")).toContain(
            "challenges.cloudflare.com",
        );
        const apiPolicy = (await run("/api/contact/")).response.headers.get(
            "content-security-policy",
        )!;
        expect(directive(apiPolicy, "connect-src")).toContain(
            "challenges.cloudflare.com",
        );
        const studioPolicy = (await run("/studio/desk")).response.headers.get(
            "content-security-policy",
        )!;
        expect(directive(studioPolicy, "connect-src")).toContain("*.sanity.io");
        expect(directive(studioPolicy, "script-src")).toContain(
            "'unsafe-inline'",
        );
    });
});
