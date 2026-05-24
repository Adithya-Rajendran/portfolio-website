import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { urlForImage } from "@/lib/sanity-image";
import type { Certification } from "@/sanity.types";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SectionHeader from "@/components/section-header";

interface CertificationsPreviewProps {
    certifications: Certification[];
}

/**
 * Certifications as a Samsung One UI-style grouped list — each cert is
 * a row inside one rounded card, separated by dividers. Badge image
 * doubles as a leading icon.
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

            <div className="os-card rounded-3xl overflow-hidden divide-y divide-slate-200/60 dark:divide-white/[0.06]">
                {certifications.map((cert) => (
                    <a
                        key={cert._id}
                        href={cert.verifyUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors"
                    >
                        {cert.badge && (
                            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-2xl bg-slate-50/80 dark:bg-white/[0.04] flex items-center justify-center">
                                <Image
                                    src={urlForImage(cert.badge)
                                        .width(140)
                                        .height(140)
                                        .url()}
                                    alt={cert.badge.alt || cert.title || ""}
                                    width={56}
                                    height={56}
                                    sizes="56px"
                                    className="object-contain p-1"
                                />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-900 dark:text-slate-100 leading-snug group-hover:text-accent transition-colors line-clamp-1">
                                {cert.title ?? ""}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                {cert.org ?? ""}
                            </p>
                        </div>
                        <ChevronRight
                            aria-hidden
                            className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0"
                        />
                    </a>
                ))}
            </div>
        </RevealOnScroll>
    );
}
