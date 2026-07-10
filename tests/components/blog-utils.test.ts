import { describe, expect, it } from "vitest";
import { extractHeadings, headingIdsByKey } from "@/components/blogs/utils";
import type { Post } from "@/sanity.types";

function heading(style: "h2" | "h3" | "h4", text: string, key: string) {
    return {
        _type: "block",
        _key: key,
        style,
        markDefs: [],
        children: [{ _type: "span", _key: `${key}s`, text, marks: [] }],
    };
}

function bodyOf(...blocks: unknown[]): Pick<Post, "body"> {
    return { body: blocks as unknown as Post["body"] };
}

describe("extractHeadings", () => {
    it("slugifies heading text into ids and keeps levels/keys", () => {
        const headings = extractHeadings(
            bodyOf(
                heading("h2", "Hardware and topology", "a"),
                heading("h3", "Why it matters!", "b"),
            ),
        );

        expect(headings).toEqual([
            {
                id: "hardware-and-topology",
                text: "Hardware and topology",
                level: 2,
                key: "a",
            },
            {
                id: "why-it-matters",
                text: "Why it matters!",
                level: 3,
                key: "b",
            },
        ]);
    });

    it("suffixes repeated heading text so anchor ids stay unique", () => {
        const headings = extractHeadings(
            bodyOf(
                heading("h2", "Setup", "a"),
                heading("h2", "Setup", "b"),
                heading("h3", "Setup", "c"),
            ),
        );

        expect(headings.map((h) => h.id)).toEqual([
            "setup",
            "setup-2",
            "setup-3",
        ]);
    });

    it("never emits an id that collides with a suffixed one", () => {
        // "Intro", "Intro", "Intro 2": naive base-counting would give the
        // second Intro and the literal "Intro 2" the same id.
        const headings = extractHeadings(
            bodyOf(
                heading("h2", "Intro", "a"),
                heading("h2", "Intro", "b"),
                heading("h2", "Intro 2", "c"),
            ),
        );

        const ids = headings.map((h) => h.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toEqual(["intro", "intro-2", "intro-2-2"]);
    });

    it("skips headings with empty text and non-heading blocks", () => {
        const headings = extractHeadings(
            bodyOf(
                heading("h2", "", "a"),
                {
                    _type: "block",
                    _key: "p1",
                    style: "normal",
                    children: [
                        {
                            _type: "span",
                            _key: "p1s",
                            text: "prose",
                            marks: [],
                        },
                    ],
                },
                { _type: "code", _key: "c1", code: "x", language: "text" },
                heading("h4", "Real", "b"),
            ),
        );

        expect(headings).toEqual([
            { id: "real", text: "Real", level: 4, key: "b" },
        ]);
    });

    it("returns an empty array when there is no body", () => {
        expect(extractHeadings({ body: undefined })).toEqual([]);
    });
});

describe("headingIdsByKey", () => {
    it("maps block keys to their (deduped) ids", () => {
        const map = headingIdsByKey(
            extractHeadings(
                bodyOf(
                    heading("h2", "Setup", "a"),
                    heading("h2", "Setup", "b"),
                ),
            ),
        );

        expect(map).toEqual({ a: "setup", b: "setup-2" });
    });
});
