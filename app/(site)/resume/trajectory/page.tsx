import type { Metadata } from "next";
import TrajectoryView from "@/components/trajectory/trajectory-view";
import { ButtonLink } from "@/components/ui/button";
import CrumbRow from "@/components/ui/crumb-row";
import { LinkArrow } from "@/components/ui/marks";
import { getToday } from "@/lib/clock";
import { siteConfig } from "@/lib/config";
import { trajectoryCopy as copy } from "@/lib/copy";
import { cvEntries } from "@/lib/cv";
import { siteRoutes } from "@/lib/navigation";
import { getProfile } from "@/lib/sanity-client";
import { trajectoryData } from "@/lib/trajectory";
import styles from "./trajectory.module.css";

const canonicalUrl = `${siteConfig.url}${siteRoutes.trajectory}`;

/** Its own address and card (opengraph-image.tsx); still unlisted. */
export const metadata: Metadata = {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: canonicalUrl },
    robots: { index: false },
    openGraph: {
        title: `${copy.title} | ${siteConfig.author}`,
        description: copy.description,
        url: canonicalUrl,
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: `${copy.title} | ${siteConfig.author}`,
        description: copy.description,
    },
};

/**
 * Experience, flown: one crumb line (Experience / Timeline, the page's
 * small h1, and Skip to the list), then the profile's timeline as a route
 * the page scrolls through (components/trajectory/journey.tsx), and after
 * the stage the profile's button and the one way back to the list. The
 * CV on /resume stays the complete record.
 */
export default async function TrajectoryPage() {
    const [profile, today] = await Promise.all([getProfile(), getToday()]);
    const data = trajectoryData(
        cvEntries(profile?.timeline).all,
        profile?.availability,
        today,
    );
    return (
        <div data-page="trajectory">
            <CrumbRow
                className={`shell ${styles.head}`}
                label={copy.section}
                href={siteRoutes.resume}
                name={copy.title}
                heading
                meta={
                    <LinkArrow href={siteRoutes.resume} prefetch={false}>
                        {copy.skip}
                    </LinkArrow>
                }
                metaClassName={styles.skip}
            />
            {data.chapters.length ? <TrajectoryView data={data} /> : null}
            <div className={`shell cluster ${styles.close}`}>
                {data.planned?.cta ? (
                    <ButtonLink
                        variant="primary"
                        href={data.planned.href}
                        icon="arrow"
                        iconAt="end"
                    >
                        {data.planned.cta}
                    </ButtonLink>
                ) : null}
                <LinkArrow href={siteRoutes.resume} prefetch={false}>
                    {copy.close}
                </LinkArrow>
            </div>
        </div>
    );
}
