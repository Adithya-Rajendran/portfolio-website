import { ImageResponse } from "next/og";
import { getPostMeta } from "@/lib/sanity-client";
import { OgTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";

export const alt = "Adithya Rajendran — Blog";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPostMeta(slug);

    const title = post?.title ?? "Blog Post";
    const date = post?.date
        ? new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : "";

    return new ImageResponse(
        <OgTemplate
            eyebrow="Adithya Rajendran · Blog"
            title={title}
            footerLeft={date}
            footerRight="adithya-rajendran.com"
        />,
        { ...size },
    );
}
