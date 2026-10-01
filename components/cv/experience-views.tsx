"use client";

import { useEffect, useSyncExternalStore } from "react";
import { motionAllowed } from "@/components/trajectory/journey";
import TrajectoryView from "@/components/trajectory/trajectory-view";
import { LinkArrow } from "@/components/ui/marks";
import Segmented from "@/components/ui/segmented";
import { cvCopy, trajectoryCopy } from "@/lib/copy";
import type { TrajectoryData } from "@/lib/trajectory";
import styles from "./experience-views.module.css";

type View = "timeline" | "list";

/** The list's id: Skip to the list and The full record land on it. */
const LIST = "cv";

/*
 * The view for the visit, in memory only: undefined until the page first
 * runs on the client, so the server's HTML and the first paint take the
 * CSS's default (experience-views.module.css). A client navigation back
 * to the page keeps the visitor's last choice.
 */
let view: View | undefined;
/** The view the flight follows: `view`, once the switch has painted, so
 *  a click shows at once and the scene is built or taken down after. */
let flown: View | undefined;
const listeners = new Set<() => void>();

const getView = () => view;
const getFlown = () => flown;
const noView = () => undefined;

function subscribe(callback: () => void) {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
}

function notify() {
    listeners.forEach((callback) => callback());
}

function setView(next: View) {
    if (next === view) return;
    view = next;
    notify();
    requestAnimationFrame(() =>
        setTimeout(() => {
            if (flown === view) return;
            flown = view;
            notify();
        }),
    );
}

/** Shows the list and moves to `id` (a row, else the list's top), with
 *  focus, so a keyboard carries on from there. */
function showList(id = LIST) {
    setView("list");
    requestAnimationFrame(() => {
        const target = document.getElementById(id);
        if (!target) return;
        if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "start" });
    });
}

/** The CSS's default, pinned once the page has rendered: the list when
 *  the address names a part of it (a Full entry opened in a new tab, an
 *  old /portfolio fragment) or motion is off, else the flight. */
function pin() {
    if (view) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (target?.closest(`#${LIST}`)) showList(id);
    else setView(motionAllowed() ? "timeline" : "list");
}

/**
 * Experience's two views (components/cv/): Timeline, the flight
 * (components/trajectory/), and List, the CV the page renders as
 * `children`, under a Timeline · List switch. The default is decided in
 * CSS before the first paint from the attributes the boot script sets:
 * the flight where motion runs, the list otherwise (and without
 * JavaScript, on paper and for a crawler: the CV is always in the HTML).
 * A click switches views for the visit; under reduced motion the flight
 * is its still. The flight's scene is built only while it is the view.
 */
export default function ExperienceViews({
    data,
    children,
}: {
    data: TrajectoryData;
    children: React.ReactNode;
}) {
    const current = useSyncExternalStore(subscribe, getView, noView);
    const flight = useSyncExternalStore(subscribe, getFlown, noView);
    useEffect(() => pin(), []);
    const toList = (event: { preventDefault(): void }) => {
        event.preventDefault();
        showList();
    };
    return (
        <div className={styles.views} data-view={current}>
            <div className={`shell ${styles.bar}`} data-print="hide">
                <Segmented
                    className={`js-only ${styles.switch}`}
                    legend={cvCopy.views.legend}
                    name="cv-view"
                    options={cvCopy.views.options}
                    value={current ?? ""}
                    onChange={(value) => setView(value as View)}
                />
                {/* For a keyboard: past the flight's stops to the list,
                    shown on focus. */}
                {current === "timeline" ? (
                    <LinkArrow
                        className={styles.skip}
                        href={`#${LIST}`}
                        prefetch={false}
                        onNavigate={toList}
                    >
                        {trajectoryCopy.skip}
                    </LinkArrow>
                ) : null}
            </div>
            <div className={styles.timeline} data-print="hide">
                <TrajectoryView
                    data={data}
                    active={flight === "timeline"}
                    onEntry={(href) =>
                        showList(href.slice(href.indexOf("#") + 1))
                    }
                />
                {/* After the flight, the way to the list. The ask is the
                    Future card's Contact (and the head's). */}
                <div className={`shell ${styles.close}`}>
                    <LinkArrow
                        href={`#${LIST}`}
                        prefetch={false}
                        onNavigate={toList}
                    >
                        {trajectoryCopy.close}
                    </LinkArrow>
                </div>
            </div>
            <div className={styles.list} id={LIST} tabIndex={-1}>
                {children}
            </div>
        </div>
    );
}
