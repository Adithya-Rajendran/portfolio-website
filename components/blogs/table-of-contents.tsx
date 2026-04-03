"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface TocHeading {
    id: string;
    text: string;
    level: 2 | 3 | 4;
}

interface TocSection {
    heading: TocHeading;
    children: TocHeading[];
}

interface TableOfContentsProps {
    headings: TocHeading[];
}

// Content is max-w-3xl (768px) centered. ToC needs ~200px in the right
// gutter to be usable → min viewport ≈ 768 + 200*2 + padding ≈ 1200.
const MIN_VIEWPORT = 1200;

function groupHeadings(headings: TocHeading[]): TocSection[] {
    const sections: TocSection[] = [];
    let current: TocSection | null = null;

    for (const h of headings) {
        if (h.level === 2) {
            current = { heading: h, children: [] };
            sections.push(current);
        } else if (current) {
            current.children.push(h);
        } else {
            // h3/h4 before any h2 — treat as top-level section
            sections.push({ heading: h, children: [] });
        }
    }

    return sections;
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
    const [activeId, setActiveId] = useState<string>("");
    const [hasRoom, setHasRoom] = useState(false);
    const [tocWidth, setTocWidth] = useState(224);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [manualToggles, setManualToggles] = useState<Set<string>>(new Set());
    const observerRef = useRef<IntersectionObserver | null>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<HTMLElement>(null);

    const sections = useMemo(() => groupHeadings(headings), [headings]);

    // Derive which section is auto-expanded from activeId (no effect needed)
    const activeSectionId = useMemo(() => {
        if (!activeId) return "";
        for (const section of sections) {
            if (section.heading.id === activeId) return section.heading.id;
            if (section.children.some((c) => c.id === activeId)) return section.heading.id;
        }
        return "";
    }, [activeId, sections]);

    // Merge auto-expanded + manually toggled sections
    const expandedSections = useMemo(() => {
        const merged = new Set(manualToggles);
        if (activeSectionId) merged.add(activeSectionId);
        return merged;
    }, [manualToggles, activeSectionId]);

    // Viewport check + dynamic width scaling
    useEffect(() => {
        const checkRoom = () => {
            const vw = window.innerWidth;
            setHasRoom(vw >= MIN_VIEWPORT);

            // Content is max-w-3xl (768px) centered.
            // Gutter = (vw - 768) / 2. Reserve 24px right edge + 32px gap.
            const gutter = (vw - 768) / 2;
            const available = gutter - 24 - 32;
            // Clamp between 200px and 480px — use most of the gutter
            setTocWidth(Math.max(200, Math.min(available, 480)));
        };
        checkRoom();
        window.addEventListener("resize", checkRoom);
        return () => window.removeEventListener("resize", checkRoom);
    }, []);

    // Scroll progress
    useEffect(() => {
        const updateProgress = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            setScrollProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
        };
        updateProgress();
        window.addEventListener("scroll", updateProgress, { passive: true });
        return () => window.removeEventListener("scroll", updateProgress);
    }, []);

    // IntersectionObserver for active heading
    useEffect(() => {
        if (headings.length === 0) return;

        const callback: IntersectionObserverCallback = (entries) => {
            const visible = entries
                .filter((e) => e.isIntersecting)
                .sort(
                    (a, b) =>
                        a.boundingClientRect.top - b.boundingClientRect.top
                );

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

    // Animate indicator position
    useEffect(() => {
        if (!activeId || !indicatorRef.current || !navRef.current) return;
        const activeLink = navRef.current.querySelector(
            `a[data-heading-id="${activeId}"]`
        ) as HTMLElement | null;
        if (!activeLink) return;

        const navRect = navRef.current.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();

        indicatorRef.current.style.top = `${linkRect.top - navRect.top}px`;
        indicatorRef.current.style.height = `${linkRect.height}px`;
        indicatorRef.current.style.opacity = "1";
    }, [activeId]);

    const toggleSection = useCallback((sectionId: string) => {
        setManualToggles((prev) => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    }, []);

    const scrollToHeading = useCallback(
        (e: React.MouseEvent, id: string) => {
            e.preventDefault();
            document
                .getElementById(id)
                ?.scrollIntoView({ behavior: "smooth" });
            setActiveId(id);
        },
        []
    );

    if (headings.length === 0 || !hasRoom) return null;

    return (
        <aside
            className="fixed top-24 right-6 max-h-[calc(100vh-8rem)] overflow-y-auto z-30 transition-[width] duration-200"
            style={{ width: `${tocWidth}px` }}
        >
            <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-lg overflow-hidden">
                {/* Scroll progress bar */}
                <div className="h-1 bg-slate-100 dark:bg-slate-800">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-150 ease-out"
                        style={{ width: `${scrollProgress * 100}%` }}
                    />
                </div>

                <div className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-4">
                        On this page
                    </p>

                    <nav ref={navRef} className="relative">
                        {/* Sliding indicator bar */}
                        <div
                            ref={indicatorRef}
                            className="absolute left-0 w-0.5 rounded-full bg-emerald-500 transition-all duration-300 ease-out opacity-0"
                        />

                        <ul className="space-y-0.5">
                            {sections.map((section) => {
                                const isExpanded = expandedSections.has(
                                    section.heading.id
                                );
                                const hasChildren = section.children.length > 0;

                                return (
                                    <li key={section.heading.id}>
                                        <div className="flex items-center">
                                            {hasChildren && (
                                                <button
                                                    onClick={() =>
                                                        toggleSection(
                                                            section.heading.id
                                                        )
                                                    }
                                                    className="flex-shrink-0 w-4 h-4 mr-1 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                                    aria-label={
                                                        isExpanded
                                                            ? "Collapse section"
                                                            : "Expand section"
                                                    }
                                                >
                                                    <svg
                                                        className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={2}
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M9 5l7 7-7 7"
                                                        />
                                                    </svg>
                                                </button>
                                            )}
                                            <a
                                                href={`#${section.heading.id}`}
                                                data-heading-id={
                                                    section.heading.id
                                                }
                                                onClick={(e) =>
                                                    scrollToHeading(
                                                        e,
                                                        section.heading.id
                                                    )
                                                }
                                                className={[
                                                    "block py-1.5 text-sm leading-snug transition-all duration-200 rounded",
                                                    !hasChildren ? "pl-5" : "",
                                                    activeId ===
                                                    section.heading.id
                                                        ? "text-emerald-600 dark:text-emerald-400 font-medium translate-x-0.5"
                                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")}
                                            >
                                                {section.heading.text}
                                            </a>
                                        </div>

                                        {/* Collapsible children */}
                                        {hasChildren && (
                                            <div
                                                className="overflow-hidden transition-all duration-300 ease-out"
                                                style={{
                                                    maxHeight: isExpanded
                                                        ? `${section.children.length * 40}px`
                                                        : "0px",
                                                    opacity: isExpanded
                                                        ? 1
                                                        : 0,
                                                }}
                                            >
                                                <ul className="ml-5 border-l border-slate-200 dark:border-slate-700/50 pl-2 space-y-0.5">
                                                    {section.children.map(
                                                        (child) => (
                                                            <li
                                                                key={child.id}
                                                            >
                                                                <a
                                                                    href={`#${child.id}`}
                                                                    data-heading-id={
                                                                        child.id
                                                                    }
                                                                    onClick={(
                                                                        e
                                                                    ) =>
                                                                        scrollToHeading(
                                                                            e,
                                                                            child.id
                                                                        )
                                                                    }
                                                                    className={[
                                                                        "block py-1 text-xs leading-snug transition-all duration-200 rounded",
                                                                        child.level ===
                                                                            4
                                                                            ? "pl-3"
                                                                            : "",
                                                                        activeId ===
                                                                        child.id
                                                                            ? "text-emerald-600 dark:text-emerald-400 font-medium translate-x-0.5"
                                                                            : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                                                                    ]
                                                                        .filter(
                                                                            Boolean
                                                                        )
                                                                        .join(
                                                                            " "
                                                                        )}
                                                                >
                                                                    {
                                                                        child.text
                                                                    }
                                                                </a>
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </div>
            </div>
        </aside>
    );
}
