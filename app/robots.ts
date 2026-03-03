import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/admin/", "/api/", "/studio/"],
        },
        sitemap: "https://adithya-rajendran.com/sitemap.xml",
    };
}
