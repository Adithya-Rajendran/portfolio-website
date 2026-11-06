import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/project-fields";
import type { ProjectListItem } from "@/lib/content-types";
import { MONTHS } from "@/lib/dates";

/** Respect the CMS precision: placeholder month/day values are not facts. */
export function formatProjectDates(
    project: Pick<
        ProjectListItem,
        | "startDate"
        | "endDate"
        | "datePrecision"
        | "datesApproximate"
        | "status"
    >,
): string | null {
    const label = (date?: string | null) => {
        if (!date) return null;
        const match = /^(\d{4})(?:-(\d{2}))?/.exec(date);
        if (!match) return null;
        if (project.datePrecision === "year" || !match[2]) return match[1];
        const month = MONTHS[Number(match[2]) - 1];
        return month ? `${month} ${match[1]}` : null;
    };
    const start = label(project.startDate);
    const end = label(project.endDate);
    if (!start && !end) return null;
    const dates =
        start && end && start !== end
            ? `${start} – ${end}`
            : start && !end && project.status === "active"
              ? `${start} – present`
              : start || end;
    return project.datesApproximate ? `c. ${dates}` : dates;
}

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
