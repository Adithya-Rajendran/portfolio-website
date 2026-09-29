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
 *   key or click takes over again.
 * - **The chapters** jump to a chapter (a smooth scroll).
 * - **Still** (reduced motion, or the site's Pause motion): nothing pins;
 *   the scene holds one frame and the chapters pick it.
 * - **Without JavaScript** the chapters are a list and no scene is drawn.
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

/** Scroll per unit of route weight, in svh. */
const UNIT = 52;
/** Play's pace: the whole route, in milliseconds. */
const DURATION = 26000;
const REDUCE = "(prefers-reduced-motion: reduce)";

function motionAllowed(): boolean {
    return (
        document.documentElement.dataset.motion === "full" &&
        !window.matchMedia(REDUCE).matches
    );
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

interface Controls {
    toggle(): void;
    go(card: number): void;
}

export default function Journey({
    data,
    createScene,
    figure,
    className,
}: {
    data: TrajectoryData;
    createScene: CreateScene;
    figure?: string;
    className?: string;
}) {
    const route = useMemo(() => buildRoute(data), [data]);
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
        const cards = [...root.querySelectorAll<HTMLElement>("[data-card]")];
        const rail = [...root.querySelectorAll<HTMLElement>("[data-go]")];
        const scene = createScene(host, data, route);
        const reduce = window.matchMedia(REDUCE);

        let moving = motionAllowed();
        let still = 1;
        let lastCard = -1;
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
            if (kind === "transfer")
                return (
                    data.chapters[f.segment.chapter]?.burn ??
                    copy.phases.transfer
                );
            return copy.phases[kind];
        };
        const draw = () => {
            queued = 0;
            const f = frameAt(route, progress());
            dateEl.textContent = missionDate(f.t, data, f);
            phaseEl.textContent = phaseOf(f);
            if (f.card !== lastCard) {
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
            }
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
            const dt = Math.min(64, now - auto.last);
            auto.last = now;
            const kind = frameAt(route, progress()).segment.kind;
            const before = window.scrollY < top - 1;
            const rate =
                (span / DURATION) *
                (before ? 2.4 : kind === "transfer" ? 1.7 : 1);
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

        const takeOver = (event: Event) => {
            if (
                auto &&
                !(
                    event.target instanceof Element &&
                    event.target.closest("[data-play]")
                )
            )
                stop();
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
    }, [data, route, createScene]);

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
                                        <LinkArrow
                                            className={styles.entry}
                                            href={chapter.href}
                                            prefetch={false}
                                        >
                                            {copy.entry}
                                        </LinkArrow>
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
                                        <a
                                            className={buttonClass({
                                                variant: "primary",
                                                size: "sm",
                                                className: styles.cta,
                                            })}
                                            href={data.planned.href}
                                        >
                                            {data.planned.cta ?? copy.contact}
                                            <Icon
                                                name="arrow"
                                                className="icon--nudge"
                                            />
                                        </a>
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
                                    aria-pressed={playing}
                                    onClick={() => controls.current?.toggle()}
                                >
                                    <Icon name={playing ? "pause" : "play"} />
                                    {playing ? copy.pause : copy.play}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                {figure ? <p className={styles.figure}>{figure}</p> : null}
            </div>
        </section>
    );
}
