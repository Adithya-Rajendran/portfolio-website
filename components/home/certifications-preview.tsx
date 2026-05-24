import Image from "next/image";
import { urlForImage } from "@/lib/sanity-image";
import type { Certification } from "@/sanity.types";
import RevealOnScroll from "@/components/reveal-on-scroll";

interface CertificationsPreviewProps {
    certifications: Certification[];
}

export default function CertificationsPreview({
    certifications,
}: CertificationsPreviewProps) {
    if (certifications.length === 0) return null;

    return (
        <RevealOnScroll as="section" className="w-full max-w-[64rem] pb-20">
            <h2 className="text-2xl font-bold text-center mb-10 text-slate-900 dark:text-slate-100">
                Certifications
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {certifications.map((cert) => (
                    <a
                        key={cert._id}
                        href={cert.verifyUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center gap-4 rounded-xl border border-emerald-200 bg-white p-6 transition-all hover:shadow-lg hover:shadow-emerald-100 hover:border-emerald-400 dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-emerald-500/30 dark:hover:shadow-emerald-500/5"
                    >
                        {cert.badge && (
                            <div className="relative w-20 h-20">
                                <Image
                                    src={urlForImage(cert.badge)
                                        .width(160)
                                        .height(160)
                                        .url()}
                                    alt={cert.badge.alt || cert.title || ""}
                                    fill
                                    sizes="80px"
                                    className="object-contain"
                                />
                            </div>
                        )}
                        <div className="text-center">
                            <h3 className="font-semibold text-sm text-emerald-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                {cert.title ?? ""}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                {cert.org ?? ""}
                            </p>
                        </div>
                    </a>
                ))}
            </div>
        </RevealOnScroll>
    );
}
