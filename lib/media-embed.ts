export type MediaEmbedTarget =
    | {
          kind: "video";
          provider: "youtube" | "vimeo";
          href: string;
          hostname: string;
          embedUrl: string;
      }
    | {
          kind: "link";
          href: string;
          hostname: string;
      };

/**
 * Turn an authored URL into either an allowlisted video embed or a plain link.
 * Invalid and non-HTTP(S) values return null; arbitrary providers never become
 * iframes.
 */
export function classifyMediaEmbed(value: unknown): MediaEmbedTarget | null {
    if (typeof value !== "string") return null;

    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    if (
        hostname === "youtu.be" ||
        hostname === "youtube.com" ||
        hostname === "youtube-nocookie.com"
    ) {
        const segments = url.pathname.split("/").filter(Boolean);
        const id =
            hostname === "youtu.be"
                ? segments[0]
                : url.searchParams.get("v") ||
                  (["embed", "shorts"].includes(segments[0])
                      ? segments[1]
                      : undefined);

        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
            return {
                kind: "video",
                provider: "youtube",
                href: url.href,
                hostname: url.hostname,
                embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
            };
        }
    }

    if (hostname === "vimeo.com" || hostname === "player.vimeo.com") {
        const id = url.pathname
            .split("/")
            .filter(Boolean)
            .findLast((segment) => /^\d+$/.test(segment));

        if (id) {
            return {
                kind: "video",
                provider: "vimeo",
                href: url.href,
                hostname: url.hostname,
                embedUrl: `https://player.vimeo.com/video/${id}`,
            };
        }
    }

    return {
        kind: "link",
        href: url.href,
        hostname: url.hostname,
    };
}
