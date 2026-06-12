import { useActiveSectionContext } from "@/context/active-section-context";
import { useCallback, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import type { SectionName } from "./types";

export function useSectionInView(sectionName: SectionName, threshold = 0.75) {
    const { ref, inView } = useInView({
        threshold,
    });
    const { setActiveSection, timeOfLastClick } = useActiveSectionContext();

    useEffect(() => {
        if (inView && Date.now() - timeOfLastClick > 1000) {
            setActiveSection(sectionName);
        }
    }, [inView, setActiveSection, timeOfLastClick, sectionName]);

    return {
        ref,
        inView,
    };
}

interface SectionRevealOptions {
    /** Threshold for the header scroll-spy observer (useSectionInView). */
    spyThreshold?: number;
    /** Fraction of the section visible before the one-shot reveal fires. */
    revealThreshold?: number;
}

/**
 * Combines the header scroll-spy with a latched (triggerOnce) reveal
 * observer and returns a single merged callback ref for the section.
 *
 * Consumers must gate their pre-reveal hidden state and transition
 * behind motion-safe: variants with a visible base state, so users with
 * prefers-reduced-motion — or environments where IntersectionObserver
 * never fires — see content immediately.
 */
export function useSectionReveal(
    sectionName: SectionName,
    { spyThreshold, revealThreshold = 0.15 }: SectionRevealOptions = {},
) {
    const { ref: spyRef } = useSectionInView(sectionName, spyThreshold);
    const { ref: revealRef, inView } = useInView({
        threshold: revealThreshold,
        triggerOnce: true,
        fallbackInView: true,
    });

    const ref = useCallback(
        (node: HTMLElement | null) => {
            spyRef(node);
            revealRef(node);
        },
        [spyRef, revealRef],
    );

    return { ref, inView };
}
