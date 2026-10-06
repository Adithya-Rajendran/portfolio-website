import {
    createCssVariablesTheme,
    createHighlighter,
    type Highlighter,
    type ShikiTransformer,
} from "shiki";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

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

/**
 * One theme for both site themes: every token colour is a CSS variable
 * (`var(--code-token-comment)` …) that styles/prose.css maps to the design
 * tokens per theme, so listings are monochrome (keywords by weight, not
 * colour) and follow Void, Flight Manual and print without a second pass. The
 * comment colour is ink-3, at least 5.2:1 on the listing in both themes
 * (the GitHub theme's own comment colour was 3.87:1 in Void).
 */
const CODE_THEME = createCssVariablesTheme({
    name: "deep-field",
    variablePrefix: "--code-",
    fontStyle: true,
});

function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: [CODE_THEME],
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
 * Cached via Next.js "use cache" under its content type's tag
 * (`contentTag`: CACHE_TAGS.post, or CACHE_TAGS.project for a project's
 * essay), which the webhook revalidates (and the cron, for `post`), and
 * keyed by the code blocks, the slug and HIGHLIGHT_MARKUP_VERSION, so an
 * edited block never serves its old HTML. Returns a plain Record (not
 * Map) so the result is serialisable by the cache layer.
 *
 * Takes only the code blocks (not the whole body) so the serialized
 * cache key stays proportional to the code, not the prose.
 */
export type CodeBlock = {
    _key: string;
    _type: "code";
    code?: string;
    language?: string;
    highlightedLines?: number[];
};

/**
 * Bump when the emitted markup contract changes (themes, classes, CSS
 * expectations). The version participates in the cache key, so entries
 * rendered by an older pipeline are orphaned instead of being served
 * into styles they were never written for — the data cache persists
 * across deployments, so a code change alone does not invalidate them.
 * v2: dual-theme CSS variables (defaultColor: false) + line-highlight.
 * v3: the one css-variables theme (`--code-*`, styles/prose.css), no
 *     tabindex on the <pre> (the listing's scroll box is the focusable,
 *     labelled region) and `line-highlight` restyled.
 */
const HIGHLIGHT_MARKUP_VERSION = 3;

export async function highlightCodeBlocks(
    codeBlocks: CodeBlock[],
    slug: string,
    contentTag: string = CACHE_TAGS.post,
): Promise<Record<string, string>> {
    if (codeBlocks.length === 0) return {};

    return highlightCodeBlocksVersioned(
        codeBlocks,
        slug,
        contentTag,
        HIGHLIGHT_MARKUP_VERSION,
    );
}

async function highlightCodeBlocksVersioned(
    codeBlocks: CodeBlock[],
    slug: string,
    contentTag: string,
    _markupVersion: number,
): Promise<Record<string, string>> {
    "use cache";
    cacheLife("max");
    cacheTag(contentTag);

    const highlighted: Record<string, string> = {};

    const highlighter = await getHighlighter();

    await Promise.all(
        codeBlocks.map(async (block) => {
            const code = block.code || "";
            const lang = mapLanguage(block.language || "text");
            const key = block._key;

            // Editors store 1-based line numbers; the schema field was
            // previously ignored by this renderer.
            const highlightedLines = new Set(block.highlightedLines ?? []);
            const transformers: ShikiTransformer[] =
                highlightedLines.size > 0
                    ? [
                          {
                              line(node, line) {
                                  if (!highlightedLines.has(line)) return;
                                  const existing = node.properties.class;
                                  node.properties.class = existing
                                      ? `${existing} line-highlight`
                                      : "line-highlight";
                              },
                          },
                      ]
                    : [];
            const options = {
                theme: CODE_THEME.name ?? "deep-field",
                // The listing's scroll box (components/prose/listing.tsx)
                // is the focusable, labelled region, not the <pre>.
                tabindex: false as const,
                transformers,
            };

            try {
                highlighted[key] = highlighter.codeToHtml(code, {
                    lang,
                    ...options,
                });
            } catch {
                // Fallback: if language isn't supported, render as plain text
                try {
                    highlighted[key] = highlighter.codeToHtml(code, {
                        lang: "text",
                        ...options,
                    });
                } catch {
                    // Final fallback: raw code
                    highlighted[key] =
                        `<pre><code>${escapeHtml(code)}</code></pre>`;
                }
            }
        }),
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
