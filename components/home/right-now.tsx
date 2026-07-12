import { ArrowUpRight } from "lucide-react";
import { hasVisibleItems } from "@/lib/content-rules";

export interface CuriosityItem {
    _key: string;
    title: string;
    note?: string | null;
    url?: string | null;
}

export default function RightNow({
    items,
    updatedAt,
    embedded = false,
}: {
    items: CuriosityItem[];
    updatedAt?: string | null;
    embedded?: boolean;
}) {
    if (!hasVisibleItems(items)) return null;

    return (
        <section
            aria-labelledby="right-now-heading"
            className={
                embedded
                    ? "mt-16 w-full pb-4 sm:mt-20"
                    : "mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8 sm:pb-24"
            }
        >
            <div className="grid gap-8 border-t border-slate-300/70 pt-10 dark:border-white/10 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-12 sm:pt-12">
                <header>
                    <h2
                        id="right-now-heading"
                        className="font-display text-2xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white"
                    >
                        Right now
                    </h2>
                    {updatedAt && (
                        <p className="mt-2 font-term text-[0.68rem] text-slate-500 dark:text-slate-400">
                            updated{" "}
                            <time dateTime={updatedAt}>
                                {updatedAt.slice(0, 10)}
                            </time>
                        </p>
                    )}
                </header>

                <ul className="border-t border-slate-300/70 dark:border-white/10">
                    {items.map((item) => (
                        <li
                            key={item._key}
                            className="border-b border-slate-300/70 py-5 dark:border-white/10"
                        >
                            {item.url ? (
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-start gap-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))]"
                                >
                                    <CuriosityCopy item={item} />
                                    <ArrowUpRight
                                        className="ml-auto mt-1 size-4 shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                                        aria-hidden
                                    />
                                </a>
                            ) : (
                                <CuriosityCopy item={item} />
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

function CuriosityCopy({ item }: { item: CuriosityItem }) {
    return (
        <div>
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                {item.title}
            </h3>
            {item.note && (
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {item.note}
                </p>
            )}
        </div>
    );
}
