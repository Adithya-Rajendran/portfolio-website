import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #10b981, #22d3ee)",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 110,
                fontFamily: "sans-serif",
                letterSpacing: "-0.04em",
            }}
        >
            A
        </div>,
        size,
    );
}
