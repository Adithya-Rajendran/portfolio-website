import { defineMiddleware } from "astro:middleware";
const redirects: Record<string, [string, number]> = {
    "/blogs": ["/blog", 308],
    "/resume.pdf": ["/resume/view", 308],
    "/resume/trajectory": ["/resume", 308],
    "/blog/archive": ["/blog", 308],
    "/comms": ["/contact", 308],
    "/rss.xml": ["/feed.xml", 301],
    "/rss": ["/feed.xml", 301],
    "/feed": ["/feed.xml", 301],
    "/atom.xml": ["/feed.xml", 301],
    "/apple-touch-icon.png": ["/apple-icon.png", 308],
    "/apple-touch-icon-precomposed.png": ["/apple-icon.png", 308],
};
export const onRequest = defineMiddleware(async ({ url }, next) => {
    if (url.hostname === "www.adithya-rajendran.com") {
        const target = new URL(url);
        target.hostname = "adithya-rajendran.com";
        target.protocol = "https:";
        return Response.redirect(target.toString(), 308);
    }
    if (
        /^\/(?:opengraph-image(?:-[a-z0-9]+)?|(?:about|blog|portfolio|resume|contact)\/opengraph-image(?:-[a-z0-9]+)?|(?:blog|portfolio)\/[^/]+\/opengraph-image(?:-[a-z0-9]+)?)$/.test(
            url.pathname,
        )
    )
        return Response.redirect(new URL("/share.png", url), 308);
    const target =
        redirects[url.pathname] ||
        (url.pathname.startsWith("/blogs/")
            ? ([url.pathname.replace(/^\/blogs\//, "/blog/"), 308] as [
                  string,
                  number,
              ])
            : undefined);
    if (target)
        return new Response(null, {
            status: target[1],
            headers: { Location: target[0] },
        });
    const response = await next();
    if (url.hostname !== "adithya-rajendran.com")
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
    if (url.hostname === "adithya-rajendran.com")
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload",
        );
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set(
        "Content-Security-Policy",
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://core.sanity-cdn.com https://static.cloudflareinsights.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://cdn.sanity.io",
            "font-src 'self' data: https://design-system-static.sanity.io",
            `connect-src 'self'${url.pathname === "/" || /^\/resume\/?$/.test(url.pathname) ? " blob:" : ""} https://*.api.sanity.io https://*.sanity.io https://cdn.sanity.io https://challenges.cloudflare.com wss://*.api.sanity.io`,
            "frame-src 'self' https://challenges.cloudflare.com https://www.youtube-nocookie.com https://player.vimeo.com https://cdn.sanity.io https://*.sanity.io",
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
        ].join("; "),
    );
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    return response;
});
