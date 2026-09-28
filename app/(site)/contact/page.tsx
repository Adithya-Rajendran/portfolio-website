import type { Metadata } from "next";
import ContactDesk from "@/components/contact/contact-desk";
import ContactForm from "@/components/contact/contact-form";
import ContactNoScript from "@/components/contact/contact-no-script";
import ContactRoutes from "@/components/contact/contact-routes";
import { ContactPageJsonLd } from "@/components/json-ld";
import StaticStars from "@/components/sky/static-stars";
import PageHead from "@/components/ui/page-head";
import Pair from "@/components/ui/pair";
import RouteList from "@/components/ui/route-list";
import SectionTag from "@/components/ui/section-tag";
import { siteConfig } from "@/lib/config";
import { contactRoutes, topicOptions } from "@/lib/contact";
import { contactCopy as copy } from "@/lib/copy";
import { profileRows } from "@/lib/directory";
import { siteRoutes } from "@/lib/navigation";
import { getProfileLink } from "@/lib/profile-content";
import { getProfile } from "@/lib/sanity-client";
import styles from "./contact.module.css";

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const description = profile?.contactInvitation?.trim() || copy.intro;
    const title = `${copy.themed} · ${copy.plain}`;
    const url = `${siteConfig.url}${siteRoutes.contact}`;
    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: { title: `${title} | ${name}`, description, url },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${name}`,
            description,
        },
    };
}

/**
 * Comms · Contact (G4): the routes by intent, the message form and the
 * profiles. Everything but the form renders without JavaScript; the form
 * needs it for BotID, so without it the page offers LinkedIn instead.
 * Ported from the mockup's contact.html (§ 05).
 */
export default async function ContactPage() {
    const profile = await getProfile();
    const routes = contactRoutes(profile);
    const profiles = profileRows(profile);

    return (
        <div data-page="contact">
            <ContactPageJsonLd profile={profile} />
            <div className="head-band">
                <StaticStars variant="band" />
                <PageHead
                    className="shell"
                    split
                    ornament="record"
                    num={copy.num}
                    themed={copy.themed}
                    plain={copy.plain}
                    intro={copy.intro}
                >
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
                    className="section section--tight"
                    aria-labelledby="contact-routes-h"
                >
                    <div className="shell">
                        <SectionTag num={`${copy.num}.1`}>
                            <h2
                                className="section-tag__h"
                                id="contact-routes-h"
                            >
                                <Pair
                                    themed={copy.routesThemed}
                                    plain={copy.routesPlain}
                                />
                            </h2>
                        </SectionTag>
                        <div className={styles.routes}>
                            <ContactRoutes routes={routes} onPage />
                        </div>
                    </div>
                </section>

                <section
                    className="section"
                    id="message"
                    data-contact-message
                    aria-labelledby="contact-message-h"
                >
                    <div className="shell grid">
                        <div className="g-rail">
                            <SectionTag num={`${copy.num}.2`}>
                                <h2
                                    className="section-tag__h"
                                    id="contact-message-h"
                                >
                                    <Pair
                                        themed={copy.messageThemed}
                                        plain={copy.messagePlain}
                                    />
                                </h2>
                            </SectionTag>
                        </div>
                        <div className="g-main">
                            <div className="js-only">
                                <ContactForm topics={topicOptions(routes)} />
                            </div>
                            <ContactNoScript
                                linkedIn={getProfileLink(profile, "linkedin")}
                                className={styles.noScript}
                            />
                        </div>
                    </div>
                </section>
            </ContactDesk>

            {profiles.length ? (
                <section
                    className={`section ${styles.elsewhere}`}
                    aria-labelledby="contact-else-h"
                >
                    <div className="shell grid">
                        <div className="g-rail">
                            <SectionTag num={`${copy.num}.3`}>
                                <h2
                                    className="section-tag__h"
                                    id="contact-else-h"
                                >
                                    <Pair
                                        themed={copy.elsewhereThemed}
                                        plain={copy.elsewherePlain}
                                    />
                                </h2>
                            </SectionTag>
                        </div>
                        <div className="g-main">
                            <RouteList
                                items={profiles}
                                columns={2}
                                labelledBy="contact-else-h"
                            />
                        </div>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
