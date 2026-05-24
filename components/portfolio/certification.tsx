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
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-emerald-50/40 dark:bg-emerald-500/5 border border-emerald-200/60 dark:border-white/8">
                        <Image
                            src={urlForImage(cert.badge)
                                .width(160)
                                .height(160)
                                .quality(95)
                                .url()}
                            alt={
                                cert.badge.alt ||
                                `${cert.title || ""} certification badge`
                            }
                            fill
                            sizes="80px"
                            loading="lazy"
                            className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
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
