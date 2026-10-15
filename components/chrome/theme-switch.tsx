"use client";

import { useEffect, useId, useRef, useState } from "react";
import ThemeChoice from "@/components/chrome/theme-choice";
import { Icon } from "@/components/ui/icon";
import { chromeCopy } from "@/lib/copy";

/**
 * The header's theme control from 960px (contract §6): one 44px button
 * that opens a small popover holding `ThemeChoice` (Dark · Light ·
 * System), so a desktop visitor can always return to System; below 960px
 * the menu sheet carries the choice instead and this control is hidden.
 * The button is a disclosure (`aria-expanded`, `aria-controls`); the
 * popover is the choice's labelled radio group. A click on an option
 * picks it, closes the popover and returns focus to the button, as do a
 * click outside (without moving focus) and Escape. From the keyboard the
 * arrows move through the options without closing it, and Tab leaves it
 * closed. Hidden without JavaScript, like every theme control.
 */
export default function ThemeSwitch() {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    // Whether the last input in the popover was a pointer: a click picks
    // and closes, an arrow key only picks.
    const pointer = useRef(false);
    const popoverId = useId();

    useEffect(() => {
        const root = rootRef.current;
        const button = buttonRef.current;
        if (!open || !root || !button) return;
        const radios = [
            ...root.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
        ];
        (radios.find((radio) => radio.checked) ?? radios[0])?.focus({
            preventScroll: true,
        });
        const onPointerDown = (event: PointerEvent) => {
            if (!root.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setOpen(false);
            button.focus({ preventScroll: true });
        };
        const onFocusOut = (event: FocusEvent) => {
            const next = event.relatedTarget;
            if (next instanceof Node && !root.contains(next)) setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        root.addEventListener("focusout", onFocusOut);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
            root.removeEventListener("focusout", onFocusOut);
        };
    }, [open]);

    return (
        <div className="theme-switch" ref={rootRef}>
            <button
                ref={buttonRef}
                type="button"
                className="theme-switch__button"
                title={chromeCopy.themeLegend}
                aria-expanded={open}
                aria-controls={open ? popoverId : undefined}
                onClick={() => setOpen(!open)}
            >
                <Icon name="theme" />
                <span className="sr-only">{chromeCopy.themeLegend}</span>
            </button>
            {open ? (
                <div
                    className="theme-switch__popover"
                    id={popoverId}
                    onPointerDown={() => {
                        pointer.current = true;
                    }}
                    onKeyDown={() => {
                        pointer.current = false;
                    }}
                    onClick={(event) => {
                        if (
                            !pointer.current ||
                            !(event.target instanceof HTMLInputElement)
                        ) {
                            return;
                        }
                        setOpen(false);
                        buttonRef.current?.focus({ preventScroll: true });
                    }}
                >
                    <ThemeChoice />
                </div>
            ) : null}
        </div>
    );
}
