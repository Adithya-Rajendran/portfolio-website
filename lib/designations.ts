/**
 * Designations printed next to titles. A mission's number is stored on the
 * project (`designation`), so adding a project never renumbers the others.
 * Keep this module free of imports: the Studio preview uses it.
 */

/** 2 → "MSN-02" */
export function formatMissionDesignation(designation: number): string {
    return `MSN-${String(designation).padStart(2, "0")}`;
}
