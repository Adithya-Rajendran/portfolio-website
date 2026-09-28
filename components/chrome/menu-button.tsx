"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { chromeCopy } from "@/lib/copy";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])';

/**
 * The Menu button below 960px. The sheet it opens is a native popover
 * (`popovertarget`), so it opens, closes and light-dismisses without
 * JavaScript. With it, this island adds what a dialog needs: the label
 * says Close while open, focus moves to the first link, the page behind
 * the sheet is inert and does not scroll, Tab stays inside the header,
 * choosing a link closes the sheet, and focus returns to the button.
 */
export default function MenuButton({ panelId }: { panelId: string }) {
    // null until the first toggle, so the server HTML claims no state.
    const [open, setOpen] = useState<boolean | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const button = buttonRef.current;
        const panel = document.getElementById(panelId);
        const header = button?.closest("header");
        if (!button || !panel || !header) return;
        if (typeof panel.showPopover !== "function") return;

        const isOpen = () => panel.matches(":popover-open");
        const hide = () => {
            if (isOpen()) panel.hidePopover();
        };
        const behind = () =>
            document.querySelectorAll<HTMLElement>(
                "main, .site-footer, .skip-link",
            );

        const onToggle = (event: Event) => {
            const opened = (event as ToggleEvent).newState === "open";
            setOpen(opened);
            behind().forEach((element) => {
                element.inert = opened;
            });
            document.documentElement.style.overflow = opened ? "hidden" : "";
            if (opened) {
                panel
                    .querySelector<HTMLElement>("a[href]")
                    ?.focus({ preventScroll: true });
            } else if (
                !document.activeElement ||
                document.activeElement === document.body ||
                panel.contains(document.activeElement)
            ) {
                button.focus({ preventScroll: true });
            }
        };
        const onClick = (event: MouseEvent) => {
            if ((event.target as Element | null)?.closest("a[href]")) hide();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Tab" || !isOpen()) return;
            const items = [
                ...header.querySelectorAll<HTMLElement>(FOCUSABLE),
            ].filter((element) => element.offsetParent !== null);
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        const onResize = () => {
            if (window.innerWidth >= 960) hide();
        };

        panel.addEventListener("toggle", onToggle);
        panel.addEventListener("click", onClick);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);
        return () => {
            panel.removeEventListener("toggle", onToggle);
            panel.removeEventListener("click", onClick);
            document.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onResize);
            hide();
        };
    }, [panelId]);

    return (
        <button
            ref={buttonRef}
            type="button"
            className="nav-toggle"
            popoverTarget={panelId}
            aria-controls={panelId}
            aria-expanded={open ?? undefined}
        >
            <Icon name={open ? "close" : "menu"} />
            <span>{open ? chromeCopy.close : chromeCopy.menu}</span>
        </button>
    );
}
