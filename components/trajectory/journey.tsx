"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * route's progress. The record beside the scene (date, card, chapters) is
 * plain HTML and changes as the progress crosses chapters.
 *
 * - **Play** scrolls the page itself at a steady pace; any wheel, touch,
 *   key or click (other than Play's own press), or a scroll it didn't make,
 *   takes over again.
 * - **The chapters** jump to a chapter (a smooth scroll).
 * - **Still** (reduced motion, or the site's Pause motion): nothing pins;
 *   the scene holds one frame and the chapters pick it.
 * - **Without JavaScript** the chapters are a list and no scene is drawn.
 * - **Screen readers** hear the chapter when it changes (a polite live
 *   region), and focus in a card that leaves moves to its rail button.
 *
 * The scene is the renderer's (`createScene`): an SVG plot, a voyage, a 3D
 * flight. It gets the route and draws a frame; the record is shared.
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

function motionAllowed(): boolean {
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
}: {
    data: TrajectoryData;
    createScene: CreateScene;
    figure?: string;
    className?: string;
    pacing?: Pacing;
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
        if (!root) return;
        const stage = root.querySelector<HTMLElement>("[data-stage]")!;
        const host = root.querySelector<HTMLElement>("[data-scene]")!;
        const dateEl = root.querySelector<HTMLElement>("[data-date]")!;
        const phaseEl = root.querySelector<HTMLElement>("[data-phase]")!;
        const liveEl = root.querySelector<HTMLElement>("[data-announce]")!;
        const cards = [...root.querySelectorAll<HTMLElement>("[data-card]")];
        const rail = [...root.querySelectorAll<HTMLElement>("[data-go]")];
        const scene = createScene(host, data, route);
        const reduce = window.matchMedia(REDUCE);

        let moving = motionAllowed();
        let still = 1;
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
        // The plan leg is not dated: the owner is open to roles, nothing is
        // scheduled. Its readout is the rail's "Next".
        const dateOf = (f: Frame) =>
            f.segment.kind === "plan" ? copy.next : missionDate(f.t, data, f);
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
            const f = frameAt(route, progress());
            dateEl.textContent = dateOf(f);
            phaseEl.textContent = phaseOf(f);
            if (f.card !== lastCard) {
                // Focus in the card that leaves would fall to <body> when the
                // card hides: hand it to the new chapter's rail button.
                const held = document.activeElement;
                if (
                    held instanceof HTMLElement &&
                    cards[lastCard]?.contains(held)
                )
                    rail[f.card]?.focus({ preventScroll: true });
                cards.forEach((card, i) => {
                    if (i === f.card) card.dataset.on = "";
                    else delete card.dataset.on;
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
    }, [data, route, createScene, transferRate, duration]);

    const first = data.chapters[0];
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
                <div className={styles.scene} data-scene aria-hidden="true" />
                <div className={styles.panel}>
                    <div className={`shell ${styles.grid}`}>
                        <div className={styles.inner}>
                            <div className={styles.hud} aria-hidden="true">
                                <span className={styles.date} data-date>
                                    {first?.year}
                                </span>
                                <span
                                    className={`label ${styles.phase}`}
                                    data-phase
                                >
                                    {copy.phases.coast}
                                </span>
                            </div>

                            <div className={styles.cards}>
                                {data.chapters.map((chapter, i) => (
                                    <article
                                        key={chapter.id}
                                        className={styles.card}
                                        data-card={i}
                                        data-on={i === 0 ? "" : undefined}
                                    >
                                        <p className={styles.tagRow}>
                                            <span className="label">
                                                {chapter.label}
                                            </span>
                                            {chapter.current ? (
                                                <Status value="active">
                                                    {copy.current}
                                                </Status>
                                            ) : null}
                                        </p>
                                        <h3 className={styles.title}>
                                            {chapter.title}
                                        </h3>
                                        <p className={styles.org}>
                                            {chapter.organization}
                                        </p>
                                        {chapter.note ? (
                                            <p className={styles.note}>
                                                {chapter.note}
                                            </p>
                                        ) : null}
                                        {chapter.dates ? (
                                            <p
                                                className={`data ${styles.dates}`}
                                            >
                                                {chapter.dates}
                                                {chapter.expected
                                                    ? ` · ${chapter.expected}`
                                                    : null}
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
                                        <p className={styles.tagRow}>
                                            <span className="label">
                                                {copy.openTo}
                                            </span>
                                        </p>
                                        <h3 className={styles.title}>
                                            {data.planned.lines[0]}
                                        </h3>
                                        {data.planned.lines.length > 1 ? (
                                            <p className={styles.org}>
                                                {data.planned.lines
                                                    .slice(1)
                                                    .join(" · ")}
                                            </p>
                                        ) : null}
                                        <div className={styles.ask}>
                                            <a
                                                className={buttonClass({
                                                    variant: "primary",
                                                    size: "sm",
                                                })}
                                                href={data.planned.href}
                                            >
                                                {data.planned.cta ??
                                                    copy.contact}
                                                <Icon
                                                    name="arrow"
                                                    className="icon--nudge"
                                                />
                                            </a>
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
                                                    {copy.next}
                                                </span>
                                                <span className={styles.name}>
                                                    {copy.openTo}
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
