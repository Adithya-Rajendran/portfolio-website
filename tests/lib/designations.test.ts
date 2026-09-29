import { describe, expect, it } from "vitest";
import {
    formatLogDesignation,
    formatMissionDesignation,
    logNumbers,
} from "@/lib/designations";

/** The owner's three published posts, as the list query returns them. */
const POSTS = [
    {
        _id: "d25c7eae",
        slug: "my-homelab",
        publishedAt: "2026-03-30",
    },
    {
        _id: "0f92e055",
        slug: "running-gui-apps-in-lxc-containers",
        publishedAt: "2026-03-26",
    },
    {
        _id: "703a284c",
        slug: "kubernetes-on-the-nvidia-dgx-spark",
        publishedAt: "2026-03-06",
    },
];

describe("formatLogDesignation", () => {
    it("pads to three digits", () => {
        expect(formatLogDesignation(1)).toBe("LOG 001");
        expect(formatLogDesignation(42)).toBe("LOG 042");
    });

    it("keeps every digit past 999", () => {
        expect(formatLogDesignation(1000)).toBe("LOG 1000");
    });
});

describe("formatMissionDesignation", () => {
    it("pads to two digits", () => {
        expect(formatMissionDesignation(2)).toBe("MSN-02");
        expect(formatMissionDesignation(12)).toBe("MSN-12");
    });
});

describe("logNumbers", () => {
    it("numbers entries in the order they were filed, oldest first", () => {
        expect(Object.fromEntries(logNumbers(POSTS))).toEqual({
            "kubernetes-on-the-nvidia-dgx-spark": 1,
            "running-gui-apps-in-lxc-containers": 2,
            "my-homelab": 3,
        });
    });

    it("does not depend on the order the list arrives in", () => {
        const expected = Object.fromEntries(logNumbers(POSTS));
        const shuffled = [POSTS[1], POSTS[2], POSTS[0]];
        expect(Object.fromEntries(logNumbers(shuffled))).toEqual(expected);
        expect(Object.fromEntries(logNumbers([...POSTS].reverse()))).toEqual(
            expected,
        );
    });

    it("orders entries filed on the same day by document id", () => {
        const sameDay = [
            { _id: "b", slug: "second", publishedAt: "2026-04-01" },
            { _id: "a", slug: "first", publishedAt: "2026-04-01" },
        ];
        expect(Object.fromEntries(logNumbers(sameDay))).toEqual({
            first: 1,
            second: 2,
        });
        expect(Object.fromEntries(logNumbers([...sameDay].reverse()))).toEqual({
            first: 1,
            second: 2,
        });
    });

    it("keeps the existing numbers when a newer entry is filed", () => {
        const next = [
            { _id: "new", slug: "next-entry", publishedAt: "2026-10-02" },
            ...POSTS,
        ];
        const numbers = logNumbers(next);
        expect(numbers.get("next-entry")).toBe(4);
        expect(numbers.get("my-homelab")).toBe(3);
        expect(numbers.get("kubernetes-on-the-nvidia-dgx-spark")).toBe(1);
    });

    it("skips posts without a slug and puts undated posts last", () => {
        const numbers = logNumbers([
            { slug: "", publishedAt: "2026-01-01" },
            { slug: "undated", publishedAt: null },
            ...POSTS,
        ]);
        expect(numbers.size).toBe(4);
        expect(numbers.get("undated")).toBe(4);
        expect(numbers.get("kubernetes-on-the-nvidia-dgx-spark")).toBe(1);
    });
});
