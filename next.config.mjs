import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
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
        ],
    },
};

export default withBundleAnalyzer(nextConfig);
