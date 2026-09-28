import Link from "next/link";
import StaticStars from "@/components/sky/static-stars";
import Pair from "@/components/ui/pair";
import SectionTag from "@/components/ui/section-tag";
import { Icon } from "@/components/ui/icon";
import RequestedPath from "@/components/los/requested-path";
import { lossOfSignalCopy } from "@/lib/copy";
import {
    homeRoute,
    pairName,
    primaryNavigation,
    siteRoutes,
} from "@/lib/navigation";
import {
    TRACE_AXIS,
    TRACE_HEIGHT,
    TRACE_LOS,
    TRACE_WIDTH,
    carrierTrace,
} from "@/lib/sky/trace";

const TRACE = carrierTrace();
const ROUTES = [homeRoute, ...primaryNavigation];

/**
 * Loss of Signal (G7): the 404 and, with other words and actions, the
 * error page. Fig. 0 is a carrier trace that drops out at LOS, then the
 * message and recovery links over a static star layer, then the return
 * routes over an engraved horizon. Everything renders without JavaScript;
 * only the requested address needs it. Directive-free, so the client error
 * boundary can render it too. Ported from the mockup's 404.html and
 * writing.css "404.HTML"; the mockup's photographic plates (Pale Blue Dot,
 * planet limb) are drawn procedurally instead, since the site shows no
 * stand-in imagery.
 */
export default function LossOfSignal({
    page,
    tag,
    themed,
    plain,
    title,
    lead,
    actions,
    showRequested = false,
}: {
    /** The root element's `data-page`. */
    page: string;
    tag: string;
    themed: string;
    plain: string;
    title: string;
    lead: string;
    actions: React.ReactNode;
    showRequested?: boolean;
}) {
    const copy = lossOfSignalCopy;
    return (
        <div data-page={page} className="los">
            <StaticStars />
            <section className="shell" aria-labelledby="los-h">
                <figure className="los-trace" aria-hidden="true">
                    <div className="los-legend">
                        <span>
                            <span className="los-fig">Fig. 0</span>
                            {copy.traceCaption}
                        </span>
                        <span className="los-legend-mid">{copy.traceMid}</span>
                        <span>{copy.traceEnd}</span>
                    </div>
                    <div className="los-plot">
                        <svg
                            className="los-trace-svg"
                            viewBox={`0 0 ${TRACE_WIDTH} ${TRACE_HEIGHT}`}
                            preserveAspectRatio="none"
                            focusable="false"
                        >
                            <path className="los-grid-v" d={TRACE.grid} />
                            <path
                                className="los-grid-h"
                                d={`M0 20H${TRACE_WIDTH}M0 56H${TRACE_WIDTH}`}
                            />
                            <path
                                className="los-axis"
                                d={`M0 ${TRACE_AXIS}H${TRACE_WIDTH}`}
                            />
                            <path className="los-signal" d={TRACE.signal} />
                            <path
                                className="los-dead"
                                d={`M${TRACE_LOS} ${TRACE_AXIS}H${TRACE_WIDTH}`}
                            />
                            <path
                                className="los-los-line"
                                d={`M${TRACE_LOS} 0V${TRACE_HEIGHT}`}
                            />
                        </svg>
                        <span className="los-los-label">{copy.traceLos}</span>
                        <span className="los-flat-label">{copy.traceFlat}</span>
                    </div>
                </figure>

                <div className="los-body">
                    <div className="los-copy">
                        <SectionTag
                            as="p"
                            ornament="dot"
                            num={tag}
                            sect={false}
                        >
                            <Pair themed={themed} plain={plain} />
                        </SectionTag>
                        <h1 className="los-title" id="los-h">
                            {title}
                            <span className="los-plain">
                                <span className="sr-only">: </span>
                                {plain}
                            </span>
                        </h1>
                        <p className="los-lead">{lead}</p>
                        <div className="los-actions">{actions}</div>
                        {showRequested ? (
                            <RequestedPath label={copy.requested} />
                        ) : null}
                    </div>

                    {/* The last frame received: drawn, not photographed. */}
                    <figure className="los-frame">
                        <div className="los-plate" aria-hidden="true">
                            <span className="los-plate-label">
                                Fig. 1 · Last frame
                            </span>
                            <span className="los-beam" />
                            <span className="los-contact">
                                <span className="los-contact-text">
                                    Last contact
                                    <br />
                                    Signal lost
                                </span>
                                <span className="los-contact-line" />
                                <span className="los-contact-ring" />
                            </span>
                        </div>
                        <figcaption className="caption caption--plate">
                            <span className="caption__num">Fig. 1</span>
                            <span className="caption__body">
                                The last frame received before loss of signal.
                                The page you asked for is somewhere outside it.
                            </span>
                        </figcaption>
                    </figure>
                </div>
            </section>

            <section className="los-return" aria-labelledby="los-return-h">
                <svg
                    className="los-chart"
                    viewBox="0 0 1600 400"
                    preserveAspectRatio="xMidYMax slice"
                    aria-hidden="true"
                    focusable="false"
                >
                    <defs>
                        <clipPath id="los-body">
                            <circle cx="800" cy="1000" r="840" />
                        </clipPath>
                        <radialGradient
                            id="los-glow"
                            cx="50%"
                            cy="100%"
                            r="60%"
                        >
                            <stop offset="0%" className="los-glow-core" />
                            <stop offset="100%" className="los-glow-edge" />
                        </radialGradient>
                    </defs>
                    <rect
                        className="los-glow"
                        x="0"
                        y="0"
                        width="1600"
                        height="400"
                        fill="url(#los-glow)"
                    />
                    <g className="los-lat" clipPath="url(#los-body)">
                        <path d="M-100 250 Q800 170 1700 250" />
                        <path d="M-100 330 Q800 240 1700 330" />
                    </g>
                    <circle className="los-rim" cx="800" cy="1000" r="840" />
                    <circle className="los-halo" cx="800" cy="160" r="22" />
                    <circle className="los-sun" cx="800" cy="160" r="8" />
                    <path className="los-path" d="M170 70 Q620 10 1068 196" />
                    <path
                        className="los-ghost"
                        d="M1068 196 Q1240 290 1400 300"
                        clipPath="url(#los-body)"
                    />
                    <path className="los-tick" d="M1052 182 L1084 212" />
                </svg>
                <div className="shell">
                    <SectionTag
                        ornament="orbit"
                        num={copy.returnTag}
                        sect={false}
                    >
                        <h2 className="section-tag__h" id="los-return-h">
                            <Pair
                                themed={copy.returnThemed}
                                plain={copy.returnPlain}
                            />
                        </h2>
                    </SectionTag>
                    <nav className="los-routes" aria-labelledby="los-return-h">
                        <ol role="list">
                            {ROUTES.map((route) => (
                                <li key={route.href}>
                                    <Link
                                        className="los-route"
                                        href={route.href}
                                        aria-label={pairName(route)}
                                    >
                                        <span
                                            className="los-route-num"
                                            aria-hidden="true"
                                        >
                                            {route.num}
                                        </span>
                                        <span className="los-route-name">
                                            <span className="los-route-themed">
                                                {route.themed}
                                            </span>
                                            <span className="los-route-plain">
                                                {route.plain}
                                            </span>
                                        </span>
                                        <span className="los-route-blurb">
                                            {route.blurb}
                                        </span>
                                        <Icon
                                            name="arrow"
                                            className="los-route-arrow"
                                        />
                                    </Link>
                                </li>
                            ))}
                        </ol>
                    </nav>
                    <p className="los-report">
                        {copy.report}{" "}
                        <Link href={siteRoutes.contact}>{copy.reportLink}</Link>{" "}
                        {copy.reportTail}
                    </p>
                </div>
            </section>
        </div>
    );
}
