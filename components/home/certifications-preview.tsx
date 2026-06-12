import Image from "next/image";
import { urlForImage } from "@/lib/sanity-image";
import type { Certification } from "@/sanity.types";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SectionHeader from "@/components/section-header";
import { GroupedList, ListRow } from "@/components/ui/grouped-list";

interface CertificationsPreviewProps {
    certifications: Certification[];
}

/**
 * Certifications as a Samsung One UI-style grouped list — each cert is
 * a row inside one rounded card, separated by dividers. Badge image
 * doubles as a leading icon. Rows without a verify URL render as
 * static (non-interactive) entries.
 */
export default function CertificationsPreview({
    certifications,
}: CertificationsPreviewProps) {
    if (certifications.length === 0) return null;

    return (
        <RevealOnScroll
            as="section"
            className="w-full max-w-3xl mx-auto px-4 sm:px-6 pb-20"
        >
            <SectionHeader
                eyebrow="Credentials"
                title="Continuously certified"
                description="Industry credentials that map directly onto the work I do every day."
                align="center"
            />

            <GroupedList>
                {certifications.map((cert) => {
                    const badge = cert.badge;
                    const BadgeIcon = badge
                        ? function CertBadgeIcon() {
                              return (
                                  <Image
                                      src={urlForImage(badge)
                                          .width(140)
                                          .height(140)
                                          .url()}
                                      alt={badge.alt || cert.title || ""}
                                      width={56}
                                      height={56}
                                      sizes="56px"
                                      className="h-full w-full object-contain p-1"
                                  />
                              );
                          }
                        : undefined;
                    return (
                        <ListRow
                            key={cert._id}
                            href={cert.verifyUrl ?? undefined}
                            target={cert.verifyUrl ? "_blank" : undefined}
                            rel={
                                cert.verifyUrl
                                    ? "noopener noreferrer"
                                    : undefined
                            }
                            icon={BadgeIcon}
                            iconColor="neutral"
                            title={cert.title ?? ""}
                            subtitle={cert.org ?? ""}
                        />
                    );
                })}
            </GroupedList>
        </RevealOnScroll>
    );
}
