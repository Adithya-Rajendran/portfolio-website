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
                background: "#0c1318",
            }}
        >
            <svg width="150" height="150" viewBox="0 0 64 64">
                <path
                    d="M15 48 29 15h6l14 33h-7l-3-8H25l-3 8Zm12-14h10l-5-13Z"
                    fill="#e9e9e2"
                />
                <circle cx="49" cy="15" r="3" fill="#f6af80" />
            </svg>
        </div>,
        size,
    );
}
