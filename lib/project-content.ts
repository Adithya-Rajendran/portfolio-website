import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/project-fields";
import type { ProjectListItem } from "@/lib/sanity-client";

/** "Active", "Complete", "Planned"…: the label the Studio shows too. */
export function projectStatusLabel(status: ProjectStatus): string {
    return (
        PROJECT_STATUSES.find((option) => option.value === status)?.title ??
        status
    );
}

/**
 * A project's years as the current pages print them: "2023", "2024–2025",
 * or with "c." when the dates are the owner's estimate ("c. 2024–2025").
 * Months are never printed here, so `datePrecision` does not change the
 * result.
 */
export function formatProjectYears(
    project: Pick<
        ProjectListItem,
        "startDate" | "endDate" | "datesApproximate"
    >,
): string | null {
    const startYear = project.startDate?.slice(0, 4);
    const endYear = project.endDate?.slice(0, 4);
    const years =
        startYear && endYear && startYear !== endYear
            ? `${startYear}–${endYear}`
            : (startYear ?? endYear);
    if (!years) return null;
    return project.datesApproximate ? `c. ${years}` : years;
}
