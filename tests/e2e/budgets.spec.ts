import { appendFileSync } from "node:fs";
import { brotliCompressSync, constants } from "node:zlib";
import { expect, test, prepareContext } from "./support/test";
import { STATIC_PAGES, contentPages, isPostPage } from "./support/routes";

/**
 * The byte report (plan §7.1): brotli sizes of the HTML, scripts, styles
 * and fonts each page loads, plus its prefetches: the page prefetches the
 * budget counts, and the per-URL route trees (`/_tree`, small static
 * responses) beside them. `next start`
 * serves gzip only, so each body is compressed here at quality 11; a
 * preview run reports the same numbers for the deployed build. Budgets are
 * printed next to the figures but only enforced from PR 17, so nothing
 * here fails on size.
 */

const BUDGETS = {
    sharedJs: 200 * 1024,
    css: 25 * 1024,
    fonts: 150 * 1024,
    postHtml: 90 * 1024,
    prefetches: 8,
};

/** Pages whose own styles take them past the CSS budget, with theirs:
 *  /resume/trajectory carries the flight's stage, record and scene
 *  (about 2.8 KB br of its own over the site's 23.3 KB). */
const CSS_ALLOWANCE: Record<string, number> = {
    "/resume/trajectory": 27 * 1024,
};

type Kind = "document" | "script" | "stylesheet" | "font";
const KINDS: Kind[] = ["document", "script", "stylesheet", "font"];

interface Resource {
    kind: Kind;
    raw: number;
    br: number;
}

interface PageBytes {
    path: string;
    resources: Map<string, Resource>;
    prefetches: number;
    /** Route-tree lookups (`next-router-segment-prefetch: /_tree`). */
    trees: number;
    /** Responses whose body the browser no longer held (not counted). */
    unread: number;
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

function brotli(body: Buffer): number {
    return brotliCompressSync(body, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length;
}

function total(page: PageBytes, kind: Kind, field: "raw" | "br" = "br") {
    let sum = 0;
    for (const resource of page.resources.values()) {
        if (resource.kind === kind) sum += resource[field];
    }
    return sum;
}

test("byte report", async ({ browser, request, baseURL }, testInfo) => {
    const posts = (await contentPages(request, testInfo)).filter(isPostPage);
    const paths = [...STATIC_PAGES, ...posts.slice(0, 1), "/resume/trajectory"];
    test.setTimeout(30_000 + paths.length * 15_000);
    const origin = new URL(baseURL ?? "").origin;
    const pages: PageBytes[] = [];

    for (const path of paths) {
        // A fresh context per page, so nothing comes from the HTTP cache,
        // at the mobile lab width (§7.1), which the prefetch count depends on.
        const context = await browser.newContext({
            baseURL,
            viewport: { width: 412, height: 915 },
        });
        await prepareContext(context, testInfo.project.name, baseURL);
        const page = await context.newPage();
        const measured: PageBytes = {
            path,
            resources: new Map(),
            prefetches: 0,
            trees: 0,
            unread: 0,
        };
        const reads: Promise<void>[] = [];

        page.on("request", (req) => {
            const headers = req.headers();
            if (headers["rsc"] !== "1" || !req.url().startsWith(origin)) return;
            if (headers["next-router-segment-prefetch"] === "/_tree") {
                measured.trees += 1;
            } else {
                measured.prefetches += 1;
            }
        });
        page.on("response", (response) => {
            const kind = response.request().resourceType() as Kind;
            if (!KINDS.includes(kind) || !response.ok()) return;
            if (!response.url().startsWith(origin)) return;
            reads.push(
                response.body().then(
                    (body) => {
                        // The fixture target answers Vercel's injected
                        // scripts with empty stubs; they are not site bytes.
                        if (body.length === 0) return;
                        measured.resources.set(response.url(), {
                            kind,
                            raw: body.length,
                            br: brotli(body),
                        });
                    },
                    () => {
                        measured.unread += 1;
                    },
                ),
            );
        });

        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await page.waitForLoadState("networkidle");
        await Promise.all(reads);
        pages.push(measured);
        await context.close();
    }

    // Scripts every measured page loads are the shared framework JS.
    const scriptSets = pages.map(
        (page) =>
            new Set(
                [...page.resources]
                    .filter(([, resource]) => resource.kind === "script")
                    .map(([url]) => url),
            ),
    );
    const sharedScripts = [...scriptSets[0]].filter((url) =>
        scriptSets.every((set) => set.has(url)),
    );
    const sharedJs = sharedScripts.reduce(
        (sum, url) => sum + (pages[0].resources.get(url)?.br ?? 0),
        0,
    );

    const over = (value: number, budget: number) =>
        value > budget ? " (over budget)" : "";
    const rows = pages.map((page) => {
        const js = total(page, "script");
        const isPost = posts.includes(page.path);
        return {
            page: page.path,
            "html (decoded)": `${kb(total(page, "document", "raw"))}${
                isPost
                    ? over(total(page, "document", "raw"), BUDGETS.postHtml)
                    : ""
            }`,
            "html br": kb(total(page, "document")),
            "js br": kb(js),
            "route js br": kb(js - sharedJs),
            "css br": `${kb(total(page, "stylesheet"))}${over(total(page, "stylesheet"), CSS_ALLOWANCE[page.path] ?? BUDGETS.css)}`,
            "fonts br": `${kb(total(page, "font"))}${over(total(page, "font"), BUDGETS.fonts)}`,
            prefetches: `${page.prefetches}${over(page.prefetches, BUDGETS.prefetches)}`,
            "route trees": page.trees,
            ...(page.unread ? { unread: page.unread } : {}),
        };
    });

    const summary = [
        `Byte report (${testInfo.project.name}, brotli q11, 412 px)`,
        `Shared JS on every page: ${kb(sharedJs)} br in ${sharedScripts.length} files${over(sharedJs, BUDGETS.sharedJs)}`,
    ];
    console.log(summary.join("\n"));
    console.table(rows);

    // On GitHub Actions the report also goes to the run's summary page.
    if (process.env.GITHUB_STEP_SUMMARY) {
        const cells: Record<string, unknown>[] = rows;
        const columns = [...new Set(cells.flatMap((row) => Object.keys(row)))];
        const table = [
            `| ${columns.join(" | ")} |`,
            `| ${columns.map(() => "---").join(" | ")} |`,
            ...cells.map(
                (row) =>
                    `| ${columns.map((column) => String(row[column] ?? "")).join(" | ")} |`,
            ),
        ];
        appendFileSync(
            process.env.GITHUB_STEP_SUMMARY,
            `### ${summary[0]}\n\n${summary[1]}\n\n${table.join("\n")}\n\n`,
        );
    }

    await testInfo.attach("byte-report.json", {
        contentType: "application/json",
        body: JSON.stringify(
            { sharedJs, sharedScripts: sharedScripts.length, rows },
            null,
            2,
        ),
    });
});
