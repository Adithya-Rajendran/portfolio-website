import { withBotId } from "botid/next/config";

const isDevelopment = process.env.NODE_ENV !== "production";
// Vercel injects its feedback toolbar on previews. Keep its documented
// origins scoped to that environment; production retains the public policy.
const isPreview = process.env.VERCEL_ENV === "preview";

function contentSecurityPolicy(isStudio = false) {
    return [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com${isPreview ? " https://vercel.live" : ""}${isStudio ? " https://core.sanity-cdn.com" : ""}`,
        "script-src-attr 'none'",
        `style-src 'self' 'unsafe-inline'${isPreview ? " https://vercel.live" : ""}`,
        `img-src 'self' data: blob: https://cdn.sanity.io${isPreview ? " https://vercel.live https://vercel.com" : ""}`,
        `font-src 'self' data:${isPreview ? " https://vercel.live https://assets.vercel.com" : ""}${isStudio ? " https://design-system-static.sanity.io" : ""}`,
        `connect-src 'self' https://cdn.sanity.io https://*.api.sanity.io https://vitals.vercel-insights.com https://va.vercel-scripts.com${isPreview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
        `frame-src 'self' https://cdn.sanity.io/files/ https://www.youtube-nocookie.com https://player.vimeo.com${isPreview ? " https://vercel.live" : ""}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
    ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    cacheComponents: true,
    reactCompiler: true,
    // Partial Prefetching stays off app-wide (plan §4.6 rule 8, measured in
    // PR 9). It cut /blog's page prefetches from 9 to 5 at 412px, but made
    // the first request for an unknown post or tag slug answer 200 (a soft
    // 404; the next one was 404) on `next start`, and posts beyond the
    // first then loaded on the click. The two list-heavy routes, posts and
    // tags, opt in on their own (`export const prefetch = "partial"`),
    // which keeps the 404.
    partialPrefetching: false,
    experimental: {
        // app/global-not-found.tsx renders unmatched URLs as its own
        // document, so the site's stylesheet is not attached to every route
        // under the root layout (the Studio included), as a root
        // app/not-found.tsx would make it.
        globalNotFound: true,
    },
    poweredByHeader: false,
    allowedDevOrigins: ["127.0.0.1", "localhost"],
    env: {
        NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    {
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin",
                    },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=63072000; includeSubDomains; preload",
                    },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()",
                    },
                    {
                        // 'unsafe-inline' in script-src is structurally
                        // required: cacheComponents prerenders pages whose
                        // React flight inline <script> chunks change on every
                        // revalidation, so per-request nonces (which need
                        // dynamic rendering) and static hashes are both off
                        // the table. script-src-attr 'none' still blocks
                        // inline event-handler attributes — the common
                        // HTML-injection XSS vector. Fonts are self-hosted by
                        // next/font (no Google Fonts hosts, no preconnects).
                        // Vercel Analytics / Speed Insights load from
                        // va.vercel-scripts.com and report to
                        // vitals.vercel-insights.com.
                        key: "Content-Security-Policy",
                        value: contentSecurityPolicy(),
                    },
                    {
                        // Isolate the browsing-context group (tabnabbing /
                        // XS-Leak hardening) while keeping the Sanity Studio
                        // auth popup functional.
                        key: "Cross-Origin-Opener-Policy",
                        value: "same-origin-allow-popups",
                    },
                ],
            },
            // Sanity Studio loads its integration bridge and typefaces from
            // Sanity's own CDNs. Keep these origins off public page policies.
            {
                source: "/studio/:path*",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: contentSecurityPolicy(true),
                    },
                ],
            },
            // Cache static assets aggressively. This includes unhashed
            // /public files, so every new or re-encoded public asset needs a
            // versioned path (public/images/hero-sunrise-v1/…).
            {
                source: "/(.*)\\.(ico|png|jpg|jpeg|gif|webp|avif|svg|woff|woff2)",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable",
                    },
                ],
            },
            // /favicon.ico has a fixed, unversioned URL, so the immutable
            // rule above would pin a replaced favicon for a year. When two
            // rules set the same key, the later one wins.
            {
                source: "/favicon.ico",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=86400, must-revalidate",
                    },
                ],
            },
        ];
    },
    async redirects() {
        return [
            {
                source: "/blogs/:path*",
                destination: "/blog/:path*",
                permanent: true,
            },
            {
                source: "/resume.pdf",
                destination: "/resume/view",
                permanent: true,
            },
            // The flight is /resume's Timeline view (the default where
            // motion runs), no longer a page of its own.
            {
                source: "/resume/trajectory",
                destination: "/resume",
                permanent: true,
            },
            // Comms is the themed name of /contact (plan §2.2). Never
            // redirect from /contact itself.
            {
                source: "/comms",
                destination: "/contact",
                permanent: true,
            },
            // The feed's usual guesses. 301, not 308: feed readers are old
            // HTTP clients, and some only move a subscription on a 301.
            ...["/rss.xml", "/rss", "/feed", "/atom.xml"].map((source) => ({
                source,
                destination: "/feed.xml",
                statusCode: 301,
            })),
            // Share images moved into the app/(site) route group, which
            // gives each one a stable hash suffix (lib/route-tags.ts). Links
            // shared before the move keep their preview image. The archive
            // comes before the post pattern, which would also match it.
            ...[
                ["/opengraph-image", "/opengraph-image-12o0cb"],
                ["/about/opengraph-image", "/about/opengraph-image-1ycygp"],
                ["/blog/opengraph-image", "/blog/opengraph-image-14vkmf"],
                [
                    "/blog/archive/opengraph-image",
                    "/blog/archive/opengraph-image-dfhyke",
                ],
                [
                    "/blog/:slug/opengraph-image",
                    "/blog/:slug/opengraph-image-fx5gi7",
                ],
                [
                    "/portfolio/opengraph-image",
                    "/portfolio/opengraph-image-98lokn",
                ],
                ["/resume/opengraph-image", "/resume/opengraph-image-1nyaml"],
                // Newer than the move, kept at the unhashed URL like the
                // others so every share image answers there.
                ["/contact/opengraph-image", "/contact/opengraph-image-upzrkl"],
                [
                    "/portfolio/:slug/opengraph-image",
                    "/portfolio/:slug/opengraph-image-ysfoa1",
                ],
            ].map(([source, destination]) => ({
                source,
                destination,
                permanent: true,
            })),
        ];
    },
    images: {
        qualities: [75, 90],
        formats: ["image/avif", "image/webp"],
        minimumCacheTTL: 31536000,
        remotePatterns: [
            {
                protocol: "https",
                hostname: "cdn.sanity.io",
            },
        ],
    },
};

export default withBotId(nextConfig);
