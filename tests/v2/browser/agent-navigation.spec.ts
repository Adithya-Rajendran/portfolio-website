import { test, expect } from "@playwright/test";

test("an HTTP-only reader can follow homepage Link headers to read-only services", async ({
    request,
}) => {
    const homepage = await request.get("/", {
        headers: { "User-Agent": "PortfolioReader/1.0" },
    });
    expect(homepage.status()).toBe(200);
    const header = homepage.headers().link;
    expect(header).toBeTruthy();
    const head = await request.head("/");
    expect(head.status()).toBe(200);
    expect(head.headers().link).toBe(header);
    expect(await head.body()).toHaveLength(0);
    const links = new Map(
        Array.from(
            header.matchAll(/<([^>]+)>;\s*rel="([^"]+)";\s*type="([^"]+)"/g),
            ([, href, relation, type]) => [relation, { href, type }],
        ),
    );
    for (const relation of [
        "api-catalog",
        "service-desc",
        "service-doc",
        "describedby",
    ]) {
        const link = links.get(relation);
        expect(link, relation).toBeDefined();
        const url = new URL(link!.href, "https://adithya-rajendran.com");
        expect(url.origin).toBe("https://adithya-rajendran.com");
        expect(url.pathname).not.toMatch(/^\/(contact|comms|api|studio)(\/|$)/);
        const resource = await request.get(url.pathname);
        expect(resource.status(), relation).toBe(200);
        expect(resource.headers()["content-type"]).toContain(link!.type);
    }
    const catalogPath = links.get("api-catalog")!.href;
    const catalogResponse = await request.get(catalogPath);
    expect(catalogResponse.headers()["content-type"]).toContain(
        'profile="https://www.rfc-editor.org/info/rfc9727"',
    );
    const catalogHead = await request.head(catalogPath);
    expect(catalogHead.status()).toBe(200);
    expect(catalogHead.headers().link).toContain(
        `<${catalogPath}>; rel="api-catalog"`,
    );
    expect(catalogHead.headers()["content-type"]).toBe(
        catalogResponse.headers()["content-type"],
    );
    expect(await catalogHead.body()).toHaveLength(0);
    const { linkset } = await catalogResponse.json();
    const descriptionResponse = await request.get(
        links.get("service-desc")!.href,
    );
    const description = await descriptionResponse.json();
    expect(description.openapi).toBe("3.1.0");
    expect(description.servers).toEqual([
        { url: "https://adithya-rajendran.com" },
    ]);
    const items = linkset[0].item as { href: string; type: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(Object.keys(description.paths)).toHaveLength(items.length);
    for (const item of items) {
        const url = new URL(item.href);
        expect(url.origin).toBe("https://adithya-rajendran.com");
        expect(url.pathname).not.toMatch(/^\/(contact|comms|api|studio)(\/|$)/);
        const operations = description.paths[url.pathname];
        expect(Object.keys(operations)).toEqual(["get"]);
        const response = await request.get(url.pathname);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain(item.type);
        expect(operations.get.responses["200"].content[item.type]).toEqual({
            schema: { type: "string" },
        });
        expect(await response.text()).not.toBe("");
    }
});

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
