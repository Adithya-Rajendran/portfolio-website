import PageHead from "@/components/ui/page-head";
import { ReportLink } from "@/components/los/not-found-actions";
import { lossOfSignalCopy } from "@/lib/copy";
import {
    TRACE_AXIS,
    TRACE_HEIGHT,
    TRACE_LOS,
    TRACE_WIDTH,
    carrierTrace,
} from "@/lib/sky/trace";

const TRACE = carrierTrace();

/**
 * Loss of Signal (G7): the 404 and, with other words and actions, the
 * error page. The shared page head, then a carrier trace that drops out,
 * shown already drawn (ink, no words), the page's one drawing, then the
 * report ("Found a broken link? Let me know") and space. Everything
 * renders without JavaScript; on the 404 (`missed`) the primary that
 * follows the missed address and the report that carries it need it.
 * `plainLinks` on the global 404, whose links load pages in full
 * (SiteLink). Directive-free, so the client error boundary can render it
 * too.
 */
export default function LossOfSignal({
    page,
    tag,
    title,
    lead,
    actions,
    missed = false,
    plainLinks = false,
}: {
    /** The root element's `data-page`. */
    page: string;
    /** The tag row's designation: "Loss of signal · 404". */
    tag: string;
    title: string;
    lead: string;
    actions: React.ReactNode;
    /** The 404: the page follows the address that was missed. */
    missed?: boolean;
    /** Plain <a href> links: the global 404's document. */
    plainLinks?: boolean;
}) {
    const copy = lossOfSignalCopy;
    return (
        <div data-page={page} className="los">
            <PageHead
                className="shell"
                split
                tag={tag}
                title={title}
                intro={lead}
            >
                <div className="cluster page-head__actions">{actions}</div>
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

            <div className="shell">
                <p className="los-report">
                    {copy.report}{" "}
                    <ReportLink missed={missed} plain={plainLinks} />.
                </p>
            </div>
        </div>
    );
}
