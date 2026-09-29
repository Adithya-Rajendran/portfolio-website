import type { Metadata } from "next";
import Link from "next/link";
import StaticStars from "@/components/sky/static-stars";
import TrajectoryView from "@/components/trajectory/trajectory-view";
import { buttonClass } from "@/components/ui/button";
import { LinkArrow } from "@/components/ui/marks";
import PageHead from "@/components/ui/page-head";
import { getToday } from "@/lib/clock";
import { trajectoryCopy as copy } from "@/lib/copy";
import { cvEntries } from "@/lib/cv";
import { siteRoutes } from "@/lib/navigation";
import { getProfile } from "@/lib/sanity-client";
import { trajectoryData } from "@/lib/trajectory";

export const metadata: Metadata = {
    title: copy.metaTitle,
    description: copy.description,
    robots: { index: false },
};

/**
 * Experience, flown: the profile's timeline as a route the page scrolls
 * through (components/trajectory/journey.tsx), then the way back to the
 * list. The CV on /resume stays the complete record.
 */
export default async function TrajectoryPage() {
    const [profile, today] = await Promise.all([getProfile(), getToday()]);
    const data = trajectoryData(
        cvEntries(profile?.timeline).all,
        profile?.availability,
        today,
    );
    const first = data.chapters[0];
    const current = data.chapters.some((chapter) => chapter.current);
    return (
        <div data-page="trajectory">
            <div className="head-band">
                <StaticStars variant="band" />
                <PageHead
                    className="shell"
                    ornament="orbit"
                    tag={copy.tag}
                    title={copy.title}
                    meta={
                        first ? (
                            <span className="data">
                                {first.year}
                                {current ? " – present" : null}
                            </span>
                        ) : undefined
                    }
                >
                    <div className="cluster page-head__actions">
                        <Link
                            className={buttonClass({ size: "sm" })}
                            href={siteRoutes.resume}
                        >
                            {copy.list}
                        </Link>
                    </div>
                </PageHead>
            </div>
            {data.chapters.length ? <TrajectoryView data={data} /> : null}
            <div className="shell section--tight">
                <LinkArrow href={siteRoutes.resume}>{copy.close}</LinkArrow>
            </div>
        </div>
    );
}
