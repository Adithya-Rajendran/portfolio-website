import { test, expect } from "@playwright/test";

test("an HTTP-only reader can discover and follow published content", async ({
    request,
}) => {
    const guide = await request.get("/llms.txt");
    expect(guide.status()).toBe(200);
    expect(guide.headers()["content-type"]).toContain("text/plain");
    expect(guide.headers()["cache-control"]).toBe("no-store");
    const body = await guide.text();
    expect(body).toContain("fixture-post-code-and-links");
    expect(body).toContain("Contact is for humans only");
    const links = Array.from(
        body.matchAll(/\]\((https:\/\/[^\s)]+)\)/g),
        ([, href]) => new URL(href),
    );
    expect(links.length).toBeGreaterThan(8);
    expect(
        links.some(({ pathname }) => pathname.startsWith("/portfolio/")),
    ).toBe(true);
    expect(links.some(({ pathname }) => pathname.startsWith("/blog/"))).toBe(
        true,
    );
    for (const url of links) {
        expect(url.origin).toBe("https://adithya-rajendran.com");
        expect(url.pathname).not.toMatch(/^\/(contact|comms|api|studio)(\/|$)/);
        const response = await request.get(url.pathname, {
            headers: { "User-Agent": "PortfolioReader/1.0" },
        });
        expect(response.status(), url.pathname).toBe(200);
        if (response.headers()["content-type"]?.startsWith("text/html")) {
            const html = await response.text();
            expect(html).toContain('<main id="main"');
            expect(html).toContain('href="/llms.txt"');
            expect(html).toMatch(/<h1[\s>]/);
        }
    }
    const robots = await (await request.get("/robots.txt")).text();
    for (const path of ["/contact", "/comms", "/api/", "/studio"])
        expect(robots).toContain(`Disallow: ${path}\n`);
    expect(robots).toContain("/llms.txt");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/contact</loc>");
});

test("a reader user agent cannot submit contact without human verification", async ({
    request,
    baseURL,
}) => {
    const response = await request.post("/api/contact", {
        headers: {
            Origin: new URL(baseURL!).origin,
            "User-Agent": "PortfolioReader/1.0",
            "CF-Connecting-IP": "192.0.2.77",
        },
        form: {
            senderEmail: "reader@example.com",
            message:
                "Local fixture verification only; must never be delivered.",
        },
    });
    expect(response.status()).toBe(403);
    expect(await response.text()).toContain("Verification failed");
});
