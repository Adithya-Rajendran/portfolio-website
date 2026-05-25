import { ImageResponse } from "next/og";
import { getPostMeta } from "@/lib/sanity-client";

export const alt = "Adithya Rajendran — Blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "80px",
                background:
                    "radial-gradient(circle at 20% 0%, #10b981 0%, transparent 45%), radial-gradient(circle at 100% 100%, #22d3ee 0%, transparent 40%), #050608",
                color: "#ffffff",
                fontFamily: "sans-serif",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "18px",
                }}
            >
                <div
                    style={{
                        width: "44px",
                        height: "2px",
                        background: "linear-gradient(90deg, #10b981, #22d3ee)",
                    }}
                />
                <span
                    style={{
                        fontSize: "22px",
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#34d399",
                        fontWeight: 600,
                    }}
                >
                    Adithya Rajendran · Blog
                </span>
            </div>

            <div
                style={{
                    fontSize: title.length > 70 ? "62px" : "78px",
                    fontWeight: 700,
                    lineHeight: 1.08,
                    letterSpacing: "-0.02em",
                    color: "#ffffff",
                    display: "flex",
                    marginRight: "40px",
                }}
            >
                {title}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "26px",
                    color: "#94a3b8",
                }}
            >
                <span style={{ display: "flex" }}>{date}</span>
                <span style={{ display: "flex" }}>adithya-rajendran.com</span>
            </div>
        </div>,
        { ...size },
    );
}
