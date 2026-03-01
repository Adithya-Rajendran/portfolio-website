"use client";

import { useRef } from "react";
import { CertificateType } from "@/lib/types";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";

export default function Certification(cert: CertificateType) {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["0 1", "1.33 1"],
    });
    const scaleProgress = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
    const opacityProgress = useTransform(scrollYProgress, [0, 1], [0.6, 1]);

    return (
        <motion.div
            key={cert.title}
            ref={ref}
            style={{
                scale: scaleProgress,
                opacity: opacityProgress,
            }}
            className="group mb-3 sm:mb-8 last:mb-0"
        >
            <section className="bg-white max-w-[42rem] border border-emerald-200 rounded-lg overflow-hidden sm:pr-8 relative hover:bg-emerald-50/50 hover:border-emerald-300 transition dark:text-slate-200 dark:bg-white/[0.03] dark:border-white/8 dark:hover:bg-white/[0.06] flex justify-between">
                <div className="pt-4 pb-7 px-5 sm:pl-10 sm:pr-2 sm:pt-10 sm:max-w-[75%] flex flex-col h-full">
                    <h3 className="text-2xl font-semibold">{cert.title}</h3>
                    <p className="my-2 leading-relaxed text-slate-600 dark:text-slate-400">
                        {cert.endDate
                            ? `${cert.org} | ${cert.startDate} - ${cert.endDate}`
                            : `${cert.org} | ${cert.startDate}`}
                    </p>

                    <a
                        className="text-emerald-700 hover:underline hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                        href={cert.verify}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Verify
                    </a>
                </div>

                <div className="hidden sm:block flex-shrink-0 pt-5">
                    <Image
                        src={cert.badge}
                        alt={`${cert.title} certification badge`}
                        quality={95}
                        loading="lazy"
                        height={128}
                        className="top-8 -right-40 rounded-lg shadow-2xl transition group-hover:scale-[1.20]"
                    />
                </div>
            </section>
        </motion.div>
    );
}
