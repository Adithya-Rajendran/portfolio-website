import type { APIRoute } from "astro";
import { siteConfig } from "../../../lib/config";
import {
    discoveryLinkHeader,
    publicReadingResources,
} from "../../lib/discovery";

const headers = {
    "Content-Type":
        'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
    "Cache-Control": "no-store",
    Link: discoveryLinkHeader,
};

// RFC 9727 uses the RFC 9264 JSON Linkset format, with absolute link contexts.
const catalog = JSON.stringify({
    linkset: [
        {
            anchor: `${siteConfig.url}/.well-known/api-catalog`,
            item: publicReadingResources.map(({ path, title, mediaType }) => ({
                href: `${siteConfig.url}${path}`,
                type: mediaType,
                title,
            })),
        },
        ...publicReadingResources.map(({ path }) => ({
            anchor: `${siteConfig.url}${path}`,
            "service-desc": [
                {
                    href: `${siteConfig.url}/openapi.json`,
                    type: "application/json",
                },
            ],
            "service-doc": [
                { href: `${siteConfig.url}/llms.txt`, type: "text/plain" },
            ],
        })),
    ],
});

export const GET: APIRoute = () => new Response(catalog, { headers });
export const HEAD: APIRoute = () => new Response(null, { headers });
