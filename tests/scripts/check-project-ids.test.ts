import { describe, expect, it } from "vitest";
import { projectIdLines } from "@/scripts/check-project-ids.mjs";

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
});
