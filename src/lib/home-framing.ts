export type HomeFraming = "desktop" | "tablet" | "mobile";

// These are the native canvas dimensions used to capture each loading image.
// Keep the perspective camera and the picture's object-fit: cover crop aligned.
export const HOME_FRAMES = {
    desktop: { width: 1440, height: 730, anchorX: 0.72 },
    tablet: { width: 768, height: 420, anchorX: 0.5 },
    mobile: { width: 390, height: 300, anchorX: 0.5 },
} as const;

export function homeCoverFrame(
    width: number,
    height: number,
    framing: HomeFraming,
) {
    const reference = HOME_FRAMES[framing];
    const scale = Math.max(width / reference.width, height / reference.height);
    const fullWidth = reference.width * scale;
    const fullHeight = reference.height * scale;
    return {
        fullWidth,
        fullHeight,
        x: (fullWidth - width) * reference.anchorX,
        y: (fullHeight - height) * 0.5,
        width,
        height,
    };
}
