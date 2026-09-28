import type { Metadata } from "next";
import ContactDesk from "@/components/contact/contact-desk";
import ContactForm from "@/components/contact/contact-form";
import ContactNoScript from "@/components/contact/contact-no-script";
import ContactRoutes from "@/components/contact/contact-routes";
import { ContactPageJsonLd } from "@/components/json-ld";
import { Icon } from "@/components/ui/icon";
import PageHead from "@/components/ui/page-head";
import Pair from "@/components/ui/pair";
import SectionTag from "@/components/ui/section-tag";
import TitleBlock, { type TitleBlockCell } from "@/components/ui/title-block";
import { siteConfig } from "@/lib/config";
import { contactRoutes, topicOptions } from "@/lib/contact";
import { MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import { contactCopy as copy } from "@/lib/copy";
import { siteRoutes } from "@/lib/navigation";
import { getProfileLink, getProfileLinks } from "@/lib/profile-content";
import { getProfile, type ProfileData } from "@/lib/sanity-client";
import styles from "./contact.module.css";

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const description = profile?.contactInvitation?.trim() || copy.intro;
    const url = `${siteConfig.url}${siteRoutes.contact}`;
    return {
        title: copy.plain,
        description,
        alternates: { canonical: url },
        openGraph: { title: `${copy.plain} | ${name}`, description, url },
        twitter: {
            card: "summary_large_image",
            title: `${copy.plain} | ${name}`,
            description,
        },
    };
}

/** "linkedin.com/in/…": a profile link's address without the scheme. */
function host(url: string): string {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** The channel record beside the form: facts only, gaps left blank. */
function recordCells(profile: ProfileData | null): TitleBlockCell[] {
    const record = copy.record;
    const availability = profile?.availability;
    const openTo =
        availability?.status !== "closed" ? availability?.openTo?.trim() : "";
    return [
        {
            id: "channel",
            label: record.channel,
            value: record.channelValue,
            note: record.channelNote(MESSAGE_MAX_LENGTH),
            span: 12,
        },
        ...(openTo
            ? [
                  {
                      id: "open-to",
                      label: record.openTo,
                      value: openTo,
                      span: 12,
                      accent: true,
                  },
              ]
            : []),
        {
            id: "email",
            label: record.email,
            value: record.emailNote,
            span: 6,
            spanSm: 1,
        },
        availability?.updatedAt
            ? {
                  id: "updated",
                  label: record.updated,
                  value: (
                      <time dateTime={availability.updatedAt}>
                          {availability.updatedAt}
                      </time>
                  ),
                  data: true,
                  span: 6,
                  spanSm: 1,
              }
            : { id: "blank", blank: true, span: 6, spanSm: 1 },
    ];
}

/**
 * Comms · Contact (G4): the routes by intent, the message form and the
 * other places to find the owner. Everything but the form renders without
 * JavaScript; the form needs it for BotID, so without it the page offers
 * LinkedIn instead. There is no public email address or phone number.
 * Ported from the mockup's contact.html (§ 05); its 30-second review
 * checklist and "reply time" are left out: neither has content yet.
 */
export default async function ContactPage() {
    const profile = await getProfile();
    const routes = contactRoutes(profile);
    const profiles = getProfileLinks(profile);

    return (
        <div data-page="contact" className={styles.page}>
            <ContactPageJsonLd profile={profile} />
            <PageHead
                className={`shell ${styles.head}`}
                ornament="record"
                num={copy.num}
                themed={copy.themed}
                plain={copy.plain}
                title={copy.title}
                meta={copy.meta(routes.length)}
                intro={copy.intro}
            >
                {/* Acquisition of signal: the 404's loss of signal, reversed.
                    Decorative and static. */}
                <figure className={styles.aos} aria-hidden="true">
                    <svg
                        className={styles.aosTrace}
                        viewBox="0 0 640 96"
                        preserveAspectRatio="none"
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
                    <figcaption className={styles.aosCaption}>
                        <span className={styles.aosKey}>{copy.aosKey}</span>
                        <span>{copy.aosCaption}</span>
                    </figcaption>
                </figure>
            </PageHead>

            <ContactDesk topics={routes.map((route) => route.topic)}>
                <section
                    className="section section--tight"
                    aria-labelledby="contact-routes-h"
                >
                    <div className="shell">
                        <SectionTag
                            num={`${copy.num}.1`}
                            meta={copy.routesMeta}
                        >
                            <h2
                                className="section-tag__h"
                                id="contact-routes-h"
                            >
                                {copy.routesTitle}
                            </h2>
                        </SectionTag>
                        <div className={styles.routes}>
                            <ContactRoutes routes={routes} onPage />
                        </div>
                    </div>
                </section>

                <section
                    className={`section ${styles.message}`}
                    id="message"
                    data-contact-message
                    aria-labelledby="contact-message-h"
                >
                    <div className={`shell grid ${styles.messageGrid}`}>
                        <div className={`g-rail ${styles.messageRail}`}>
                            <SectionTag num={`${copy.num}.2`}>
                                <h2
                                    className="section-tag__h"
                                    id="contact-message-h"
                                >
                                    {copy.messageTitle}
                                </h2>
                            </SectionTag>
                        </div>
                        <div className={`g-main ${styles.messageMain}`}>
                            <div className="js-only">
                                <ContactForm topics={topicOptions(routes)} />
                            </div>
                            <ContactNoScript
                                linkedIn={getProfileLink(profile, "linkedin")}
                                className={styles.noScript}
                            />
                        </div>
                        <div className={`g-rail ${styles.messageRecord}`}>
                            <TitleBlock
                                cells={recordCells(profile)}
                                blankLabel={copy.record.blank}
                            />
                        </div>
                    </div>
                </section>
            </ContactDesk>

            <section
                className={`section ${styles.elsewhere}`}
                aria-labelledby="contact-else-h"
            >
                <div className="shell grid">
                    <div className="g-rail">
                        <SectionTag num={`${copy.num}.3`}>
                            <h2 className="section-tag__h" id="contact-else-h">
                                <Pair
                                    themed={copy.elsewhereThemed}
                                    plain={copy.elsewherePlain}
                                />
                            </h2>
                        </SectionTag>
                    </div>
                    <div className="g-main">
                        <p className={styles.elsewhereLede}>
                            {copy.elsewhereLede}
                        </p>
                        <ul className={styles.elsewhereList} role="list">
                            {[
                                ...profiles.map((link) => ({
                                    key: link._key,
                                    label: link.label,
                                    url: link.url,
                                    host: host(link.url),
                                    external: true,
                                })),
                                {
                                    key: "rss",
                                    label: copy.rss,
                                    url: siteRoutes.feed,
                                    host: `${host(siteConfig.url)}${siteRoutes.feed}`,
                                    external: false,
                                },
                            ].map((link) => (
                                <li key={link.key}>
                                    <a
                                        className={styles.elsewhereLink}
                                        href={link.url}
                                        {...(link.external
                                            ? {
                                                  target: "_blank",
                                                  rel: "noopener noreferrer",
                                              }
                                            : {})}
                                    >
                                        <span className={styles.elsewhereLabel}>
                                            {link.label}
                                        </span>
                                        <span className={styles.elsewhereHost}>
                                            {link.host}
                                        </span>
                                        <Icon
                                            name={
                                                link.external
                                                    ? "external"
                                                    : "rss"
                                            }
                                            className={styles.elsewhereIcon}
                                        />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>
        </div>
    );
}
