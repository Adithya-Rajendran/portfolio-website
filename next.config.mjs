/** @type {import('next').NextConfig} */
const nextConfig = {
    cacheComponents: true,
    reactCompiler: true,
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
                        // 'unsafe-inline' is required for Next's inline runtime
                        // chunks and the JSON-LD <script> tags in json-ld.tsx.
                        // Vercel Analytics / Speed Insights load from
                        // va.vercel-scripts.com and report to
                        // vitals.vercel-insights.com.
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "img-src 'self' data: blob: https://cdn.sanity.io",
                            "font-src 'self' https://fonts.gstatic.com data:",
                            "connect-src 'self' https://cdn.sanity.io https://*.api.sanity.io https://vitals.vercel-insights.com https://va.vercel-scripts.com",
                            "frame-src 'self'",
                            "frame-ancestors 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "object-src 'none'",
                            "upgrade-insecure-requests",
                        ].join("; "),
                    },
                    // Performance: DNS prefetch and preconnect for external resources
                    {
                        key: "Link",
                        value: "<https://cdn.sanity.io>; rel=preconnect, <https://cdn.sanity.io>; rel=dns-prefetch, <https://fonts.gstatic.com>; rel=preconnect; crossorigin",
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
        qualities: [75, 95],
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

export default nextConfig;
