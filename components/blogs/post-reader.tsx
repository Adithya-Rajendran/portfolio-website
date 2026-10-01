"use client";

import { useEffect, useRef } from "react";

/**
 * The post page's one behaviour island (≤ 8 KB with the Copy buttons):
 *
 * - Marks the contents link of the section being read (`aria-current`),
 *   from geometry: the last heading above a line 30% down the viewport.
 * - Keeps in-page links inside the visible entry. Cache Components keeps
 *   visited routes mounted but hidden, so two entries can both hold
 *   `#fn-1` or a heading id; a plain fragment link would scroll to the
 *   first one in the document, which may be hidden. Contents, footnote
 *   and back links are resolved inside this entry's root instead
 *   (plan §2.3 rule 4), and the address still gains the fragment.
 * - Closes the phone's contents box after a contents link.
 *
 * Renders nothing. Without JavaScript the links are plain fragments,
 * which is right there: without JavaScript only one page is loaded.
 */
export default function PostReader() {
    const marker = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const root = marker.current?.closest<HTMLElement>("[data-page]");
        if (!root) return;

        const find = (id: string) => {
            try {
                return root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
            } catch {
                return null;
            }
        };

        // ---- Current section ------------------------------------------
        const links = [
            ...root.querySelectorAll<HTMLAnchorElement>(
                "[data-contents] a[href^='#']",
            ),
        ];
        const ids = [
            ...new Set(links.map((link) => link.hash.slice(1))),
        ].filter(Boolean);
        const headings = ids
            .map((id) => find(decodeURIComponent(id)))
            .filter((heading): heading is HTMLElement => heading !== null);

        let current = "";
        const mark = () => {
            const line = window.innerHeight * 0.3;
            let next = "";
            for (const heading of headings) {
                if (heading.getBoundingClientRect().top <= line) {
                    next = heading.id;
                } else break;
            }
            if (next === current) return;
            current = next;
            for (const link of links) {
                if (next && decodeURIComponent(link.hash.slice(1)) === next) {
                    link.setAttribute("aria-current", "location");
                } else {
                    link.removeAttribute("aria-current");
                }
            }
        };

        let frame = 0;
        const schedule = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                mark();
            });
        };
        const observer = new IntersectionObserver(schedule, {
            rootMargin: "-30% 0px -69% 0px",
        });
        headings.forEach((heading) => observer.observe(heading));
        window.addEventListener("scrollend", schedule);
        window.addEventListener("resize", schedule);
        mark();

        // ---- In-page links resolve inside this entry --------------------
        const onClick = (event: MouseEvent) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }
            const link = (event.target as Element | null)?.closest?.(
                "a[href^='#']",
            );
            if (!(link instanceof HTMLAnchorElement) || !root.contains(link)) {
                return;
            }
            const id = decodeURIComponent(link.hash.slice(1));
            const target = id ? find(id) : null;
            if (!target) return;
            event.preventDefault();
            const box = link.closest<HTMLDetailsElement>("[data-entry-box]");
            if (box) box.open = false;
            target.scrollIntoView({ block: "start" });
            if (window.location.hash !== `#${id}`) {
                window.history.pushState(null, "", `#${id}`);
            }
            // A keyboard activation moves focus too, as a fragment link
            // would move the sequential focus point.
            if (event.detail === 0) {
                if (!target.hasAttribute("tabindex")) {
                    target.setAttribute("tabindex", "-1");
                }
                target.focus({ preventScroll: true });
            }
            schedule();
        };
        root.addEventListener("click", onClick);

        return () => {
            observer.disconnect();
            window.removeEventListener("scrollend", schedule);
            window.removeEventListener("resize", schedule);
            if (frame) window.cancelAnimationFrame(frame);
            root.removeEventListener("click", onClick);
        };
    }, []);

    return <span ref={marker} hidden />;
}
