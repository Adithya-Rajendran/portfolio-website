import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Status } from "@/components/ui/marks";
import { orbitCopy as copy } from "@/lib/copy";
import type { CvEntry } from "@/lib/cv";
import {
    horizontalMap,
    verticalMap,
    type Fade,
    type LabelAnchor,
    type MapProjection,
    type OrbitModel,
} from "@/lib/orbit/geometry";
import styles from "./orbit.module.css";

/**
 * The time-scaled orbit map (G2), drawn on the server: one SVG per
 * projection (time runs right from 60rem, up on phones; CSS shows one),
 * with every word in HTML over it so type stays crisp however the plot
 * stretches. Each role or degree is an ink orbit across its dates; only
 * today and the arc flown on the current orbit are orange.
 *
 * The record panel sits beside the map (the entry shown by default is the
 * current one), over the caption and the key. Without JavaScript the
 * labels are links to the CV rows and the panel shows the current entry;
 * with it, `OrbitInteraction` previews on hover, pins on click and lights
 * the matching CV row. The SVGs are hidden from assistive technology: the
 * labels and the CV list carry the same record in text.
 */

export interface PlannedRecord {
    /** The availability line, as the owner wrote it. */
    text: string;
    href: string;
    /** The profile's button that answers it; no link without one. */
    cta: string | null;
}

const pct = (x: number, width: number) =>
    `${Math.round((x / width) * 10000) / 100}%`;

function FadeMask({
    id,
    fade,
    projection,
    horizontal,
}: {
    id: string;
    fade: Fade;
    projection: MapProjection;
    horizontal: boolean;
}) {
    const [from, to] = fade.dir === "in" ? ["0", "1"] : ["1", "0"];
    return (
        <>
            <linearGradient
                id={`${id}-g`}
                gradientUnits="userSpaceOnUse"
                x1={horizontal ? fade.a : 0}
                x2={horizontal ? fade.b : 0}
                y1={horizontal ? 0 : fade.a}
                y2={horizontal ? 0 : fade.b}
            >
                <stop offset="0" stopColor="#fff" stopOpacity={from} />
                <stop offset="1" stopColor="#fff" stopOpacity={to} />
            </linearGradient>
            <mask
                id={id}
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width={projection.width}
                height={projection.height}
            >
                <rect
                    width={projection.width}
                    height={projection.height}
                    fill={`url(#${id}-g)`}
                />
            </mask>
        </>
    );
}

function Node({
    entry,
    number,
    anchor,
    panelId,
    style,
    place,
}: {
    entry: {
        id: string;
        code: string;
        years: string | null;
        org: string;
        title: string;
    };
    number: number;
    anchor: string;
    panelId: string | null;
    style: React.CSSProperties;
    place: LabelAnchor["place"];
}) {
    const content = (
        <>
            <span className={styles.nodeLine}>
                <span className={styles.nodeCode}>{entry.code}</span>
                {entry.years ? (
                    <span className={styles.nodeYears}>{entry.years}</span>
                ) : null}
            </span>
            <span className={styles.nodeOrg}>{entry.org}</span>
            <span className="sr-only">, {entry.title}</span>
        </>
    );
    return (
        <li className={styles.nodeItem} style={style} data-place={place}>
            {panelId ? (
                <button
                    type="button"
                    className={`js-only ${styles.node}`}
                    data-orbit-id={entry.id}
                    data-orbit-node={number}
                    aria-pressed="false"
                    aria-controls={panelId}
                >
                    {content}
                </button>
            ) : null}
            <a
                className={`${panelId ? "nojs-only " : ""}${styles.node}`}
                href={`#${anchor}`}
                data-orbit-id={entry.id}
                data-orbit-to={anchor}
            >
                {content}
            </a>
        </li>
    );
}

function Plot({
    model,
    projection,
    horizontal,
    idPrefix,
    labels,
    panelId,
    planned,
}: {
    model: OrbitModel;
    projection: MapProjection;
    horizontal: boolean;
    idPrefix: string;
    labels: Map<
        string,
        {
            id: string;
            code: string;
            years: string | null;
            org: string;
            title: string;
            anchor: string;
        }
    >;
    panelId: string | null;
    planned: PlannedRecord | null;
}) {
    const p = projection;
    const prefix = `${idPrefix}-${horizontal ? "h" : "v"}`;
    const left = (x: number) => (horizontal ? pct(x, p.width) : `${x}px`);
    const at = (x: number, y: number): React.CSSProperties =>
        ({ "--x": left(x), top: `${Math.round(y)}px` }) as React.CSSProperties;
    const tickStyle = (value: number): React.CSSProperties =>
        horizontal
            ? ({
                  "--x": left(value),
                  top: `${Math.round(p.axis.y1)}px`,
              } as React.CSSProperties)
            : ({ top: `${Math.round(value)}px` } as React.CSSProperties);
    const byId = new Map(model.orbits.map((orbit) => [orbit.id, orbit]));

    return (
        <div
            className={horizontal ? styles.plotH : styles.plotV}
            style={{ height: `${p.height}px` }}
            data-orbit-plot
        >
            <svg
                className={styles.svg}
                viewBox={`0 0 ${p.width} ${p.height}`}
                preserveAspectRatio={horizontal ? "none" : "xMinYMin meet"}
                width={horizontal ? "100%" : p.width}
                height={p.height}
                aria-hidden="true"
                focusable="false"
            >
                <defs>
                    {p.orbits.map((shape, index) =>
                        shape.fade ? (
                            <FadeMask
                                key={shape.id}
                                id={`${prefix}-fade-${index}`}
                                fade={shape.fade}
                                projection={p}
                                horizontal={horizontal}
                            />
                        ) : null,
                    )}
                    {p.planned ? (
                        <FadeMask
                            id={`${prefix}-fade-planned`}
                            fade={p.planned.fade}
                            projection={p}
                            horizontal={horizontal}
                        />
                    ) : null}
                </defs>
                <g className={styles.grid}>
                    {p.ticks.map((tick) =>
                        horizontal ? (
                            <line
                                key={tick.year}
                                x1={tick.at}
                                x2={tick.at}
                                y1={p.grid.from}
                                y2={p.grid.to}
                            />
                        ) : (
                            <line
                                key={tick.year}
                                x1={p.grid.from}
                                x2={p.grid.to}
                                y1={tick.at}
                                y2={tick.at}
                            />
                        ),
                    )}
                </g>
                <line
                    className={styles.axis}
                    x1={p.axis.x1}
                    y1={p.axis.y1}
                    x2={p.axis.x2}
                    y2={p.axis.y2}
                />
                {p.transfers.map((transfer) =>
                    transfer.d ? (
                        <path
                            key={`${transfer.from}-${transfer.to}`}
                            className={styles.transfer}
                            d={transfer.d}
                        />
                    ) : null,
                )}
                {p.planned ? (
                    <g className={styles.planned} data-orbit-id="planned">
                        {p.planned.link ? <path d={p.planned.link} /> : null}
                        <path
                            d={p.planned.d}
                            mask={`url(#${prefix}-fade-planned)`}
                        />
                    </g>
                ) : null}
                {p.orbits.map((shape, index) => {
                    const mask = shape.fade
                        ? `url(#${prefix}-fade-${index})`
                        : undefined;
                    const orbit = byId.get(shape.id);
                    return (
                        <g key={shape.id}>
                            <path
                                className={styles.halo}
                                d={shape.d}
                                mask={mask}
                                data-orbit-id={shape.id}
                            />
                            <path
                                className={
                                    shape.flyby
                                        ? styles.flyby
                                        : orbit?.current
                                          ? styles.expected
                                          : styles.orbit
                                }
                                d={shape.d}
                                mask={mask}
                                data-orbit-id={shape.id}
                            />
                            {shape.flown ? (
                                <path
                                    className={styles.flown}
                                    d={shape.flown}
                                    data-orbit-id={shape.id}
                                />
                            ) : null}
                        </g>
                    );
                })}
                {panelId
                    ? p.orbits.map((shape) => (
                          <path
                              key={shape.id}
                              className={
                                  shape.flyby ? styles.hitLine : styles.hit
                              }
                              d={shape.d}
                              data-orbit-id={shape.id}
                          />
                      ))
                    : null}
                {panelId && p.planned ? (
                    <path
                        className={styles.hit}
                        d={p.planned.d}
                        data-orbit-id="planned"
                    />
                ) : null}
            </svg>

            <div className={styles.marks} aria-hidden="true">
                {p.ticks.map((tick) => (
                    <span
                        key={tick.year}
                        className={styles.year}
                        style={tickStyle(tick.at)}
                    >
                        {tick.year}
                    </span>
                ))}
                {p.transfers.map((transfer) => (
                    <span
                        key={`${transfer.from}-${transfer.to}`}
                        className={styles.burn}
                        style={at(transfer.burn.x, transfer.burn.y)}
                    />
                ))}
                <span className={styles.nowAxis} style={at(p.now.x, p.now.y)} />
                {p.orbits.map((shape) =>
                    shape.now ? (
                        <span
                            key={shape.id}
                            className={styles.now}
                            style={at(shape.now.x, shape.now.y)}
                        />
                    ) : null,
                )}
            </div>

            <ol className={styles.nodes} role="list">
                {p.orbits.map((shape) => {
                    const label = labels.get(shape.id);
                    const orbit = byId.get(shape.id);
                    if (!label || !orbit) return null;
                    return (
                        <Node
                            key={shape.id}
                            entry={label}
                            number={orbit.number}
                            anchor={label.anchor}
                            panelId={panelId}
                            place={shape.label.place}
                            style={at(shape.label.x, shape.label.y)}
                        />
                    );
                })}
                {p.planned && planned ? (
                    <li
                        className={styles.nodeItem}
                        style={at(p.planned.label.x, p.planned.label.y)}
                        data-place={p.planned.label.place}
                    >
                        {panelId ? (
                            <button
                                type="button"
                                className={`js-only ${styles.node} ${styles.nodePlanned}`}
                                data-orbit-id="planned"
                                aria-pressed="false"
                                aria-controls={panelId}
                            >
                                <span className={styles.nodeLine}>
                                    <span className={styles.nodeCode}>
                                        {copy.planned}
                                    </span>
                                </span>
                                <span className={styles.nodeOrg}>
                                    {planned.text}
                                </span>
                            </button>
                        ) : null}
                        <span
                            className={`${panelId ? "nojs-only " : ""}${styles.node} ${styles.nodePlanned}`}
                        >
                            <span className={styles.nodeLine}>
                                <span className={styles.nodeCode}>
                                    {copy.planned}
                                </span>
                            </span>
                            <span className={styles.nodeOrg}>
                                {planned.text}
                            </span>
                        </span>
                    </li>
                ) : null}
            </ol>
        </div>
    );
}

function KeyIcon({ kind }: { kind: "orbit" | "current" | "burn" | "planned" }) {
    return (
        <svg
            className={styles.keyIcon}
            viewBox="0 0 40 16"
            aria-hidden="true"
            focusable="false"
        >
            {kind === "orbit" ? (
                <ellipse
                    className={styles.orbit}
                    cx="20"
                    cy="8"
                    rx="17"
                    ry="5.5"
                />
            ) : null}
            {kind === "current" ? (
                <>
                    <ellipse
                        className={styles.expected}
                        cx="20"
                        cy="8"
                        rx="17"
                        ry="5.5"
                    />
                    <path
                        className={styles.flown}
                        d="M3 8A17 5.5 0 0 1 24 2.6"
                    />
                    <circle
                        className={styles.keyNow}
                        cx="24"
                        cy="2.6"
                        r="2.6"
                    />
                </>
            ) : null}
            {kind === "burn" ? (
                <>
                    <path
                        className={styles.transfer}
                        d="M3 13C16 13 22 3 34 3"
                    />
                    <path
                        className={styles.keyBurn}
                        d="M34 7.5 37.5 13.5h-7z"
                    />
                </>
            ) : null}
            {kind === "planned" ? (
                <ellipse
                    className={styles.plannedKey}
                    cx="20"
                    cy="8"
                    rx="17"
                    ry="5.5"
                />
            ) : null}
        </svg>
    );
}

export default function OrbitMap({
    model,
    entries,
    planned = null,
    idPrefix,
    figure,
}: {
    model: OrbitModel;
    entries: readonly CvEntry[];
    planned?: PlannedRecord | null;
    /** Unique per page: the SVG masks need document-unique ids. */
    idPrefix: string;
    /** "Fig. 1". */
    figure?: string;
}) {
    const panelId = `${idPrefix}-record`;
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const labels = new Map(
        model.orbits.flatMap((orbit) => {
            const entry = byId.get(orbit.id);
            if (!entry) return [];
            return [
                [
                    orbit.id,
                    {
                        id: orbit.id,
                        code: copy.designation(orbit.number),
                        years: entry.years,
                        org: entry.orgLabel,
                        title: entry.title,
                        anchor: entry.anchor,
                    },
                ] as const,
            ];
        }),
    );
    const current =
        model.orbits.find((orbit) => orbit.current) ??
        model.orbits[model.orbits.length - 1];
    const plannedShown = model.planned && planned ? planned : null;
    const sequence = [...model.orbits.filter((orbit) => byId.has(orbit.id))];

    const map = (
        <figure
            className={styles.figure}
            data-orbit-map
            data-orbit-default={current.id}
        >
            <p className={`js-only ${styles.hint}`}>
                <span className={styles.hintDot} aria-hidden="true" />
                {copy.hint}
            </p>
            <Plot
                model={model}
                projection={horizontalMap(model)}
                horizontal
                idPrefix={idPrefix}
                labels={labels}
                panelId={panelId}
                planned={plannedShown}
            />
            <Plot
                model={model}
                projection={verticalMap(model)}
                horizontal={false}
                idPrefix={idPrefix}
                labels={labels}
                panelId={panelId}
                planned={plannedShown}
            />
            <figcaption className="caption caption--plate">
                {figure ? <span className="caption__num">{figure}</span> : null}
                <span className="caption__body">{copy.caption}</span>
            </figcaption>
            <ul className={styles.key} role="list">
                <li>
                    <KeyIcon kind="orbit" />
                    {copy.key.orbit}
                </li>
                <li>
                    <KeyIcon kind="current" />
                    {copy.key.current}
                </li>
                {model.transfers.length ? (
                    <li>
                        <KeyIcon kind="burn" />
                        {copy.key.burn}
                    </li>
                ) : null}
                {plannedShown ? (
                    <li>
                        <KeyIcon kind="planned" />
                        {copy.key.planned}
                    </li>
                ) : null}
            </ul>
        </figure>
    );

    return (
        <div className={styles.layout}>
            {map}
            <div
                className={styles.panel}
                id={panelId}
                data-orbit-panel
                data-state="current"
            >
                <div className={styles.records}>
                    {sequence.map((orbit, index) => {
                        const entry = byId.get(orbit.id)!;
                        const kind =
                            entry.employment ??
                            (entry.kind === "education"
                                ? copy.education
                                : copy.role);
                        return (
                            <article
                                key={orbit.id}
                                className={styles.record}
                                data-orbit-record={orbit.id}
                                data-shown={
                                    orbit.id === current.id ? "" : undefined
                                }
                                aria-labelledby={`${panelId}-${index}`}
                            >
                                <p className={styles.recState}>
                                    <span>
                                        {copy.designation(orbit.number)}
                                    </span>
                                    <span className={styles.recKind}>
                                        {kind}
                                    </span>
                                    {entry.current ? (
                                        <Status value="active">
                                            {copy.current}
                                        </Status>
                                    ) : null}
                                </p>
                                <h3
                                    className={styles.recTitle}
                                    id={`${panelId}-${index}`}
                                >
                                    {entry.title}
                                </h3>
                                <p className={styles.recOrg}>
                                    {entry.organization}
                                    {entry.location
                                        ? ` · ${entry.location}`
                                        : ""}
                                </p>
                                {entry.dates || entry.expected ? (
                                    <p className={styles.recWhen}>
                                        {entry.dates ? (
                                            <span>{entry.dates}</span>
                                        ) : null}
                                        {entry.expected ? (
                                            <span>{entry.expected}</span>
                                        ) : null}
                                    </p>
                                ) : null}
                                {entry.summary ? (
                                    <p className={styles.recDek}>
                                        {entry.summary}
                                    </p>
                                ) : null}
                                {entry.highlights.length ? (
                                    <ul className={styles.recLines} role="list">
                                        {entry.highlights
                                            .slice(0, 3)
                                            .map((line) => (
                                                <li key={line}>{line}</li>
                                            ))}
                                    </ul>
                                ) : null}
                                {entry.burn ? (
                                    <p className={styles.recBurn}>
                                        <span
                                            className={styles.recBurnMark}
                                            aria-hidden="true"
                                        />
                                        {entry.burn}
                                    </p>
                                ) : null}
                                <div className={styles.recNav}>
                                    <Button
                                        size="sm"
                                        variant="quiet"
                                        className="js-only"
                                        data-orbit-step="-1"
                                        disabled={index === 0}
                                    >
                                        <span aria-hidden="true">←</span>
                                        {copy.earlier}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="quiet"
                                        className="js-only"
                                        data-orbit-step="1"
                                        disabled={
                                            index === sequence.length - 1 &&
                                            !plannedShown
                                        }
                                    >
                                        {copy.later}
                                        <span aria-hidden="true">→</span>
                                    </Button>
                                    <a
                                        className={`link-arrow ${styles.recFull}`}
                                        href={`#${entry.anchor}`}
                                        data-orbit-to={entry.anchor}
                                    >
                                        {copy.fullRecord}
                                        <Icon name="arrow-down" />
                                    </a>
                                </div>
                            </article>
                        );
                    })}
                    {plannedShown ? (
                        <article
                            className={styles.record}
                            data-orbit-record="planned"
                            aria-labelledby={`${panelId}-planned`}
                        >
                            <p className={styles.recState}>
                                <span>{copy.planned}</span>
                            </p>
                            <h3
                                className={styles.recTitle}
                                id={`${panelId}-planned`}
                            >
                                {plannedShown.text}
                            </h3>
                            <div className={styles.recNav}>
                                <Button
                                    size="sm"
                                    variant="quiet"
                                    className="js-only"
                                    data-orbit-step="-1"
                                >
                                    <span aria-hidden="true">←</span>
                                    {copy.earlier}
                                </Button>
                                {plannedShown.cta ? (
                                    <a
                                        className={`link-arrow ${styles.recFull}`}
                                        href={plannedShown.href}
                                    >
                                        {plannedShown.cta}
                                        <Icon name="arrow" />
                                    </a>
                                ) : null}
                            </div>
                        </article>
                    ) : null}
                </div>
                <p className="sr-only" aria-live="polite" data-orbit-live />
            </div>
        </div>
    );
}
