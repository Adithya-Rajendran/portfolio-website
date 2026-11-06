// Registered Web Linking relations; append to preserve framework preload links.
export const discoveryLinkHeader = [
    '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
    '</openapi.json>; rel="service-desc"; type="application/json"',
    '</llms.txt>; rel="service-doc"; type="text/plain"',
    '</llms.txt>; rel="describedby"; type="text/plain"',
].join(", ");

// Only public, read-only resources belong in the catalog and service description.
export const publicReadingResources = [
    {
        path: "/llms.txt",
        title: "Published content index",
        description:
            "Plain-text reading guide with links to published writing, projects and public pages. Follow robots.txt; contact is for humans only.",
        mediaType: "text/plain",
        operationId: "getReadingGuide",
    },
    {
        path: "/feed.xml",
        title: "Recent writing (RSS)",
        description:
            "RSS feed containing the full content of recent published posts.",
        mediaType: "application/xml",
        operationId: "getWritingFeed",
    },
    {
        path: "/sitemap.xml",
        title: "Public sitemap",
        description:
            "XML sitemap of public pages, published writing and projects.",
        mediaType: "application/xml",
        operationId: "getPublicSitemap",
    },
] as const;
