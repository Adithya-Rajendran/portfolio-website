import { describe, expect, it } from "vitest";
import {
    knownProjectIds,
    projectIdLines,
} from "@/scripts/check-project-ids.mjs";

// Built here, so this file never holds an assignment the hook would refuse.
const KEY = "NEXT_PUBLIC_STORE_SANITY_PROJECT_ID";
const ID = ["ab12", "cd34"].join("");

describe("the pre-commit project-id check", () => {
    it("finds an id assigned in a shell line, a .env file, YAML or code", () => {
        for (const text of [
            `${KEY}=${ID} \\\n    pnpm build`,
            `# Sanity\n${KEY}="${ID}"`,
            `env:\n    ${KEY}: ${ID}\n`,
            `createClient({ projectId: "${ID}", dataset })`,
        ]) {
            expect(projectIdLines(text), text).toHaveLength(1);
        }
        expect(projectIdLines(`a\nb\n${KEY}=${ID}`)).toEqual([3]);
    });

    it("lets the fallback sentinel, an empty value and the env reads through", () => {
        for (const text of [
            `${KEY}=fallback pnpm build`,
            `env:\n    ${KEY}: fallback`,
            `${KEY}=\n`,
            `const projectId = process.env.${KEY};`,
            `projectId: process.env.${KEY} || "fallback",`,
            `projectId: projectId,`,
        ]) {
            expect(projectIdLines(text), text).toEqual([]);
        }
    });

    it("finds the machine's own id in any form, as a whole word", () => {
        for (const text of [
            `const projectId = "${ID}";`,
            `{"projectId": "${ID}"}`,
            `The Sanity project \`${ID}\` holds the content.`,
            `https://cdn.sanity.io/images/${ID}/production/x.png`,
            `https://${ID}.api.sanity.io/v2025-01-01`,
            `sanity dataset export --project ${ID}`,
        ]) {
            expect(projectIdLines(text, [ID]), text).toHaveLength(1);
            // Without the machine's id, these forms pass the assignment
            // rules: the id read from the env is what catches them.
            expect(projectIdLines(text), text).toEqual([]);
        }
        expect(projectIdLines(`x${ID}`, [ID])).toEqual([]);
        expect(projectIdLines(`${ID}9`, [ID])).toEqual([]);
        expect(projectIdLines(`one\ntwo ${ID}`, [ID])).toEqual([2]);
    });

    it("reads the ids from the environment and the local env files", () => {
        const OTHER = ["ef56", "gh78"].join("");
        expect(
            knownProjectIds({ [KEY]: ` ${ID} `, PATH: "/usr/bin" }, [
                { SANITY_STUDIO_PROJECT_ID: OTHER },
                { [KEY]: ID },
            ]).sort(),
        ).toEqual([ID, OTHER].sort());
        // Not an id: the sentinel, an empty value, another shape, or a
        // name that is not a Sanity project's.
        expect(
            knownProjectIds({ [KEY]: "fallback" }, [
                { [KEY]: "" },
                { SANITY_STUDIO_PROJECT_ID: "Not-An-Id" },
                { VERCEL_PROJECT_ID: ID },
            ]),
        ).toEqual([]);
    });
});
