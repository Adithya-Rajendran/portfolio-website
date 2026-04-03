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

// Content column max-width (max-w-3xl = 768px) + ToC width (max-w-xs = 320px)
// + spacing on both sides. We hide the ToC if the gutter isn't wide enough.
const CONTENT_WIDTH = 768;
const TOC_WIDTH = 280;
const GUTTER_PADDING = 48; // 24px each side
const MIN_VIEWPORT = CONTENT_WIDTH + TOC_WIDTH + GUTTER_PADDING * 2;

export default function TableOfContents({ headings }: TableOfContentsProps) {
    const [activeId, setActiveId] = useState<string>("");
    const [hasRoom, setHasRoom] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        const checkRoom = () => setHasRoom(window.innerWidth >= MIN_VIEWPORT);
        checkRoom();
        window.addEventListener("resize", checkRoom);
        return () => window.removeEventListener("resize", checkRoom);
    }, []);

    useEffect(() => {
        if (headings.length === 0) return;

        const callback: IntersectionObserverCallback = (entries) => {
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

    if (headings.length === 0 || !hasRoom) return null;

    return (
        <aside className="fixed top-24 max-h-[calc(100vh-8rem)] overflow-y-auto z-30"
            style={{ right: `max(24px, calc((100vw - ${CONTENT_WIDTH}px) / 2 - ${TOC_WIDTH}px - 16px))`, width: TOC_WIDTH }}>
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
