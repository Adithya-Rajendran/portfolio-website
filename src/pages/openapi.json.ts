import type { APIRoute } from "astro";
import { siteConfig } from "../../lib/config";
import { publicReadingResources } from "../lib/discovery";

const description = JSON.stringify({
    openapi: "3.1.0",
    info: {
        title: `${siteConfig.title} — public reading resources`,
        version: "1.0.0",
        description:
            "Read-only discovery of published writing, projects and public pages. No authentication is required. Contact is for humans only and is not an automated service.",
    },
    servers: [{ url: siteConfig.url }],
    externalDocs: {
        description: "Reading guide and published content index",
        url: `${siteConfig.url}/llms.txt`,
    },
    security: [],
    paths: Object.fromEntries(
        publicReadingResources.map((resource) => [
            resource.path,
            {
                get: {
                    operationId: resource.operationId,
                    summary: resource.title,
                    description: resource.description,
                    responses: {
                        "200": {
                            description: resource.title,
                            content: {
                                [resource.mediaType]: {
                                    schema: { type: "string" },
                                },
                            },
                        },
                    },
                },
            },
        ]),
    ),
});
const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
};

export const GET: APIRoute = () => new Response(description, { headers });
export const HEAD: APIRoute = () => new Response(null, { headers });
