#!/usr/bin/env node
/**
 * Pre-commit check (lint-staged passes the staged files): refuses a file
 * that writes down a concrete Sanity project id, as an env assignment
 * (`NEXT_PUBLIC_STORE_SANITY_PROJECT_ID=…`, in a shell line, a .env file
 * or YAML) or a client option (`projectId: "…"`), and refuses the id this
 * machine actually uses wherever it appears (a URL, JSON, prose), read
 * from the environment and the local env files. The ids live in the
 * local env and Vercel's, never in the repository (CLAUDE.md, Sanity
 * schema changes); `fallback`, the sentinel the builds use, is allowed.
 * It prints where, never the value.
 */
import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

/** A Sanity project id: eight lowercase letters or digits. */
const ID = "([a-z0-9]{8})";
const ID_SHAPE = new RegExp(`^${ID}$`);

const ASSIGNMENTS = [
    // Shell and .env: NEXT_PUBLIC_STORE_SANITY_PROJECT_ID=<id>
    new RegExp(`\\b\\w*PROJECT_ID\\s*=\\s*["']?${ID}\\b`, "g"),
    // YAML: NEXT_PUBLIC_STORE_SANITY_PROJECT_ID: <id>
    new RegExp(`\\b\\w*PROJECT_ID\\s*:\\s*["']?${ID}["']?[ \\t]*$`, "gm"),
    // Code: projectId: "<id>"
    new RegExp(`\\bprojectId\\s*:\\s*["'\`]${ID}["'\`]`, "g"),
];

const ALLOWED = new Set(["fallback"]);

/** The env names that hold a Sanity project id. */
const ID_KEY = /SANITY\w*PROJECT_ID$/;

/** The local env files Next.js and the Sanity CLI read, in the repo root. */
const ENV_FILES = [".env.local", ".env"];

function readEnvFile(path) {
    try {
        return parseEnv(readFileSync(path, "utf8"));
    } catch {
        return {};
    }
}

/**
 * The concrete project ids this machine uses: the values of the
 * `…SANITY…PROJECT_ID` names in the environment and in the local env
 * files, when they have an id's shape (not `fallback`). Never printed.
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {Record<string, string | undefined>[]} [envFiles]
 * @returns {string[]}
 */
export function knownProjectIds(
    env = process.env,
    envFiles = ENV_FILES.map(readEnvFile),
) {
    const ids = new Set();
    for (const source of [env, ...envFiles]) {
        for (const [key, value] of Object.entries(source)) {
            const id = value?.trim();
            if (!ID_KEY.test(key) || !id || ALLOWED.has(id)) continue;
            if (ID_SHAPE.test(id)) ids.add(id);
        }
    }
    return [...ids];
}

/**
 * The 1-based lines of `text` that assign a concrete project id, or that
 * hold one of `knownIds` (as a whole word: in a URL, a JSON value, prose).
 *
 * @param {string} text
 * @param {string[]} [knownIds]
 * @returns {number[]}
 */
export function projectIdLines(text, knownIds = []) {
    const patterns = [
        ...ASSIGNMENTS,
        ...knownIds.map(
            (id) => new RegExp(`(?<![a-z0-9])(${id})(?![a-z0-9])`, "g"),
        ),
    ];
    const lines = new Set();
    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            if (ALLOWED.has(match[1])) continue;
            lines.add(text.slice(0, match.index).split("\n").length);
        }
    }
    return [...lines].sort((a, b) => a - b);
}

function main(paths) {
    const knownIds = knownProjectIds();
    let found = 0;
    for (const path of paths) {
        let text;
        try {
            if (statSync(path).size > 1024 * 1024) continue;
            text = readFileSync(path, "utf8");
        } catch {
            continue;
        }
        if (text.includes("\u0000")) continue;
        for (const line of projectIdLines(text, knownIds)) {
            found += 1;
            console.error(
                `${path}:${line}: a Sanity project id is written here. Keep it in .env.local and Vercel's env.`,
            );
        }
    }
    return found === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    process.exitCode = main(process.argv.slice(2));
}
