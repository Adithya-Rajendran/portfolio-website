import Image from "next/image";
import SectionSpy from "@/components/portfolio/section-spy";
import CareerSectionHeading from "@/components/portfolio/section-heading";
import { urlForImage } from "@/lib/sanity-image";
import type { TimelineEntry } from "@/lib/sanity-client";

function formatMonth(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(parsed);
}

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
                    const isCurrent = !item.endDate && item.kind === "work";
                    return (
                        <li key={item._key} className="career-timeline-item">
                            <div className="career-meta">
                                <span>
                                    {item.kind === "education"
                                        ? "Education"
                                        : "Work"}
                                </span>
                                <span>
                                    {[
                                        formatMonth(item.startDate),
                                        isCurrent
                                            ? "Present"
                                            : formatMonth(item.endDate),
                                    ]
                                        .filter(Boolean)
                                        .join(" — ")}
                                </span>
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
                                {item.highlights?.length ? (
                                    <ul className="career-highlights">
                                        {item.highlights.map((highlight) => (
                                            <li key={highlight}>{highlight}</li>
                                        ))}
                                    </ul>
                                ) : null}
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
