import Link from "next/link";
import PageHead from "@/components/ui/page-head";
import RouteList, { type RouteItem } from "@/components/ui/route-list";
import SectionTag from "@/components/ui/section-tag";
import RequestedPath from "@/components/los/requested-path";
import { lossOfSignalCopy } from "@/lib/copy";
import { contactHref, homeRoute, primaryNavigation } from "@/lib/navigation";
import {
    TRACE_AXIS,
    TRACE_HEIGHT,
    TRACE_LOS,
    TRACE_WIDTH,
    carrierTrace,
} from "@/lib/sky/trace";

const TRACE = carrierTrace();
const ROUTES: RouteItem[] = [homeRoute, ...primaryNavigation].map((route) => ({
    key: route.href,
    href: route.href,
    plain: route.plain,
    blurb: route.blurb,
}));

/**
 * Loss of Signal (G7): the 404 and, with other words and actions, the
 * error page. The shared page head, then a carrier
 * trace that drops out (ink, one accent mark where it is lost, no words),
 * then the site's sections as link rows over an engraved horizon (an ink
 * limb and the sun as its one accent). Everything renders without
 * JavaScript; only the requested address needs it. Directive-free, so the
 * client error boundary can render it too.
 */
export default function LossOfSignal({
    page,
    tag,
    title,
    lead,
    actions,
    showRequested = false,
}: {
    /** The root element's `data-page`. */
    page: string;
    /** The tag row's designation: "Loss of signal · 404". */
    tag: string;
    title: string;
    lead: string;
    actions: React.ReactNode;
    showRequested?: boolean;
}) {
    const copy = lossOfSignalCopy;
    return (
        <div data-page={page} className="los">
            <PageHead
                className="shell"
                split
                ornament="dot"
                tag={tag}
                title={title}
                intro={lead}
            >
                <div className="cluster page-head__actions">{actions}</div>
                {showRequested ? (
                    <RequestedPath label={copy.requested} />
                ) : null}
            </PageHead>

            <div className="shell" aria-hidden="true">
                <svg
                    className="los-trace"
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
            </div>

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
                    </defs>
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
                    <SectionTag ornament="orbit">
                        <h2 className="section-tag__h" id="los-return-h">
                            {copy.sections}
                        </h2>
                    </SectionTag>
                    <RouteList
                        className="los-routes"
                        items={ROUTES}
                        columns={3}
                        labelledBy="los-return-h"
                    />
                    <p className="los-report">
                        {copy.report}{" "}
                        <Link href={contactHref("hello")}>
                            {copy.reportLink}
                        </Link>
                        .
                    </p>
                </div>
            </section>
        </div>
    );
}
