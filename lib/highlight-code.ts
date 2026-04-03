import { createHighlighter, type Highlighter } from "shiki";
import { cacheLife, cacheTag } from "next/cache";

export interface HighlightedBlock {
    key: string;
    html: string;
    language: string;
}

/**
 * Singleton shiki highlighter — initialises the WASM engine + grammars once
 * and reuses the instance across all subsequent requests.  This avoids a
 * ~500ms–2s cold-start penalty on every blog page render.
 */
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: ["github-dark-dimmed"],
            langs: [
                "javascript",
                "typescript",
                "bash",
                "python",
                "yaml",
                "docker",
                "json",
                "html",
                "css",
                "text",
                "go",
                "rust",
                "hcl",
                "toml",
                "ini",
                "sql",
                "markdown",
                "tsx",
                "jsx",
                "c",
                "cpp",
            ],
        });
    }
    return highlighterPromise;
}

/**
 * Pre-highlights all code blocks from a Sanity Portable Text body
 * using the singleton shiki highlighter.
 *
 * Cached via Next.js "use cache" — the highlighted HTML is stored in
 * Vercel's edge cache and revalidated via the "post" tag when content
 * changes in Sanity.  Returns a plain Record (not Map) so the result
 * is serialisable by the cache layer.
 */
export async function highlightCodeBlocks(
    body: any[]
): Promise<Record<string, string>> {
    "use cache";
    cacheLife("max");
    cacheTag("post");

    const codeBlocks = body.filter((block) => block._type === "code");
    const highlighted: Record<string, string> = {};

    const highlighter = await getHighlighter();

    await Promise.all(
        codeBlocks.map(async (block) => {
            const code = block.code || "";
            const lang = mapLanguage(block.language || "text");
            const key = block._key;

            try {
                const html = highlighter.codeToHtml(code, {
                    lang,
                    theme: "github-dark-dimmed",
                });
                highlighted[key] = html;
            } catch {
                // Fallback: if language isn't supported, render as plain text
                try {
                    const html = highlighter.codeToHtml(code, {
                        lang: "text",
                        theme: "github-dark-dimmed",
                    });
                    highlighted[key] = html;
                } catch {
                    // Final fallback: raw code
                    highlighted[key] =
                        `<pre><code>${escapeHtml(code)}</code></pre>`;
                }
            }
        })
    );

    return highlighted;
}

/** Map common Sanity language identifiers to shiki-compatible ones */
function mapLanguage(lang: string): string {
    const map: Record<string, string> = {
        sh: "bash",
        shell: "bash",
        zsh: "bash",
        js: "javascript",
        ts: "typescript",
        py: "python",
        yml: "yaml",
        dockerfile: "docker",
        text: "text",
        plaintext: "text",
        txt: "text",
    };
    return map[lang.toLowerCase()] || lang.toLowerCase();
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
