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
            sections.push({ heading: h, children: [] });
        }
    }

    return sections;
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
    const [activeId, setActiveId] = useState<string>(() =>
        headings.length > 0 ? headings[0].id : ""
    );
    const [scrollProgress, setScrollProgress] = useState(0);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set()
    );
    const observerRef = useRef<IntersectionObserver | null>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<HTMLElement>(null);

    const sections = useMemo(() => groupHeadings(headings), [headings]);

    // Auto-expand section containing active heading
    useEffect(() => {
        if (!activeId) return;
        for (const section of sections) {
            const childIds = section.children.map((c) => c.id);
            if (
                section.heading.id === activeId ||
                childIds.includes(activeId)
            ) {
                setExpandedSections((prev) => {
                    if (prev.has(section.heading.id)) return prev;
                    const next = new Set(prev);
                    next.add(section.heading.id);
                    return next;
                });
                break;
            }
        }
    }, [activeId, sections]);

    // Scroll progress — throttled via rAF
    useEffect(() => {
        let rafId = 0;
        const updateProgress = () => {
            const scrollTop = window.scrollY;
            const docHeight =
                document.documentElement.scrollHeight - window.innerHeight;
            setScrollProgress(
                docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0
            );
        };
        const onScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(updateProgress);
        };
        updateProgress();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            cancelAnimationFrame(rafId);
        };
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

    // Animate indicator position — also reacts to section expand/collapse
    useEffect(() => {
        if (!activeId || !indicatorRef.current || !navRef.current) return;

        const timer = setTimeout(() => {
            const activeLink = navRef.current?.querySelector(
                `a[data-heading-id="${activeId}"]`
            ) as HTMLElement | null;
            if (!activeLink || !navRef.current || !indicatorRef.current) return;

            const navRect = navRef.current.getBoundingClientRect();
            const linkRect = activeLink.getBoundingClientRect();

            indicatorRef.current.style.top = `${linkRect.top - navRect.top}px`;
            indicatorRef.current.style.height = `${linkRect.height}px`;
            indicatorRef.current.style.opacity = "1";
        }, 50);

        return () => clearTimeout(timer);
    }, [activeId, expandedSections]);

    const toggleSection = useCallback((sectionId: string) => {
        setExpandedSections((prev) => {
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

    if (headings.length === 0) return null;

    return (
        <aside className="hidden xl:block absolute top-0 left-full ml-8 w-64">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                {/* Progress bar */}
                <div className="h-0.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-4 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-150 ease-out"
                        style={{ width: `${scrollProgress * 100}%` }}
                    />
                </div>

                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-4">
                    On this page
                </p>

                <nav ref={navRef} className="relative">
                    {/* Sliding indicator bar */}
                    <div
                        ref={indicatorRef}
                        className="absolute left-0 w-0.5 rounded-full bg-emerald-500 transition-all duration-300 ease-out opacity-0"
                    />

                    <ul className="space-y-0.5 border-l border-slate-200/60 dark:border-slate-700/40">
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
                                                className="flex-shrink-0 w-4 h-4 mr-1 ml-2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
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
                                                "block py-1.5 text-sm leading-snug transition-all duration-200",
                                                !hasChildren ? "pl-6" : "",
                                                activeId ===
                                                section.heading.id
                                                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
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
                                            className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
                                            style={{
                                                gridTemplateRows: isExpanded
                                                    ? "1fr"
                                                    : "0fr",
                                                opacity: isExpanded ? 1 : 0,
                                            }}
                                        >
                                            <div className="overflow-hidden">
                                                <ul className="ml-6 border-l border-slate-200/40 dark:border-slate-700/30 pl-3 space-y-0.5">
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
                                                                        "block py-1 text-xs leading-snug transition-all duration-200",
                                                                        child.level ===
                                                                            4
                                                                            ? "pl-3"
                                                                            : "",
                                                                        activeId ===
                                                                        child.id
                                                                            ? "text-emerald-600 dark:text-emerald-400 font-medium"
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
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </div>
        </aside>
    );
}
