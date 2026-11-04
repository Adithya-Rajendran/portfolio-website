import { createHighlighterCore, createCssVariablesTheme } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/bundle/web";
import type { ContentBody } from "./sanity";
const theme = createCssVariablesTheme({
    name: "portfolio",
    variablePrefix: "--code-",
    fontStyle: true,
});
const aliases: Record<string, string> = {
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    js: "javascript",
    ts: "typescript",
    py: "python",
    yml: "yaml",
    dockerfile: "docker",
    plaintext: "text",
    txt: "text",
};
/** Highlight only grammars used in this request; unknown languages stay plain. */
export async function highlight(
    body: ContentBody,
): Promise<Record<string, string>> {
    const blocks = body.filter(
        (b) =>
            b._type === "code" &&
            typeof b._key === "string" &&
            typeof b.code === "string",
    );
    if (!blocks.length) return {};
    const langs = [
        ...new Set(
            blocks
                .map((b) => {
                    const language = String(b.language || "text").toLowerCase();
                    return aliases[language] || language;
                })
                .filter((l) => l !== "text" && l in bundledLanguages),
        ),
    ];
    const highlighter = await createHighlighterCore({
        themes: [theme],
        langs: await Promise.all(
            langs.map((l) =>
                bundledLanguages[l as keyof typeof bundledLanguages](),
            ),
        ),
        engine: createJavaScriptRegexEngine(),
    });
    const result: Record<string, string> = {};
    try {
        for (const block of blocks) {
            const lang =
                aliases[String(block.language || "text").toLowerCase()] ||
                String(block.language || "text").toLowerCase();
            const selected = langs.includes(lang) ? lang : "text";
            const lines = new Set(
                Array.isArray(block.highlightedLines)
                    ? block.highlightedLines
                    : [],
            );
            result[block._key!] = highlighter.codeToHtml(block.code as string, {
                lang: selected,
                theme: "portfolio",
                tabindex: 0,
                transformers: [
                    {
                        line(node, line) {
                            if (lines.has(line))
                                node.properties.class =
                                    `${node.properties.class || ""} line-highlight`.trim();
                        },
                    },
                ],
            });
        }
    } finally {
        highlighter.dispose();
    }
    return result;
}
