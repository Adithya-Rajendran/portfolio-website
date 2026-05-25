"use client";

import { useSectionInView } from "@/lib/hooks";
import type { SectionName } from "@/lib/types";

interface SectionSpyProps {
    section: SectionName;
    threshold?: number;
    id: string;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}

/**
 * Thin client wrapper that wires the section to the header's active-nav
 * highlight. The actual section content stays server-rendered.
 */
export default function SectionSpy({
    section,
    threshold,
    id,
    className,
    style,
    children,
}: SectionSpyProps) {
    const { ref } = useSectionInView(section, threshold);

    return (
        <section ref={ref} id={id} className={className} style={style}>
            {children}
        </section>
    );
}
