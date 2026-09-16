"use client";

import { useEffect, useState } from "react";

interface TocHeading {
    id: string;
    text: string;
    level: 2 | 3 | 4;
}

export default function TableOfContents({
    headings,
}: {
    headings: TocHeading[];
}) {
    const [activeId, setActiveId] = useState("");
    useEffect(() => {
        if (!headings.length) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (a, b) =>
                            a.boundingClientRect.top - b.boundingClientRect.top,
                    );
                if (visible.length) setActiveId(visible[0].target.id);
            },
            { rootMargin: "-10% 0px -70% 0px", threshold: 0 },
        );
        headings.forEach(({ id }) => {
            const element = document.getElementById(id);
            if (element) observer.observe(element);
        });
        return () => observer.disconnect();
    }, [headings]);
    if (!headings.length) return null;
    return (
        <aside className="journal-desktop-toc">
            <nav aria-label="Table of contents">
                <p className="journal-eyebrow">On this page</p>
                <ul>
                    {headings.map((heading) => (
                        <li key={heading.id} data-level={heading.level}>
                            <a
                                href={`#${heading.id}`}
                                aria-current={
                                    activeId === heading.id
                                        ? "location"
                                        : undefined
                                }
                                onClick={() => setActiveId(heading.id)}
                            >
                                {heading.text}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
}
