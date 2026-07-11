export const RESUME_FILENAME = "Adithya_Rajendran_Resume.pdf";

export type ResumeAssetMode = "view" | "download";

/**
 * Sanity file references come from CMS data, so keep the public resume routes
 * from becoming open redirects. The view URL deliberately removes `dl` so
 * mobile browsers can use their native PDF viewer; the download URL restores
 * a stable, human-readable filename.
 */
export function resolveResumeAssetUrl(
    value: string | null | undefined,
    mode: ResumeAssetMode,
): string | null {
    if (!value) return null;

    try {
        const target = new URL(value);
        const isSanityPdf =
            target.protocol === "https:" &&
            target.hostname === "cdn.sanity.io" &&
            target.pathname.startsWith("/files/") &&
            target.pathname.toLowerCase().endsWith(".pdf");

        if (!isSanityPdf) return null;

        target.hash = "";
        if (mode === "download") {
            target.searchParams.set("dl", RESUME_FILENAME);
        } else {
            target.searchParams.delete("dl");
        }

        return target.toString();
    } catch {
        return null;
    }
}
