import Image from "next/image";
import SectionSpy from "@/components/portfolio/section-spy";
import SectionHeading from "@/components/portfolio/section-heading";
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

function Highlights({ items }: { items: string[] }) {
    const visible = items.slice(0, 4);
    const remaining = items.slice(4);
    const listClasses =
        "relative pl-5 text-sm leading-6 text-slate-700 before:absolute before:left-0 before:top-[0.65rem] before:size-1.5 before:rounded-full before:bg-accent dark:text-slate-300";

    return (
        <div className="mt-5">
            <ul className="grid gap-3 sm:grid-cols-2">
                {visible.map((highlight) => (
                    <li key={highlight} className={listClasses}>
                        {highlight}
                    </li>
                ))}
            </ul>
            {remaining.length > 0 && (
                <details className="group mt-4">
                    <summary className="os-press w-fit cursor-pointer rounded-row font-term text-xs font-semibold text-accent marker:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]">
                        <span className="ml-1 group-open:hidden">
                            Show {remaining.length} more
                        </span>
                        <span className="ml-1 hidden group-open:inline">
                            Show less
                        </span>
                    </summary>
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {remaining.map((highlight) => (
                            <li key={highlight} className={listClasses}>
                                {highlight}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}

export default function Experience({ entries }: { entries: TimelineEntry[] }) {
    if (entries.length === 0) return null;

    return (
        <SectionSpy
            section="Experience"
            threshold={0.2}
            id="experience"
            className="scroll-mt-32"
        >
            <SectionHeading
                title="Experience"
                description="Roles and education, with the details that are useful to keep on the record."
            />

            <ol className="border-t border-slate-300/70 dark:border-white/10">
                {entries.map((item) => {
                    const start = formatMonth(item.startDate);
                    const end = formatMonth(item.endDate);
                    const isCurrent = !item.endDate && item.kind === "work";

                    return (
                        <li
                            key={item._key}
                            className="grid gap-4 border-b border-slate-300/70 py-8 dark:border-white/10 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-8 sm:py-10"
                        >
                            <div className="font-term text-xs tabular-nums leading-6 text-slate-500 dark:text-slate-400">
                                <p className="text-accent">
                                    {item.kind === "education"
                                        ? "Education"
                                        : "Work"}
                                </p>
                                <p className="mt-1">
                                    {[start, isCurrent ? "Present" : end]
                                        .filter(Boolean)
                                        .join(" — ")}
                                </p>
                            </div>

                            <article>
                                <div className="flex items-start gap-4">
                                    {item.logo?.asset && (
                                        <div className="grid size-12 shrink-0 place-items-center rounded-[0.9rem] border border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]">
                                            <Image
                                                src={urlForImage(item.logo)
                                                    .width(72)
                                                    .height(72)
                                                    .fit("max")
                                                    .auto("format")
                                                    .url()}
                                                alt={item.logo.alt || ""}
                                                width={30}
                                                height={30}
                                                sizes="30px"
                                                className="size-[1.875rem] object-contain"
                                            />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h3 className="font-display text-2xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-white">
                                            {item.title}
                                        </h3>
                                        <p className="mt-1 font-term text-xs leading-5 text-accent">
                                            {[item.organization, item.location]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </p>
                                    </div>
                                </div>

                                {item.summary && (
                                    <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
                                        {item.summary}
                                    </p>
                                )}

                                {item.highlights?.length ? (
                                    <Highlights items={item.highlights} />
                                ) : null}

                                {item.skills?.length ? (
                                    <ul
                                        className="mt-6 flex flex-wrap gap-2"
                                        aria-label="Skills"
                                    >
                                        {item.skills.map((skill) => (
                                            <li
                                                key={skill}
                                                className="rounded-full border border-slate-200/80 px-3 py-1 font-term text-[0.7rem] text-slate-600 dark:border-white/10 dark:text-slate-400"
                                            >
                                                {skill}
                                            </li>
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
