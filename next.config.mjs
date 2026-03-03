/** @type {import('next').NextConfig} */
const nextConfig = {
    reactCompiler: true,
    cacheComponents: true,
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                ],
            },
            {
                source: "/resume.pdf",
                headers: [
                    {
                        key: "Content-Disposition",
                        value: 'attachment; filename="resume.pdf"',
                    },
                ],
            },
        ];
    },
    images: {
        qualities: [75, 95],
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
