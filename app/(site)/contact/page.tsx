import type { Metadata } from "next";
import ContactForm from "@/components/contact/contact-form";
import ContactNoScript from "@/components/contact/contact-no-script";
import { ContactPageJsonLd } from "@/components/json-ld";
import Availability from "@/components/ui/availability";
import PageHead from "@/components/ui/page-head";
import { siteConfig } from "@/lib/config";
import { contactRoutes, topicOptions } from "@/lib/contact";
import { contactCopy as copy } from "@/lib/copy";
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
 * to, then, after space, the message form (its section named for screen
 * readers), whole in the first viewport at 1440×900, which ends the page:
 * its Topic radios are the routes by intent, each described by the
 * owner's line where there is one (premium D3: the routes' column is
 * folded into them), and a chosen route's prompt is the message field's
 * placeholder. The introduction, the availability and every route's
 * words are the profile's; an empty one is left out. Everything but the
 * form renders without JavaScript; the form needs it for BotID, so
 * without it the page offers LinkedIn instead, as the form does beside a
 * send that did not go. There is no email address or phone number.
 */
export default async function ContactPage() {
    const profile = await getProfile();
    const openTo = availabilityLine(profile?.availability);
    const linkedIn = getProfileLink(profile, "linkedin");

    return (
        <div data-page="contact">
            <ContactPageJsonLd profile={profile} />
            <PageHead
                className="shell"
                split
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

            <section
                className={`section ${styles.desk}`}
                id="message"
                aria-labelledby="contact-message-h"
                data-contact-message
            >
                <div className="shell">
                    <h2 className="sr-only" id="contact-message-h">
                        {copy.message}
                    </h2>
                    <div className="js-only">
                        <ContactForm
                            topics={topicOptions(contactRoutes(profile))}
                            linkedIn={linkedIn}
                        />
                    </div>
                    <ContactNoScript
                        linkedIn={linkedIn}
                        className={styles.noScript}
                    />
                </div>
            </section>
        </div>
    );
}
