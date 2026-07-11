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

// Must match the CSS gate (`hidden lg:block`) so the JS and Tailwind
// breakpoints agree — lg is 1024px.
const MIN_VIEWPORT = 1024;

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
    const [manualToggles, setManualToggles] = useState<Set<string>>(new Set());
    const observerRef = useRef<IntersectionObserver | null>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<HTMLElement>(null);

    const sections = useMemo(() => groupHeadings(headings), [headings]);

    // Derive which section is auto-expanded from activeId (no effect needed)
    const activeSectionId = useMemo(() => {
        if (!activeId) return "";
        for (const section of sections) {
            if (section.heading.id === activeId) return section.heading.id;
            if (section.children.some((c) => c.id === activeId))
                return section.heading.id;
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

    // Scroll progress — rAF-throttled transform write to a ref. Replaces
    // the motion/react useScroll MotionValue, which was this component's
    // (and the whole app's) only reason to ship the framer runtime.
    useEffect(() => {
        if (!hasRoom) return;
        let raf = 0;
        const update = () => {
            raf = 0;
            const doc = document.documentElement;
            const max = doc.scrollHeight - window.innerHeight;
            const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
            if (progressRef.current) {
                progressRef.current.style.transform = `scaleX(${progress})`;
            }
        };
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [hasRoom]);

    // IntersectionObserver for active heading
    useEffect(() => {
        if (headings.length === 0) return;

        const callback: IntersectionObserverCallback = (entries) => {
            const visible = entries
                .filter((e) => e.isIntersecting)
                .sort(
                    (a, b) =>
                        a.boundingClientRect.top - b.boundingClientRect.top,
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
            `a[data-heading-id="${activeId}"]`,
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

    // Native anchor navigation does the scrolling (html has !scroll-smooth
    // and every heading has scroll-mt-24): the hash updates, sequential
    // focus moves to the target, and the position is shareable. We only
    // sync the indicator immediately instead of waiting for the observer.
    const markActive = useCallback((id: string) => {
        setActiveId(id);
    }, []);

    if (headings.length === 0 || !hasRoom) return null;

    return (
        <aside className="hidden lg:block pl-8 xl:pl-10">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                {/* Scroll progress — thin accent line */}
                <div className="h-px bg-slate-200 dark:bg-slate-700/50 mb-5 relative overflow-hidden">
                    <div
                        ref={progressRef}
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-full bg-accent-gradient origin-left"
                        style={{ transform: "scaleX(0)" }}
                    />
                </div>

                <p className="font-term text-[0.7rem] font-bold uppercase tracking-[0.15em] text-slate-600 dark:text-slate-400 mb-5">
                    On this page
                </p>

                <nav
                    ref={navRef}
                    aria-label="Table of contents"
                    className="relative"
                >
                    {/* Sliding indicator bar */}
                    <div
                        ref={indicatorRef}
                        className="absolute left-0 w-0.5 rounded-full bg-accent-gradient-vertical transition-all duration-300 ease-out opacity-0"
                    />

                    <ul className="space-y-1">
                        {sections.map((section) => {
                            const isExpanded = expandedSections.has(
                                section.heading.id,
                            );
                            const hasChildren = section.children.length > 0;
                            const childListId = `toc-${section.heading.id}`;

                            return (
                                <li key={section.heading.id}>
                                    <div className="flex items-center">
                                        {hasChildren && (
                                            <button
                                                onClick={() =>
                                                    toggleSection(
                                                        section.heading.id,
                                                    )
                                                }
                                                className="flex-shrink-0 w-4 h-4 mr-1 flex items-center justify-center text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                                aria-expanded={isExpanded}
                                                aria-controls={childListId}
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
                                            data-heading-id={section.heading.id}
                                            onClick={() =>
                                                markActive(section.heading.id)
                                            }
                                            className={[
                                                // Parent heading link
                                                "block py-1.5 text-[13px] leading-snug transition-all duration-200",
                                                !hasChildren ? "pl-5" : "",
                                                activeId === section.heading.id
                                                    ? "text-accent font-medium"
                                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                                            ]
                                                .filter(Boolean)
                                                .join(" ")}
                                        >
                                            {section.heading.text}
                                        </a>
                                    </div>

                                    {/* Collapsible children — grid-rows
                                        0fr/1fr animates to the content's
                                        intrinsic height, so multi-line
                                        entries never clip. inert removes
                                        the hidden links from tab order. */}
                                    {hasChildren && (
                                        <div
                                            inert={!isExpanded}
                                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                                isExpanded
                                                    ? "grid-rows-[1fr] opacity-100"
                                                    : "grid-rows-[0fr] opacity-0"
                                            }`}
                                        >
                                            <ul
                                                id={childListId}
                                                className="overflow-hidden min-h-0 ml-5 border-l border-slate-200 dark:border-slate-700/40 pl-2.5 space-y-0.5"
                                            >
                                                {section.children.map(
                                                    (child) => (
                                                        <li key={child.id}>
                                                            <a
                                                                href={`#${child.id}`}
                                                                data-heading-id={
                                                                    child.id
                                                                }
                                                                onClick={() =>
                                                                    markActive(
                                                                        child.id,
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
                                                                        ? "text-accent font-medium"
                                                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                                                                ]
                                                                    .filter(
                                                                        Boolean,
                                                                    )
                                                                    .join(" ")}
                                                            >
                                                                {child.text}
                                                            </a>
                                                        </li>
                                                    ),
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
