"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll } from "motion/react";

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

// Content is max-w-3xl (768px) centered. ToC needs ~224px + margin in the
// right gutter → min viewport ≈ 768 + 224 + margins ≈ 1080.
const MIN_VIEWPORT = 1080;

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
    const { scrollYProgress } = useScroll();
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

    // Viewport check — only show when there's enough room for the gutter
    useEffect(() => {
        const checkRoom = () => setHasRoom(window.innerWidth >= MIN_VIEWPORT);
        checkRoom();
        window.addEventListener("resize", checkRoom);
        return () => window.removeEventListener("resize", checkRoom);
    }, []);

    // Scroll progress is now handled hardware-accelerated by motion/react useScroll

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
            className="hidden lg:block pl-8 xl:pl-10"
        >
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
            {/* Scroll progress — thin accent line */}
            <div className="h-px bg-slate-200 dark:bg-slate-700/50 mb-5 relative overflow-hidden">
                <motion.div
                    className="absolute inset-y-0 left-0 bg-emerald-500 origin-left"
                    style={{ width: "100%", scaleX: scrollYProgress }}
                />
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-5">
                On this page
            </p>

            <nav ref={navRef} className="relative">
                {/* Sliding indicator bar */}
                <div
                    ref={indicatorRef}
                    className="absolute left-0 w-0.5 rounded-full bg-emerald-500 transition-all duration-300 ease-out opacity-0"
                />

                <ul className="space-y-1">
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
                                            // Parent heading link
                                            "block py-1.5 text-[13px] leading-snug transition-all duration-200",
                                            !hasChildren ? "pl-5" : "",
                                            activeId ===
                                            section.heading.id
                                                ? "text-emerald-600 dark:text-emerald-400 font-medium"
                                                : "text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200",
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
                                        <ul className="ml-5 border-l border-slate-200 dark:border-slate-700/40 pl-2.5 space-y-0.5">
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
