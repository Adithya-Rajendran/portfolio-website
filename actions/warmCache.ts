"use server";

import { getAllSlugs } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";

export async function warmBlogCache(): Promise<{
    warmed: string[];
    failed: string[];
}> {
    const slugs = await getAllSlugs();
    if (!slugs || slugs.length === 0) {
        return { warmed: [], failed: [] };
    }

    const warmed: string[] = [];
    const failed: string[] = [];

    const batchSize = 5;
    for (let i = 0; i < slugs.length; i += batchSize) {
        const batch = slugs.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(async (slug) => {
                const url = `${siteConfig.url}/blogs/${slug}`;
                const res = await fetch(url, {
                    headers: { "x-cache-warm": "1" },
                });
                if (!res.ok) throw new Error(`${res.status}`);
                return slug;
            }),
        );

        for (const result of results) {
            if (result.status === "fulfilled") {
                warmed.push(result.value);
            } else {
                failed.push(batch[results.indexOf(result)]);
            }
        }
    }

    return { warmed, failed };
}
