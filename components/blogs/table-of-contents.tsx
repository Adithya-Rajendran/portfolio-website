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

// Content is max-w-3xl (768px) centered
// ToC is w-52 (208px) + right padding (32px) + gap from content (32px)
// Min viewport = 768 + (208 + 32 + 32) * 2 = 768 + 544 = 1312px
// Using 1400px to have comfortable spacing
const MIN_VIEWPORT = 1400;

export default function TableOfContents({ headings }: TableOfContentsProps) {
    const [activeId, setActiveId] = useState<string>("");
    const [hasRoom, setHasRoom] = useState(false);
    const [tocWidth, setTocWidth] = useState(208); // w-52 default
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        const checkRoom = () => {
            const width = window.innerWidth;
            setHasRoom(width >= MIN_VIEWPORT);
            
            // Calculate available gutter space and scale ToC width
            // Content is 768px centered, so gutter = (width - 768) / 2
            // Reserve 24px padding on right edge, 32px gap from content
            const gutterWidth = (width - 768) / 2;
            const available = gutterWidth - 24 - 32; // right padding - gap
            
            // Min 208px (w-52), max 400px, grow based on available space
            const newWidth = Math.max(208, Math.min(available - 16, 400));
            setTocWidth(newWidth);
        };
        
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
        <aside className="fixed top-24 right-6 max-h-[calc(100vh-8rem)] overflow-y-auto z-30 w-52">
            <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-4 shadow-lg">
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
