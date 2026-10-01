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
 * Code comments are ink-3 in the one Shiki theme (PR 10): 5.7:1 or more on
 * a listing in both themes, checked by axe and by tests/e2e/post.spec.ts.
 * No allowance is needed today; add one here, never inline in a spec.
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
): Promise<AxeFinding[]> {
    const { violations } = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .analyze();
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
