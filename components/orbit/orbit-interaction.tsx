"use client";

import { useEffect, useRef } from "react";
import { orbitCopy as copy } from "@/lib/copy";

/**
 * The Trajectory page's one behaviour island (plan §2.4, ≤ 6 KB): event
 * delegation over the server-drawn orbit map, its record panel and the CV
 * list. It renders nothing and keeps its state in the page's attributes.
 *
 * - **Hover or focus** an orbit or its label: the panel previews its
 *   record and the orbit and its CV row light up.
 * - **Click** an orbit or its label to pin its record (again, on empty
 *   sky, or Escape to release). Earlier and Later step through them.
 * - **A CV row** lights its orbit while the pointer is over it; its "Show
 *   on map" pins the orbit and brings the map into view.
 * - **The view switch** (List | Map) shows the map above the CV or hides
 *   it; the list is the default, and `#orbit-map` in the address opens
 *   the map.
 *
 * Lookups stay inside this page's root: Cache Components keeps other
 * visited pages mounted but hidden, and they can hold the same ids. When
 * the page is hidden the listeners go, and a preview is cleared.
 */

type Id = string | null;

function motionAllowed(): boolean {
    return (
        document.documentElement.dataset.motion === "full" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

export default function OrbitInteraction() {
    const marker = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const root = marker.current?.closest<HTMLElement>("[data-page]");
        const map = root?.querySelector<HTMLElement>("[data-orbit-map]");
        if (!root) return;
        const panel = root.querySelector<HTMLElement>("[data-orbit-panel]");
        const live = root.querySelector<HTMLElement>("[data-orbit-live]");
        const fallback = map?.dataset.orbitDefault ?? null;
        const records = [
            ...root.querySelectorAll<HTMLElement>("[data-orbit-record]"),
        ];
        const order = records.map((record) => record.dataset.orbitRecord!);
        const state: { pinned: Id; preview: Id; row: Id } = {
            pinned: null,
            preview: null,
            row: null,
        };

        const all = (selector: string) => [
            ...root.querySelectorAll<HTMLElement>(selector),
        ];
        const byId = (id: string) => all(`[data-orbit-id="${CSS.escape(id)}"]`);

        function sync() {
            const lit = state.row ?? state.preview ?? state.pinned;
            for (const element of all("[data-hl]")) {
                element.removeAttribute("data-hl");
            }
            if (lit) {
                for (const element of [
                    ...byId(lit),
                    ...all(`[data-orbit-row="${CSS.escape(lit)}"]`),
                ]) {
                    element.setAttribute("data-hl", "");
                }
            }
            for (const button of all("button[data-orbit-id]")) {
                button.setAttribute(
                    "aria-pressed",
                    String(button.dataset.orbitId === state.pinned),
                );
            }
            const shown = state.preview ?? state.pinned ?? fallback;
            for (const record of records) {
                record.toggleAttribute(
                    "data-shown",
                    record.dataset.orbitRecord === shown,
                );
            }
            panel?.setAttribute(
                "data-state",
                state.preview && state.preview !== state.pinned
                    ? "preview"
                    : state.pinned
                      ? "pinned"
                      : "current",
            );
        }

        function announce() {
            if (!live) return;
            const shown = state.pinned ?? fallback;
            const title = records
                .find((record) => record.dataset.orbitRecord === shown)
                ?.querySelector("h3")?.textContent;
            live.textContent = title
                ? `${state.pinned ? copy.pinned : copy.showing}: ${title}`
                : "";
        }

        function pin(id: Id, toggle = true) {
            state.pinned = toggle && state.pinned === id ? null : id;
            state.preview = null;
            sync();
            announce();
        }

        /** Scroll to an element of this page, and name it in the address. */
        function reveal(target: Element | null | undefined, hash?: string) {
            if (!target) return;
            target.scrollIntoView({
                behavior: motionAllowed() ? "smooth" : "auto",
                block: "start",
            });
            if (hash) window.history.replaceState(null, "", `#${hash}`);
        }

        const idOf = (target: EventTarget | null, selector: string) =>
            (target as Element | null)?.closest?.<HTMLElement>(selector) ??
            null;

        function onOver(event: PointerEvent) {
            const orbit = idOf(event.target, "[data-orbit-id]");
            if (orbit && map?.contains(orbit)) {
                const id = orbit.dataset.orbitId!;
                if (state.preview !== id) {
                    state.preview = id;
                    sync();
                }
                return;
            }
            const row = idOf(event.target, "[data-orbit-row]");
            const id = row?.dataset.orbitRow ?? null;
            if (row && state.row !== id) {
                state.row = id;
                sync();
            }
        }

        function onOut(event: PointerEvent) {
            const next = event.relatedTarget as Element | null;
            const orbit = idOf(event.target, "[data-orbit-id]");
            if (orbit && map?.contains(orbit)) {
                if (!next?.closest?.("[data-orbit-id]") && state.preview) {
                    state.preview = null;
                    sync();
                }
                return;
            }
            const row = idOf(event.target, "[data-orbit-row]");
            if (row && !row.contains(next) && state.row) {
                state.row = null;
                sync();
            }
        }

        function onClick(event: MouseEvent) {
            if (event.defaultPrevented || event.button !== 0) return;
            const target = event.target as Element;

            const step = target.closest<HTMLElement>("[data-orbit-step]");
            if (step) {
                const shown = state.pinned ?? fallback;
                const next =
                    order[
                        order.indexOf(shown ?? "") +
                            Number(step.dataset.orbitStep)
                    ];
                if (next) {
                    pin(next, false);
                    // From the keyboard, keep focus in the panel.
                    if (event.detail === 0) {
                        const record = records.find(
                            (item) => item.dataset.orbitRecord === next,
                        );
                        const enabled = "[data-orbit-step]:not([disabled])";
                        (
                            record?.querySelector<HTMLElement>(
                                `[data-orbit-step="${step.dataset.orbitStep}"]:not([disabled])`,
                            ) ?? record?.querySelector<HTMLElement>(enabled)
                        )?.focus();
                    }
                }
                return;
            }

            const show = target.closest<HTMLElement>("[data-orbit-show]");
            if (show) {
                const id = show.dataset.orbitShow!;
                setView("map");
                pin(id, false);
                reveal(map);
                const button = byId(id).find(
                    (element) =>
                        element.tagName === "BUTTON" &&
                        element.offsetParent !== null,
                );
                button?.focus({ preventScroll: true });
                return;
            }

            const to = target.closest<HTMLAnchorElement>("a[data-orbit-to]");
            if (
                to &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
            ) {
                const id = to.dataset.orbitTo!;
                const row = root!.querySelector(`#${CSS.escape(id)}`);
                if (row) {
                    event.preventDefault();
                    reveal(row, id);
                }
                return;
            }

            const orbit = target.closest<HTMLElement>("[data-orbit-id]");
            if (orbit && map?.contains(orbit)) {
                pin(orbit.dataset.orbitId!);
                // On a narrow screen the panel is under the map.
                if (state.pinned && panel && event.detail > 0) {
                    const box = panel.getBoundingClientRect();
                    if (box.top > window.innerHeight - 80) reveal(panel);
                }
                return;
            }
            if (state.pinned && target.closest("[data-orbit-plot]")) {
                pin(null);
            }
        }

        function onFocus(event: FocusEvent) {
            const orbit = idOf(event.target, "button[data-orbit-id]");
            if (orbit) {
                state.preview = orbit.dataset.orbitId!;
                sync();
            }
        }
        function onBlur(event: FocusEvent) {
            if (idOf(event.target, "button[data-orbit-id]") && state.preview) {
                state.preview = null;
                sync();
            }
        }
        function onKey(event: KeyboardEvent) {
            if (
                event.key === "Escape" &&
                state.pinned &&
                map?.contains(event.target as Node)
            ) {
                pin(null);
            }
        }

        function setView(view: string) {
            root!.dataset.view = view === "list" ? "list" : "map";
            for (const input of all('input[name="cv-view"]')) {
                (input as HTMLInputElement).checked =
                    (input as HTMLInputElement).value === root!.dataset.view;
            }
        }
        function onChange(event: Event) {
            const input = event.target as HTMLInputElement;
            if (input.name === "cv-view" && input.checked) setView(input.value);
        }
        // A link to the map (`/resume#orbit-map`) opens the Map view.
        const mapSection = root.querySelector<HTMLElement>("#orbit-map");
        function onHash() {
            if (window.location.hash !== "#orbit-map" || !mapSection) return;
            if (root!.offsetParent === null) return;
            setView("map");
            reveal(mapSection);
        }
        onHash();
        window.addEventListener("hashchange", onHash);

        root.addEventListener("pointerover", onOver);
        root.addEventListener("pointerout", onOut);
        root.addEventListener("click", onClick);
        root.addEventListener("focusin", onFocus);
        root.addEventListener("focusout", onBlur);
        root.addEventListener("keydown", onKey);
        root.addEventListener("change", onChange);
        return () => {
            root.removeEventListener("pointerover", onOver);
            root.removeEventListener("pointerout", onOut);
            root.removeEventListener("click", onClick);
            root.removeEventListener("focusin", onFocus);
            root.removeEventListener("focusout", onBlur);
            root.removeEventListener("keydown", onKey);
            root.removeEventListener("change", onChange);
            window.removeEventListener("hashchange", onHash);
            state.preview = null;
            state.row = null;
            sync();
        };
    }, []);

    return <span ref={marker} hidden />;
}
