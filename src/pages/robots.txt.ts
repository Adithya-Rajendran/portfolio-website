import type { APIRoute } from "astro";
export const GET: APIRoute = () =>
    new Response(
        [
            "# Public reading guide: https://adithya-rajendran.com/llms.txt",
            "# Contact is for humans; automated submissions are not permitted.",
            "User-agent: *",
            "Allow: /",
            "Disallow: /contact",
            "Disallow: /comms",
            "Disallow: /api/",
            "Disallow: /studio",
            "Sitemap: https://adithya-rajendran.com/sitemap.xml",
            "",
        ].join("\n"),
        { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
