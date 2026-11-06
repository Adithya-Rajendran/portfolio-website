import { describe, expect, it } from "vitest";
import type { APIContext } from "astro";
import {
    GET as getCatalog,
    HEAD as headCatalog,
} from "../../src/pages/.well-known/api-catalog";
import {
    GET as getDescription,
    HEAD as headDescription,
} from "../../src/pages/openapi.json";

const context = {} as APIContext;

describe("read-only service discovery", () => {
    it("publishes a profiled JSON Linkset with canonical API items and related documentation", async () => {
        const response = await getCatalog(context);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(
            'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
        );
        const { linkset } = await response.json();
        const [catalog, ...services] = linkset;
        expect(catalog.anchor).toBe(
            "https://adithya-rajendran.com/.well-known/api-catalog",
        );
        expect(catalog.item).toHaveLength(3);
        expect(services).toHaveLength(catalog.item.length);
        for (const item of catalog.item) {
            const url = new URL(item.href);
            expect(url.origin).toBe("https://adithya-rajendran.com");
            expect(["/llms.txt", "/feed.xml", "/sitemap.xml"]).toContain(
                url.pathname,
            );
            expect(item.type).toMatch(/^(?:text\/plain|application\/xml)$/);
            expect(item.title).toBeTruthy();
            expect(services).toContainEqual({
                anchor: item.href,
                "service-desc": [
                    {
                        href: "https://adithya-rajendran.com/openapi.json",
                        type: "application/json",
                    },
                ],
                "service-doc": [
                    {
                        href: "https://adithya-rajendran.com/llms.txt",
                        type: "text/plain",
                    },
                ],
            });
        }
    });

    it("describes only existing public GET resources, with no automated contact operation", async () => {
        const response = await getDescription(context);
        expect(response.status).toBe(200);
        const description = await response.json();
        expect(description.openapi).toBe("3.1.0");
        expect(description.servers).toEqual([
            { url: "https://adithya-rajendran.com" },
        ]);
        expect(description.info.description).toContain(
            "Contact is for humans only",
        );
        expect(Object.keys(description.paths).sort()).toEqual([
            "/feed.xml",
            "/llms.txt",
            "/sitemap.xml",
        ]);
        const operationIds = new Set();
        for (const path of Object.keys(description.paths)) {
            const methods = description.paths[path];
            expect(Object.keys(methods)).toEqual(["get"]);
            expect(methods.get.operationId).toBeTruthy();
            operationIds.add(methods.get.operationId);
            expect(methods.get.responses["200"].content).toEqual({
                [path.endsWith(".xml") ? "application/xml" : "text/plain"]: {
                    schema: { type: "string" },
                },
            });
        }
        expect(operationIds.size).toBe(3);
        expect(description.security).toEqual([]);
    });

    it.each([
        ["catalog", getCatalog, headCatalog],
        ["service description", getDescription, headDescription],
    ])(
        "returns matching GET/HEAD metadata for the %s without a HEAD body",
        async (_, get, head) => {
            const response = await get(context);
            const metadata = await head(context);
            expect(metadata.status).toBe(response.status);
            expect(Object.fromEntries(metadata.headers)).toEqual(
                Object.fromEntries(response.headers),
            );
            expect(metadata.headers.get("cache-control")).toBe("no-store");
            expect(await metadata.text()).toBe("");
        },
    );
});
