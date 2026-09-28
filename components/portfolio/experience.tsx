import Image from "next/image";
import SectionSpy from "@/components/portfolio/section-spy";
import CareerSectionHeading from "@/components/portfolio/section-heading";
import { urlForImage } from "@/lib/sanity-image";
import type { TimelineEntry } from "@/lib/sanity-client";
import {
    formatTimelineDate,
    isCurrentTimelineEntry,
} from "@/lib/profile-content";

export default function Experience({ entries }: { entries: TimelineEntry[] }) {
    if (!entries.length) return null;
    return (
        <SectionSpy
            section="Experience"
            threshold={0.2}
            id="experience"
            className="career-section"
        >
            <CareerSectionHeading
                number="01"
                title="Experience"
                description="Professional work and education."
            />
            <ol className="career-timeline">
                {entries.map((item) => {
                    const isCurrent = isCurrentTimelineEntry(item);
                    const start = formatTimelineDate(
                        item.startDate,
                        item.startPrecision,
                    );
                    const end = isCurrent
                        ? "Present"
                        : formatTimelineDate(item.endDate);
                    const dates = [start, end].filter(Boolean);
                    const dateLabel = [...new Set(dates)].join(" — ");
                    const highlights = item.highlights ?? [];
                    return (
                        <li key={item._key} className="career-timeline-item">
                            <div className="career-meta">
                                <span>
                                    {item.kind === "education"
                                        ? "Education"
                                        : "Work"}
                                </span>
                                {dateLabel && <span>{dateLabel}</span>}
                                {item.expectedEndYear && (
                                    <span>Expected {item.expectedEndYear}</span>
                                )}
                            </div>
                            <article>
                                <div className="career-role-heading">
                                    {item.logo?.asset && (
                                        <Image
                                            src={urlForImage(item.logo)
                                                .width(80)
                                                .height(80)
                                                .fit("max")
                                                .auto("format")
                                                .url()}
                                            alt={item.logo.alt || ""}
                                            width={40}
                                            height={40}
                                            sizes="40px"
                                            className="career-logo"
                                        />
                                    )}
                                    <div>
                                        <h3>{item.title}</h3>
                                        <p className="career-organization">
                                            {[item.organization, item.location]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </p>
                                    </div>
                                </div>
                                {item.summary && (
                                    <p className="career-summary">
                                        {item.summary}
                                    </p>
                                )}
                                {highlights.length > 0 && (
                                    <ul className="career-highlights">
                                        {highlights
                                            .slice(0, 3)
                                            .map((highlight) => (
                                                <li key={highlight}>
                                                    {highlight}
                                                </li>
                                            ))}
                                    </ul>
                                )}
                                {highlights.length > 3 && (
                                    <details className="career-role-details">
                                        <summary>
                                            More about this{" "}
                                            {item.kind === "education"
                                                ? "program"
                                                : "role"}
                                            <span className="sr-only">
                                                {" "}
                                                at {item.organization}
                                            </span>
                                        </summary>
                                        <ul className="career-highlights">
                                            {highlights
                                                .slice(3)
                                                .map((highlight) => (
                                                    <li key={highlight}>
                                                        {highlight}
                                                    </li>
                                                ))}
                                        </ul>
                                    </details>
                                )}
                                {item.skills?.length ? (
                                    <ul
                                        className="career-tags"
                                        aria-label="Skills"
                                    >
                                        {item.skills.map((skill) => (
                                            <li key={skill}>{skill}</li>
                                        ))}
                                    </ul>
                                ) : null}
                            </article>
                        </li>
                    );
                })}
            </ol>
        </SectionSpy>
    );
}
