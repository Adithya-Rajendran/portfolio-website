/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "blog.logrocket.com",
            },
        ],
    },
};

module.exports = nextConfig;
