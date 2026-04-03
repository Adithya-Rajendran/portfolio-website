"use client";

import { useEffect, useRef, useState } from "react";

export interface TocHeading {
    id: string;
    text: string;
    level: 2 | 3 | 4;
}

interface TableOfContentsProps {
    headings: TocHeading[];
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
    const [activeId, setActiveId] = useState<string>("");
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        if (headings.length === 0) return;

        const callback: IntersectionObserverCallback = (entries) => {
            // Find the topmost visible heading
            const visible = entries
                .filter((e) => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

            if (visible.length > 0) {
                setActiveId(visible[0].target.id);
            }
        };

        observerRef.current = new IntersectionObserver(callback, {
            rootMargin: "-10% 0px -80% 0px",
            threshold: 0,
        });

        headings.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) observerRef.current?.observe(el);
        });

        return () => observerRef.current?.disconnect();
    }, [headings]);

    if (headings.length === 0) return null;

    return (
        <aside className="hidden xl:block fixed right-6 2xl:right-12 top-24 w-60 max-h-[calc(100vh-8rem)] overflow-y-auto z-30">
            <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-5 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-4">
                        On this page
                    </p>
                    <nav>
                        <ul className="space-y-1">
                            {headings.map(({ id, text, level }) => (
                                <li key={id}>
                                    <a
                                        href={`#${id}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            document
                                                .getElementById(id)
                                                ?.scrollIntoView({ behavior: "smooth" });
                                            setActiveId(id);
                                        }}
                                        className={[
                                            "block py-1 text-sm leading-snug transition-colors rounded",
                                            level === 3 ? "pl-3" : level === 4 ? "pl-6" : "",
                                            activeId === id
                                                ? "text-emerald-600 dark:text-emerald-400 font-medium"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        {text}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
            </div>
        </aside>
    );
}
