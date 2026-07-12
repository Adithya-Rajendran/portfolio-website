import { ImageResponse } from "next/og";
import { getPostMeta } from "@/lib/sanity-client";
import { formatDate } from "@/components/blogs/utils";
import { siteConfig } from "@/lib/config";
import { OgTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";

export const alt = "Adithya Rajendran — Blog";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPostMeta(slug);

    const title = post?.title ?? "Blog Post";

    return new ImageResponse(
        <OgTemplate
            eyebrow={`${siteConfig.author} · Blog`}
            title={title}
            footerLeft={formatDate(post?.publishedAt)}
            footerRight={domain}
        />,
        { ...size },
    );
}
