import type { Metadata } from "next";
import ContactDesk from "@/components/contact/contact-desk";
import ContactForm from "@/components/contact/contact-form";
import ContactNoScript from "@/components/contact/contact-no-script";
import ContactRoutes from "@/components/contact/contact-routes";
import { ContactPageJsonLd } from "@/components/json-ld";
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
 * to, then the message form first, whole in the first viewport at
 * 1440×900 under its section's plain hairline, with the routes by intent
 * beside it as short rows (the form's Topic is the one control that picks
 * one; a route's prompt is only the message field's optional
 * placeholder), then the profiles. The introduction, the availability and
 * every route's words are the profile's; an empty one is left out.
 * Everything but the form renders without JavaScript; the form needs it
 * for BotID, so without it the page offers LinkedIn instead, as the form
 * does beside a send that did not go. There is no email address or phone
 * number.
 */
export default async function ContactPage() {
    const profile = await getProfile();
    const routes = contactRoutes(profile);
    const profiles = profileRows(profile);
    const openTo = availabilityLine(profile?.availability);
    const linkedIn = getProfileLink(profile, "linkedin");

    return (
        <div data-page="contact">
            <ContactPageJsonLd profile={profile} />
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
            </PageHead>

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
                                        linkedIn={linkedIn}
                                    />
                                </div>
                                <ContactNoScript
                                    linkedIn={linkedIn}
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
