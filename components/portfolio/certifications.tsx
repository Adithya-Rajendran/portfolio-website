import Image from "next/image";
import SectionSpy from "./section-spy";
import TerminalSection from "@/components/terminal/terminal-section";
import { urlForImage } from "@/lib/sanity-image";
import type { Certification as TCertification } from "@/sanity.types";

const rowClasses =
    "flex items-center gap-4 sm:gap-5 py-4 border-b border-slate-400/25 dark:border-white/10";

interface CertificationsProps {
    certifications: TCertification[];
}

/**
 * `$ verify certifications` — the same `[ ok ]` verification-log rows
 * as the home preview (deliberate duplication; the home component is
 * frozen), extended with the portfolio-only detail: issuer under the
 * title and the validity date range. Rows without a verify URL render
 * statically.
 */
export default function Certifications({
    certifications,
}: CertificationsProps) {
    return (
        <SectionSpy
            section="Certs"
            threshold={0.5}
            id="certs"
            className="scroll-mt-28"
        >
            <TerminalSection
                as="div"
                command="verify certifications --issuer all"
                path="~/portfolio"
                label="Certifications"
                promptClassName="mb-10"
            >
                <div className="border-t border-slate-400/25 dark:border-white/10">
                    {certifications.map((cert) => {
                        const dateRange = cert.endDate
                            ? `${cert.startDate} – ${cert.endDate}`
                            : cert.startDate;
                        const content = (
                            <>
                                <span className="font-term text-[0.8rem] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                    [ ok ]
                                </span>
                                {cert.badge && (
                                    <Image
                                        src={urlForImage(cert.badge)
                                            .width(88)
                                            .height(88)
                                            .fit("max")
                                            .auto("format")
                                            .url()}
                                        alt=""
                                        width={40}
                                        height={40}
                                        sizes="40px"
                                        loading="lazy"
                                        className="w-10 h-10 shrink-0 object-contain"
                                    />
                                )}
                                <span className="flex-1 min-w-0">
                                    <span className="block font-term text-sm sm:text-[0.95rem] font-bold text-slate-900 dark:text-white leading-snug">
                                        {cert.title}
                                    </span>
                                    {cert.org && (
                                        <span className="block mt-0.5 font-term text-[0.75rem] text-slate-600 dark:text-slate-400">
                                            {cert.org}
                                        </span>
                                    )}
                                </span>
                                {dateRange && (
                                    <span className="hidden sm:inline font-term text-[0.8rem] tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        {dateRange}
                                    </span>
                                )}
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
        </SectionSpy>
    );
}
