"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OpenToItems } from "@/components/ui/availability";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LinkArrow, Status } from "@/components/ui/marks";
import { trajectoryCopy as copy } from "@/lib/copy";
import {
    buildRoute,
    frameAt,
    missionDate,
    type Frame,
    type Route,
    type RouteOptions,
    type TrajectoryData,
} from "@/lib/trajectory";
import styles from "./journey.module.css";

/**
 * The flight through the timeline: a tall section whose stage sticks under
 * the header while the page scrolls past it, the way Apple's product pages
 * pin a scene and scrub it. Nothing intercepts the wheel: native scroll
 * moves the page, and the scroll position inside the section becomes the
 * route's progress. The record beside the scene (the card and the
 * chapters) is plain HTML and changes as the progress crosses chapters;
 * under the card's title one small line reads the date, ticking, and the
 * phase ("May 2024 · Transfer").
 *
 * - **Play** scrolls the page itself at a steady pace; any wheel, touch,
 *   key or click (other than Play's own press), or a scroll it didn't make,
 *   takes over again.
 * - **The chapters** jump to a chapter (a smooth scroll).
 * - **Still** (reduced motion, or the site's Pause motion): nothing pins;
 *   the scene holds one frame and the chapters pick it. It opens on the
 *   whole system (the route's end) with the latest chapter's card; the
 *   ask stays the rail's last stop. Each card shows its dates as written
 *   in the readout's place, each part kept whole, so on a phone
 *   "Expected 2028" takes a line of its own beside Full entry.
 * - **Inactive** (`active` false: the page shows its list instead) nothing
 *   is built or listened to; without JavaScript the page never shows it.
 * - **Full entry** goes to the chapter's row in the CV (`onEntry`, else
 *   the link itself).
 * - **Screen readers** hear the chapter when it changes (a polite live
 *   region), and focus in a card that leaves moves to its rail button.
 *
 * The scene is the renderer's (`createScene`): it gets the route and
 * draws a frame; the record is HTML. Its `poster`, if any, is rendered on
 * the server inside the scene's host, so a still frame shows from the
 * first paint until the scene draws.
 */

export interface Scene {
    /** The stage's size in CSS pixels; `wide` from 960px. */
    resize(width: number, height: number, wide: boolean): void;
    render(frame: Frame): void;
    /** The theme changed: re-read colours. */
    theme?(): void;
    dispose(): void;
}

export type CreateScene = (
    host: HTMLElement,
    data: TrajectoryData,
    route: Route,
) => Scene;

/** A renderer's pacing: its route's weights, how fast Play runs through a
 *  transfer (relative to the rest), and Play's whole run in milliseconds.
 *  Keep it at module scope, so it has a stable identity. */
export interface Pacing {
    route?: RouteOptions;
    transferRate?: number;
    duration?: number;
}

/** Scroll per unit of route weight, in svh. */
const UNIT = 52;
/** Play's pace: the whole route, in milliseconds, and how much faster it
 *  runs through a transfer. */
const DURATION = 26000;
const TRANSFER_RATE = 1.7;
const REDUCE = "(prefers-reduced-motion: reduce)";

/** Spatial motion runs only under html[data-motion="full"] and no OS
 *  reduce-motion setting (the boot script, lib/theme-boot.ts). */
export function motionAllowed(): boolean {
    return (
        document.documentElement.dataset.motion === "full" &&
        !window.matchMedia(REDUCE).matches
    );
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Quiet time before the live region names the chapter on show, so a
 *  scrub across several chapters is one announcement, not a list. */
const ANNOUNCE_MS = 700;

interface Controls {
    toggle(): void;
    go(card: number): void;
}

export default function Journey({
    data,
    createScene,
    figure,
    className,
    pacing,
    poster,
    active = true,
    onEntry,
}: {
    data: TrajectoryData;
    createScene: CreateScene;
    figure?: React.ReactNode;
    className?: string;
    pacing?: Pacing;
    poster?: React.ReactNode;
    /** False while the page shows something else in its place. */
    active?: boolean;
    /** A card's Full entry, given its href, in place of the link. */
    onEntry?: (href: string) => void;
}) {
    const routeOptions = pacing?.route;
    const transferRate = pacing?.transferRate ?? TRANSFER_RATE;
    const duration = pacing?.duration ?? DURATION;
    const route = useMemo(
        () => buildRoute(data, routeOptions),
        [data, routeOptions],
    );
    const section = useRef<HTMLElement>(null);
    const controls = useRef<Controls | null>(null);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        const root = section.current;
        if (!active || !root) return;
        const stage = root.querySelector<HTMLElement>("[data-stage]")!;
        const host = root.querySelector<HTMLElement>("[data-scene]")!;
        const liveEl = root.querySelector<HTMLElement>("[data-announce]")!;
        const cards = [...root.querySelectorAll<HTMLElement>("[data-card]")];
        const rail = [...root.querySelectorAll<HTMLElement>("[data-go]")];
        // Each chapter card's readout (the plan card has none).
        const stamps = cards.map((card) =>
            card.querySelector<HTMLElement>("[data-stamp]"),
        );
        const scene = createScene(host, data, route);
        const reduce = window.matchMedia(REDUCE);

        let moving = motionAllowed();
        // A still flight opens on the whole system (the route's end) with
        // the latest chapter's card, until a chapter is picked.
        let still = 1;
        let stillCard: number | null =
            data.chapters.length > 0 ? data.chapters.length - 1 : null;
        let lastCard = -1;
        /** The card the live region last named (the first is not said). */
        let spoken = -1;
        let speak = 0;
        let top = 0;
        let span = 1;
        let queued = 0;
        let auto: { last: number; y: number; raf: number } | null = null;

        const measure = () => {
            // The stage sticks under the header: the pin starts when the
            // section's top reaches it, not the viewport's top.
            const box = root.getBoundingClientRect();
            const pin = parseFloat(getComputedStyle(stage).top) || 0;
            top = box.top + window.scrollY - pin;
            span = Math.max(1, root.offsetHeight - stage.offsetHeight);
        };
        const progress = () =>
            moving ? clamp((window.scrollY - top) / span) : still;
        const phaseOf = (f: Frame) => {
            const kind = f.segment.kind;
            if (kind === "plan") return "";
            if (kind === "transfer")
                return (
                    data.chapters[f.segment.chapter]?.burn ??
                    copy.phases.transfer
                );
            return copy.phases[kind];
        };
        /** "May 2024 · Transfer": the mission date and the phase. The plan
         *  leg is not dated (nothing is scheduled), and its card has no
         *  readout. */
        const readout = (f: Frame) =>
            [missionDate(f.t, data, f), phaseOf(f)].filter(Boolean).join(" · ");
        /** "Title, Organization, dates", or "Open to: …" for the plan. */
        const said = (card: number) => {
            const c = data.chapters[card];
            if (c)
                return [c.title, c.organization, c.dates]
                    .filter(Boolean)
                    .join(", ");
            return data.planned
                ? `${copy.openTo}: ${data.planned.lines.join(", ")}`
                : "";
        };
        const announce = () => {
            speak = 0;
            if (lastCard === spoken) return;
            spoken = lastCard;
            liveEl.textContent = said(lastCard);
        };
        const draw = () => {
            queued = 0;
            const at = frameAt(route, progress());
            const f =
                !moving && stillCard !== null ? { ...at, card: stillCard } : at;
            // In flight the card's readout ticks; a still card shows its
            // dates as written in its place (the CSS).
            const stamp = stamps[f.card];
            if (stamp && moving) stamp.textContent = readout(f);
            if (f.card !== lastCard) {
                // Focus in the card that leaves would fall to <body> when the
                // card hides: hand it to the new chapter's rail button.
                const held = document.activeElement;
                if (
                    held instanceof HTMLElement &&
                    cards[lastCard]?.contains(held)
                )
                    rail[f.card]?.focus({ preventScroll: true });
                // A card that leaves fades out, but is out of the Tab order
                // (and the accessibility tree) at once.
                cards.forEach((card, i) => {
                    if (i === f.card) card.dataset.on = "";
                    else delete card.dataset.on;
                    card.inert = i !== f.card;
                });
                rail.forEach((button, i) => {
                    if (i < f.card) button.dataset.past = "";
                    else delete button.dataset.past;
                    if (i === f.card)
                        button.setAttribute("aria-current", "step");
                    else button.removeAttribute("aria-current");
                });
                lastCard = f.card;
                if (spoken < 0) spoken = f.card;
                else {
                    clearTimeout(speak);
                    speak = window.setTimeout(announce, ANNOUNCE_MS);
                }
            }
            // Still mode's frame is picked here, not on the server: until
            // now its record is held back (the CSS), so nothing swaps.
            if (root.dataset.ready === undefined) root.dataset.ready = "";
            scene.render(f);
        };
        const request = () => {
            if (!queued) queued = requestAnimationFrame(draw);
        };
        const resize = () => {
            const box = stage.getBoundingClientRect();
            scene.resize(box.width, box.height, box.width >= 960);
            measure();
            request();
        };

        const stop = () => {
            if (!auto) return;
            cancelAnimationFrame(auto.raf);
            auto = null;
            setPlaying(false);
        };
        const step = (now: number) => {
            if (!auto) return;
            // Someone else moved the page (keys, the scrollbar, find in
            // page): yield to them rather than snap back.
            if (Math.abs(window.scrollY - auto.y) > 2) return stop();
            const dt = Math.min(64, now - auto.last);
            auto.last = now;
            const kind = frameAt(route, progress()).segment.kind;
            const before = window.scrollY < top - 1;
            const rate =
                (span / duration) *
                (before ? 2.4 : kind === "transfer" ? transferRate : 1);
            auto.y = Math.min(top + span, auto.y + rate * dt);
            window.scrollTo({ top: auto.y, behavior: "instant" });
            if (auto.y >= top + span) return stop();
            auto.raf = requestAnimationFrame(step);
        };
        const play = () => {
            if (!moving) return;
            measure();
            if (window.scrollY >= top + span - 2)
                window.scrollTo({ top, behavior: "instant" });
            auto = {
                last: performance.now(),
                y: window.scrollY,
                raf: requestAnimationFrame(step),
            };
            setPlaying(true);
        };
        controls.current = {
            toggle: () => (auto ? stop() : play()),
            go: (card) => {
                const at = route.rest[card] ?? 1;
                if (!moving) {
                    still = at;
                    stillCard = null;
                    lastCard = -1;
                    request();
                    return;
                }
                stop();
                measure();
                window.scrollTo({ top: top + at * span, behavior: "smooth" });
            },
        };

        // Any input takes over from Play except Play's own press (a pointer
        // or touch on it, or Enter or Space while it has focus): that press
        // toggles it. Other keys stop it wherever the focus is.
        const takeOver = (event: Event) => {
            if (!auto) return;
            const onPlay =
                event.target instanceof Element &&
                event.target.closest("[data-play]");
            const press =
                event.type === "pointerdown" ||
                event.type === "touchstart" ||
                (event instanceof KeyboardEvent &&
                    (event.key === "Enter" || event.key === " "));
            if (!(onPlay && press)) stop();
        };
        const mode = () => {
            moving = motionAllowed();
            if (!moving) stop();
            lastCard = -1;
            resize();
        };
        // Re-read colours once the theme attribute has actually changed:
        // under a view transition the swap lands after "themechange".
        const retheme = () => {
            scene.theme?.();
            request();
        };
        const themeWatch = new MutationObserver(retheme);
        themeWatch.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        const inputs = ["wheel", "touchstart", "keydown", "pointerdown"];
        inputs.forEach((type) =>
            window.addEventListener(type, takeOver, { passive: true }),
        );
        window.addEventListener("scroll", request, { passive: true });
        window.addEventListener("resize", resize);
        document.addEventListener("motionchange", mode);
        reduce.addEventListener("change", mode);
        mode();
        document.fonts?.ready.then(resize);

        return () => {
            stop();
            cancelAnimationFrame(queued);
            clearTimeout(speak);
            inputs.forEach((type) =>
                window.removeEventListener(type, takeOver),
            );
            window.removeEventListener("scroll", request);
            window.removeEventListener("resize", resize);
            document.removeEventListener("motionchange", mode);
            themeWatch.disconnect();
            reduce.removeEventListener("change", mode);
            controls.current = null;
            scene.dispose();
        };
    }, [active, data, route, createScene, transferRate, duration]);

    return (
        <section
            ref={section}
            className={
                className ? `${styles.journey} ${className}` : styles.journey
            }
            style={
                {
                    "--len": Math.round(route.weight * UNIT),
                } as React.CSSProperties
            }
            aria-labelledby="journey-h"
            data-journey
        >
            <h2 className="sr-only" id="journey-h">
                {copy.heading}
            </h2>
            <div className={styles.stage} data-stage>
                <div className={styles.scene} data-scene aria-hidden="true">
                    {poster}
                </div>
                <div className={styles.panel}>
                    <div className={`shell ${styles.grid}`}>
                        <div className={styles.inner} data-record>
                            <div className={styles.cards}>
                                {data.chapters.map((chapter, i) => (
                                    <article
                                        key={chapter.id}
                                        className={styles.card}
                                        data-card={i}
                                        data-on={i === 0 ? "" : undefined}
                                    >
                                        <h3 className={styles.title}>
                                            {chapter.title}
                                        </h3>
                                        <p className={styles.stamp}>
                                            {/* The dates as written, each
                                                part kept whole: a still
                                                card's. */}
                                            <span
                                                className={`data open-to ${styles.written}`}
                                            >
                                                <OpenToItems
                                                    text={[
                                                        chapter.dates,
                                                        chapter.expected,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" · ")}
                                                />
                                            </span>
                                            {/* In flight, the readout that
                                                ticks in their place; it holds
                                                the dates' line until then. */}
                                            <span
                                                className={`data ${styles.readout}`}
                                                data-stamp
                                            >
                                                {chapter.dates}
                                            </span>
                                            {chapter.current ? (
                                                <Status value="active">
                                                    {copy.current}
                                                </Status>
                                            ) : null}
                                        </p>
                                        <p className={styles.org}>
                                            {chapter.organization}
                                        </p>
                                        {chapter.note ? (
                                            <p className={styles.note}>
                                                {chapter.note}
                                            </p>
                                        ) : null}
                                        {chapter.line ? (
                                            <p className={styles.line}>
                                                {chapter.line}
                                            </p>
                                        ) : null}
                                        <div className={styles.act}>
                                            <LinkArrow
                                                className={styles.entry}
                                                href={chapter.href}
                                                prefetch={false}
                                                onNavigate={
                                                    onEntry
                                                        ? (event) => {
                                                              event.preventDefault();
                                                              onEntry(
                                                                  chapter.href,
                                                              );
                                                          }
                                                        : undefined
                                                }
                                            >
                                                {copy.entry}
                                            </LinkArrow>
                                        </div>
                                    </article>
                                ))}
                                {data.planned ? (
                                    <article
                                        className={styles.card}
                                        data-card={data.chapters.length}
                                    >
                                        {/* What comes next, as a fact:
                                            the profile's button follows
                                            the stage (the page). */}
                                        <h3 className={styles.title}>
                                            {copy.openTo}
                                        </h3>
                                        <p className={`${styles.org} open-to`}>
                                            <OpenToItems
                                                text={data.planned.lines.join(
                                                    " · ",
                                                )}
                                            />
                                        </p>
                                        <div className={styles.act}>
                                            <LinkArrow
                                                href={data.planned.href}
                                                prefetch={false}
                                            >
                                                {copy.contact}
                                            </LinkArrow>
                                        </div>
                                    </article>
                                ) : null}
                            </div>

                            <div className={styles.controls}>
                                <ol
                                    className={styles.rail}
                                    aria-label={copy.rail}
                                >
                                    {data.chapters.map((chapter, i) => (
                                        <li key={chapter.id}>
                                            <button
                                                type="button"
                                                data-go={i}
                                                aria-current={
                                                    i === 0 ? "step" : undefined
                                                }
                                                onClick={() =>
                                                    controls.current?.go(i)
                                                }
                                            >
                                                <span className={styles.year}>
                                                    {chapter.year}
                                                </span>
                                                <span className={styles.name}>
                                                    {chapter.orgLabel}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                    {data.planned ? (
                                        <li>
                                            <button
                                                type="button"
                                                data-go={data.chapters.length}
                                                onClick={() =>
                                                    controls.current?.go(
                                                        data.chapters.length,
                                                    )
                                                }
                                            >
                                                <span className={styles.year}>
                                                    {copy.future}
                                                </span>
                                                <span className="sr-only">
                                                    {` ${data.planned.lines[0]}`}
                                                </span>
                                            </button>
                                        </li>
                                    ) : null}
                                </ol>
                                <button
                                    type="button"
                                    className={buttonClass({
                                        size: "sm",
                                        className: styles.play,
                                    })}
                                    data-play
                                    onClick={() => controls.current?.toggle()}
                                >
                                    <Icon name={playing ? "pause" : "play"} />
                                    {playing ? copy.pause : copy.play}
                                </button>
                            </div>
                            <p
                                className="sr-only"
                                aria-live="polite"
                                data-announce
                            />
                        </div>
                        {figure ? (
                            <p className={styles.figure}>{figure}</p>
                        ) : null}
                    </div>
                </div>
            </div>
        </section>
    );
}
