import Image from "next/image";
import { urlForImage } from "@/lib/sanity-image";
import type { Certification } from "@/sanity.types";
import TerminalSection from "@/components/terminal/terminal-section";

const rowClasses =
    "flex items-center gap-4 sm:gap-5 py-4 border-b border-slate-400/25 dark:border-white/10";

/**
 * `$ verify certifications` — credentials as a verification log: an
 * emerald `[ ok ]` marker, badge art, name, issuer, and the verify
 * link when one exists. Rows without a verify URL render statically.
 */
export default function CertificationsPreview({
    certifications,
}: {
    certifications: Certification[];
}) {
    if (certifications.length === 0) return null;

    return (
        <TerminalSection
            command="verify certifications --issuer all"
            label="Credentials"
            storageId="certs"
            className="w-full max-w-6xl mx-auto px-6 sm:px-8 pb-4"
        >
            <div className="border-t border-slate-400/25 dark:border-white/10">
                {certifications.map((cert) => {
                    const badge = cert.badge;
                    const content = (
                        <>
                            <span className="font-term text-[0.8rem] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                [ ok ]
                            </span>
                            {badge && (
                                <Image
                                    src={urlForImage(badge)
                                        .width(88)
                                        .height(88)
                                        .fit("max")
                                        .auto("format")
                                        .url()}
                                    alt=""
                                    width={40}
                                    height={40}
                                    sizes="40px"
                                    className="w-10 h-10 shrink-0 object-contain"
                                />
                            )}
                            <span className="flex-1 min-w-0 font-term text-sm sm:text-[0.95rem] font-bold text-slate-900 dark:text-white leading-snug">
                                {cert.title}
                            </span>
                            <span className="hidden sm:inline font-term text-[0.8rem] text-slate-500 dark:text-slate-400">
                                {cert.org}
                            </span>
                            {cert.verifyUrl && (
                                <span className="font-term text-[0.8rem] font-bold text-accent whitespace-nowrap">
                                    verify ↗
                                </span>
                            )}
                        </>
                    );

                    return cert.verifyUrl ? (
                        <a
                            key={cert._id}
                            href={cert.verifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${rowClasses} hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors`}
                        >
                            {content}
                        </a>
                    ) : (
                        <div key={cert._id} className={rowClasses}>
                            {content}
                        </div>
                    );
                })}
            </div>
        </TerminalSection>
    );
}
