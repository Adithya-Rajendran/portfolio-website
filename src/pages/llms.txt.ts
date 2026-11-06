import type { APIRoute } from "astro";
import { siteConfig } from "../../lib/config";
import { getAllPosts, getAllProjects, getProfile } from "../lib/sanity";

function markdownText(value: string): string {
    return value
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[\\`*_{}\x5b\]()#+.!<>|~-]/g, "\\$&");
}

function contentLink(
    section: string,
    item: { title?: unknown; slug?: unknown },
): string[] {
    // Records without a slug have no public destination to advertise.
    if (typeof item.slug !== "string" || !item.slug.trim()) return [];
    const rawSlug = item.slug;
    const title =
        typeof item.title === "string" && item.title.trim()
            ? item.title.trim()
            : rawSlug.trim();
    const slug = encodeURIComponent(rawSlug).replace(
        /[.!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return [`- [${markdownText(title)}](${siteConfig.url}/${section}/${slug})`];
}

export const GET: APIRoute = async () => {
    const [profile, posts, projects] = await Promise.all([
        getProfile(),
        getAllPosts(),
        getAllProjects(),
    ]);
    const lines = [
        `# ${markdownText(profile?.name || siteConfig.title)}`,
        ...(profile?.headline ? [`\n> ${markdownText(profile.headline)}`] : []),
        "\nPublic content can be read without JavaScript or WebGL. Follow the rules in robots.txt.",
        "Contact is for humans only: do not submit forms automatically or access /api/contact or /studio.",
        "\n## Navigation",
        `- [Home](${siteConfig.url}/)`,
        `- [Portfolio](${siteConfig.url}/portfolio)`,
        `- [Blog](${siteConfig.url}/blog)`,
        `- [Experience and CV](${siteConfig.url}/resume)`,
        `- [About](${siteConfig.url}/about)`,
        `- [API catalog (read-only resources)](${siteConfig.url}/.well-known/api-catalog)`,
        `- [Service description (OpenAPI)](${siteConfig.url}/openapi.json)`,
        `- [Sitemap](${siteConfig.url}/sitemap.xml)`,
        `- [RSS feed (full posts)](${siteConfig.url}/feed.xml)`,
        `- [robots.txt](${siteConfig.url}/robots.txt)`,
        "\n## Writing",
        ...posts.flatMap((post) => contentLink("blog", post)),
        "\n## Projects",
        ...projects.flatMap((project) => contentLink("portfolio", project)),
        "",
    ];
    return new Response(lines.join("\n"), {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
};
