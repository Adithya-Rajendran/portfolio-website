import { withBotId } from "botid/next/config";

const isDevelopment = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
    cacheComponents: true,
    reactCompiler: true,
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
                        value: [
                            "default-src 'self'",
                            `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
                            "script-src-attr 'none'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: blob: https://cdn.sanity.io",
                            "font-src 'self' data:",
                            "connect-src 'self' https://cdn.sanity.io https://*.api.sanity.io https://vitals.vercel-insights.com https://va.vercel-scripts.com",
                            "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
                            "frame-ancestors 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "object-src 'none'",
                            "upgrade-insecure-requests",
                        ].join("; "),
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
            // Cache static assets aggressively
            {
                source: "/(.*)\\.(ico|png|jpg|jpeg|gif|webp|svg|woff|woff2)",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable",
                    },
                ],
            },
        ];
    },
    async redirects() {
        return [
            {
                source: "/resume.pdf",
                destination: "/resume",
                permanent: true,
            },
        ];
    },
    images: {
        qualities: [75],
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
