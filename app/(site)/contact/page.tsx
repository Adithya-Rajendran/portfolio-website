import type { Metadata } from "next";
import ContactDesk from "@/components/contact/contact-desk";
import ContactForm from "@/components/contact/contact-form";
import ContactNoScript from "@/components/contact/contact-no-script";
import ContactRoutes from "@/components/contact/contact-routes";
import { ContactPageJsonLd } from "@/components/json-ld";
import StaticStars from "@/components/sky/static-stars";
import Availability from "@/components/ui/availability";
import DocSection from "@/components/ui/doc-section";
import PageHead from "@/components/ui/page-head";
import RouteList from "@/components/ui/route-list";
import SectionTag from "@/components/ui/section-tag";
import { siteConfig } from "@/lib/config";
import { contactRoutes, topicOptions } from "@/lib/contact";
import { contactCopy as copy } from "@/lib/copy";
import { profileRows } from "@/lib/directory";
import { siteRoutes } from "@/lib/navigation";
import { availabilityLine, getProfileLink } from "@/lib/profile-content";
import { getProfile } from "@/lib/sanity-client";
import styles from "./contact.module.css";

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const description =
        profile?.contactInvitation?.trim() || profile?.contactIntro?.trim();
    const described = description ? { description } : {};
    const title = copy.plain;
    const url = `${siteConfig.url}${siteRoutes.contact}`;
    return {
        title,
        ...described,
        alternates: { canonical: url },
        openGraph: { title: `${title} | ${name}`, ...described, url },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${name}`,
            ...described,
        },
    };
}

/**
 * Contact (themed Comms, G4): the introduction and what the owner is open
 * to, then the message form first, with the routes by intent beside it as
 * short rows (each picks the form's topic; its prompt is only the message
 * field's optional placeholder), then the profiles. The introduction,
 * the availability and every route's words are the profile's; an empty
 * one is left out. Everything but the form renders without JavaScript;
 * the form needs it for BotID, so without it the page offers LinkedIn
 * instead. There is no email address or phone number.
 */
export default async function ContactPage() {
    const profile = await getProfile();
    const routes = contactRoutes(profile);
    const profiles = profileRows(profile);
    const openTo = availabilityLine(profile?.availability);

    return (
        <div data-page="contact">
            <ContactPageJsonLd profile={profile} />
            <div className="head-band">
                <StaticStars variant="band" />
                <PageHead
                    className="shell"
                    split
                    ornament="record"
                    tag={copy.themed}
                    title={copy.plain}
                    intro={profile?.contactIntro?.trim() || null}
                >
                    {openTo ? (
                        <Availability
                            className={styles.openTo}
                            label={copy.openTo}
                            text={openTo}
                        />
                    ) : null}
                    {/* Acquisition of signal: the carrier locks. Drawn in
                        ink with one accent mark; decorative and static. */}
                    <svg
                        className={styles.aos}
                        viewBox="0 0 640 96"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path className={styles.aosFloor} d="M0 60H640" />
                        <path
                            className={styles.aosNoise}
                            d="M0 60h40l3-2 3 3 4-1 3 2 5-3 3 2 4-1 3 1h24l2-3 3 4 3-2 4 1 3-1 4 2 3-1h30l3-2 3 3 4-2 3 1 4-1 3 2h40"
                        />
                        <path
                            className={styles.aosLock}
                            d="M232 60C240 60 244 52 252 52S264 68 272 68 284 42 292 42 304 78 312 78 324 34 332 34 344 86 352 86 364 30 372 30 384 90 392 90 404 30 412 30 424 90 432 90 444 30 452 30 464 90 472 90 484 30 492 30 504 90 512 90 524 30 532 30 544 90 552 90 564 30 572 30 584 90 592 90 604 30 612 30 624 90 632 90 640 60 640 60"
                        />
                        <circle
                            className={styles.aosAcq}
                            cx="232"
                            cy="60"
                            r="4.5"
                        />
                    </svg>
                </PageHead>
            </div>

            <ContactDesk topics={routes.map((route) => route.topic)}>
                <section
                    className={`section ${styles.desk}`}
                    id="message"
                    aria-labelledby="contact-message-h"
                    data-contact-message
                >
                    <div className="shell">
                        <SectionTag className="doc-section__tag">
                            <h2
                                className="section-tag__h"
                                id="contact-message-h"
                            >
                                {copy.message}
                            </h2>
                        </SectionTag>
                        <div className={styles.deskGrid}>
                            <div className={styles.form}>
                                <div className="js-only">
                                    <ContactForm
                                        topics={topicOptions(routes)}
                                    />
                                </div>
                                <ContactNoScript
                                    linkedIn={getProfileLink(
                                        profile,
                                        "linkedin",
                                    )}
                                    className={styles.noScript}
                                />
                            </div>
                            <div className={styles.routes}>
                                <h3
                                    className={styles.routesTitle}
                                    id="contact-routes-h"
                                >
                                    {copy.routes}
                                </h3>
                                <ContactRoutes
                                    routes={routes}
                                    onPage
                                    titleAs="h4"
                                    labelledBy="contact-routes-h"
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </ContactDesk>

            {profiles.length ? (
                <DocSection
                    className={styles.elsewhere}
                    headingId="contact-else-h"
                    title={copy.elsewhere}
                >
                    <RouteList
                        items={profiles}
                        columns={2}
                        labelledBy="contact-else-h"
                    />
                </DocSection>
            ) : null}
        </div>
    );
}
