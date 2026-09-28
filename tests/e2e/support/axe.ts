import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** WCAG 2.2 AA plus axe's best-practice rules (plan §4.5, §7.2). */
const AXE_TAGS = [
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
    "best-practice",
];

/**
 * Documented, temporary exceptions. Each names the rule, the pages it
 * covers, the elements it covers, why it is allowed and the PR that removes
 * it. Anything else axe reports fails the run.
 *
 * The plan allowed the post code-comment contrast until PR 10's Shiki
 * themes. PR 1 already lifted it to 4.55:1 (from 3.87:1), so no allowance
 * is needed today; add one here, never inline in a spec.
 */
interface Allowance {
    rule: string;
    pages: RegExp;
    /** Every offending node's selector must match. */
    nodes: RegExp;
    reason: string;
    until: string;
}

export const AXE_ALLOWANCES: Allowance[] = [];

export interface AxeFinding {
    rule: string;
    impact: string;
    help: string;
    nodes: string[];
}

/** Runs axe on the loaded page and returns the violations not allowed. */
export async function axeViolations(
    page: Page,
    path: string,
    /** CSS selectors to limit the run to (the chrome on a legacy page). */
    include: string[] = [],
): Promise<AxeFinding[]> {
    let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
    for (const selector of include) builder = builder.include(selector);
    const { violations } = await builder.analyze();
    return violations
        .map((violation) => ({
            rule: violation.id,
            impact: violation.impact ?? "unknown",
            help: violation.help,
            nodes: violation.nodes.map((node) => node.target.join(" ")),
        }))
        .filter(
            (finding) =>
                !AXE_ALLOWANCES.some(
                    (allowance) =>
                        allowance.rule === finding.rule &&
                        allowance.pages.test(path) &&
                        finding.nodes.every((node) =>
                            allowance.nodes.test(node),
                        ),
                ),
        );
}
