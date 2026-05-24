"use client";

import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

interface RevealOnScrollProps {
    children: React.ReactNode;
    className?: string;
    /** Index used to stagger children that share a parent. */
    delayMs?: number;
    /** Fraction of element visible before triggering. */
    threshold?: number;
    /** Override the wrapper element. Defaults to a div. */
    as?: "div" | "section" | "article" | "li";
}

/**
 * Latches an element into "visible" state the first time it enters the
 * viewport, then never toggles back. Uses CSS transitions for the fade/
 * translate so the framer-motion runtime isn't required for simple
 * scroll-in animations. Respects prefers-reduced-motion via motion-safe:.
 */
export default function RevealOnScroll({
    children,
    className,
    delayMs = 0,
    threshold = 0.15,
    as: Tag = "div",
}: RevealOnScrollProps) {
    const { ref, inView } = useInView({ threshold, triggerOnce: true });

    return (
        <Tag
            ref={ref}
            className={cn(
                "motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out",
                inView
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8",
                className,
            )}
            style={{
                transitionDelay: inView ? `${delayMs}ms` : "0ms",
            }}
        >
            {children}
        </Tag>
    );
}
