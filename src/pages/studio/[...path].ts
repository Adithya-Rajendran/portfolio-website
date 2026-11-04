import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
export const GET: APIRoute = async ({ request }) => {
    const assets = (env as unknown as { ASSETS: Fetcher }).ASSETS;
    const target = new URL("/studio/", request.url);
    const response = await assets.fetch(new Request(target, request));
    return new Response(response.body, {
        status: response.status,
        headers: response.headers,
    });
};
