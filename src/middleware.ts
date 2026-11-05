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
export const onRequest = defineMiddleware(async ({ url, locals }, next) => {
    const nonce = btoa(
        String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
    );
    locals.cspNonce = nonce;
    let response: Response;
    const studio =
        url.pathname === "/studio" || url.pathname.startsWith("/studio/");
    const contact =
        url.pathname === "/contact" ||
        url.pathname === "/contact/" ||
        url.pathname === "/api/contact" ||
        url.pathname === "/api/contact/";

    if (url.hostname === "www.adithya-rajendran.com") {
        const target = new URL(url);
        target.hostname = "adithya-rajendran.com";
        target.protocol = "https:";
        response = Response.redirect(target.toString(), 308);
    } else if (
        /^\/(?:opengraph-image(?:-[a-z0-9]+)?|(?:about|blog|portfolio|resume|contact)\/opengraph-image(?:-[a-z0-9]+)?|(?:blog|portfolio)\/[^/]+\/opengraph-image(?:-[a-z0-9]+)?)$/.test(
            url.pathname,
        )
    ) {
        response = Response.redirect(new URL("/share.png", url), 308);
    } else {
        const target =
            redirects[url.pathname] ||
            (url.pathname.startsWith("/blogs/")
                ? ([url.pathname.replace(/^\/blogs\//, "/blog/"), 308] as [
                      string,
                      number,
                  ])
                : undefined);
        response = target
            ? new Response(null, {
                  status: target[1],
                  headers: { Location: target[0] },
              })
            : await next();
    }
    // Redirect responses and some adapter responses have immutable headers.
    response = new Response(response.body, response);
    if (url.hostname !== "adithya-rajendran.com")
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
    if (
        ["adithya-rajendran.com", "www.adithya-rajendran.com"].includes(
            url.hostname,
        )
    )
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload",
        );
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    const script = studio
        ? "'self' 'unsafe-inline' https://core.sanity-cdn.com https://static.cloudflareinsights.com"
        : `'self' ${import.meta.env.DEV && !import.meta.env.TEST ? "'unsafe-inline'" : `'nonce-${nonce}'`} https://challenges.cloudflare.com https://static.cloudflareinsights.com`;
    const connect = studio
        ? "'self' https://*.api.sanity.io https://*.sanity.io https://cdn.sanity.io https://cloudflareinsights.com wss://*.api.sanity.io"
        : `'self'${url.pathname === "/" || /^\/resume\/?$/.test(url.pathname) ? " blob:" : ""} https://cdn.sanity.io https://cloudflareinsights.com${contact ? " https://challenges.cloudflare.com" : ""}`;
    const frames = studio
        ? "'self' https://cdn.sanity.io https://*.sanity.io"
        : `'self' https://www.youtube-nocookie.com https://player.vimeo.com https://cdn.sanity.io${contact ? " https://challenges.cloudflare.com" : ""}`;
    response.headers.set(
        "Content-Security-Policy",
        [
            "default-src 'self'",
            `script-src ${script}`,
            "style-src 'self' 'unsafe-inline'",
            `img-src 'self' data: blob: https://cdn.sanity.io${studio ? " https://*.sanity.io" : ""}`,
            `font-src 'self' data:${studio ? " https://design-system-static.sanity.io" : ""}`,
            `connect-src ${connect}`,
            `frame-src ${frames}`,
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
        ].join("; "),
    );
    if (
        response.headers
            .get("Content-Type")
            ?.toLowerCase()
            .startsWith("text/html")
    )
        response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    return response;
});
