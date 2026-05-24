import Image from "next/image";
import { Card } from "@/components/ui/card";
import { urlForImage } from "@/lib/sanity-image";
import type { Certification as TCertification } from "@/sanity.types";

export default function Certification(cert: TCertification) {
    const dateRange = cert.endDate
        ? `${cert.startDate} – ${cert.endDate}`
        : cert.startDate;

    return (
        <Card
            href={cert.verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-full"
        >
            <div className="flex items-start gap-5">
                {cert.badge && (
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-2xl overflow-hidden bg-slate-50/80 dark:bg-white/[0.04] flex items-center justify-center">
                        <Image
                            src={urlForImage(cert.badge)
                                .width(140)
                                .height(140)
                                .quality(95)
                                .url()}
                            alt={
                                cert.badge.alt ||
                                `${cert.title || ""} certification badge`
                            }
                            fill
                            sizes="64px"
                            loading="lazy"
                            className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white group-hover:text-accent transition-colors">
                        {cert.title || ""}
                    </h3>
                    {cert.org && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            {cert.org}
                        </p>
                    )}
                    {dateRange && (
                        <p className="mt-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-500">
                            {dateRange}
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
}
