import Image from "next/image";
import { urlForImage } from "@/lib/sanity-image";
import type { Certification } from "@/sanity.types";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SectionHeader from "@/components/section-header";

interface CertificationsPreviewProps {
    certifications: Certification[];
}

export default function CertificationsPreview({
    certifications,
}: CertificationsPreviewProps) {
    if (certifications.length === 0) return null;

    return (
        <RevealOnScroll
            as="section"
            className="w-full max-w-6xl mx-auto px-2 sm:px-6 pb-20"
        >
            <SectionHeader
                eyebrow="Credentials"
                title="Continuously certified"
                description="Industry credentials that map directly onto the work I do every day."
                align="center"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {certifications.map((cert) => (
                    <a
                        key={cert._id}
                        href={cert.verifyUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group glass glow-hover relative flex items-center gap-5 rounded-2xl p-5 sm:p-6"
                    >
                        {cert.badge && (
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                                <Image
                                    src={urlForImage(cert.badge)
                                        .width(160)
                                        .height(160)
                                        .url()}
                                    alt={cert.badge.alt || cert.title || ""}
                                    fill
                                    sizes="80px"
                                    className="object-contain transition-transform duration-300 group-hover:scale-105"
                                />
                            </div>
                        )}
                        <div className="min-w-0">
                            <h3 className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-accent transition-colors line-clamp-2">
                                {cert.title ?? ""}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {cert.org ?? ""}
                            </p>
                        </div>
                    </a>
                ))}
            </div>
        </RevealOnScroll>
    );
}
