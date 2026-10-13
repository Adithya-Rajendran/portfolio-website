import type { Metadata } from "next";
import CrewRecord from "@/components/crew/crew-record";
import Questions from "@/components/crew/questions";
import { ProfilePageJsonLd } from "@/components/json-ld";
import DocSection from "@/components/ui/doc-section";
import { Updated } from "@/components/ui/marks";
import PageHead from "@/components/ui/page-head";
import { siteConfig } from "@/lib/config";
import { aboutCopy as copy, nowKinds } from "@/lib/copy";
import { nowGroups } from "@/lib/crew";
import { dateOnly } from "@/lib/dates";
import { siteRoutes } from "@/lib/navigation";
import {
    getAllPosts,
    getAllProjects,
    getProfile,
    type ProfileData,
} from "@/lib/sanity-client";
import styles from "./about.module.css";

const canonicalUrl = `${siteConfig.url}${siteRoutes.about}`;
const title = copy.plain;

function descriptionOf(profile: ProfileData | null): string {
    return (
        profile?.introduction?.trim() ||
        profile?.headline?.trim() ||
        copy.description
    );
}

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const description = descriptionOf(profile);
    return {
        title,
        description,
        alternates: { canonical: canonicalUrl },
        openGraph: {
            title: `${title} | ${name}`,
            description,
            url: canonicalUrl,
            type: "profile",
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${name}`,
            description,
        },
    };
}

/** The biography's paragraphs (blank-line apart in the profile). */
function paragraphsOf(bio: string | null | undefined): string[] {
    return (bio ?? "")
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);
}

/**
 * About (themed Crew File; plan §6.2 row 14): the head, with no figure
 * (the header's patch is the mark; there is no portrait) and no dek (the
 * record under it states what the headline would), the profile record
 * (G6), then the biography and the Now list by kind (a kind's label only
 * when there is more than one), which ends the page in space. The
 * writing, the talks, the other sections and Contact are one click away
 * in the nav. A section with nothing to show is absent; the sections are
 * titled by their plain names. Everything is server-rendered and static;
 * there are no islands.
 */
export default async function AboutPage() {
    const [profile, posts, projects] = await Promise.all([
        getProfile(),
        getAllPosts(),
        getAllProjects(),
    ]);
    const paragraphs = paragraphsOf(profile?.bio);
    const groups = nowGroups(profile?.currentCuriosities, posts, projects);
    const nowDate = dateOnly(profile?.curiositiesUpdatedAt);

    return (
        <div data-page="about">
            <ProfilePageJsonLd />
            <PageHead
                className="shell"
                split
                tag={copy.themed}
                title={copy.plain}
            />

            <div className="shell">
                <CrewRecord profile={profile} className={styles.record} />
            </div>

            {paragraphs.length ? (
                <DocSection id="crew-bio" title={copy.bio} prose>
                    <div className="prose">
                        {paragraphs.map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                </DocSection>
            ) : null}

            {groups.length ? (
                <DocSection
                    id="crew-now"
                    title={copy.now}
                    meta={
                        nowDate ? (
                            <Updated label={copy.updated} date={nowDate} />
                        ) : undefined
                    }
                >
                    {groups.length === 1 ? (
                        <Questions
                            items={groups[0].items}
                            labelledBy="crew-now-h"
                        />
                    ) : (
                        groups.map((group) => (
                            <div className={styles.group} key={group.kind}>
                                <h3
                                    className={`label ${styles.groupTitle}`}
                                    id={`crew-now-${group.kind}-h`}
                                >
                                    {nowKinds[group.kind]}
                                </h3>
                                <Questions
                                    items={group.items}
                                    labelledBy={`crew-now-${group.kind}-h`}
                                />
                            </div>
                        ))
                    )}
                </DocSection>
            ) : null}
        </div>
    );
}
