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
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()",
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
                hostname: "i.imgur.com",
            },
            {
                protocol: "https",
                hostname: "labs.hackthebox.com",
            },
            {
                protocol: "https",
                hostname: "cdn.sanity.io",
            },
        ],
    },
};

export default nextConfig;
