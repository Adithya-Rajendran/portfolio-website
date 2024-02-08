"use client";

import { useRef } from "react";
import { CertificateType } from "@/lib/types";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

export default function Certification(cert: CertificateType) {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["0 1", "1.33 1"],
    });
    const scaleProgess = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
    const opacityProgess = useTransform(scrollYProgress, [0, 1], [0.6, 1]);

    return (
        <motion.div
            key={cert.title}
            ref={ref}
            style={{
                scale: scaleProgess,
                opacity: opacityProgess,
            }}
            className="group mb-3 sm:mb-8 last:mb-0"
        >
            <section className="bg-gray-100 max-w-[42rem] border border-black/5 rounded-lg overflow-hidden sm:pr-8 relative hover:bg-gray-200 transition dark:text-white dark:bg-white/10 dark:hover:bg-white/20 flex justify-between">
                <div className="pt-4 pb-7 px-5 sm:pl-10 sm:pr-2 sm:pt-10 sm:max-w-[75%] flex flex-col h-full">
                    <h3 className="text-2xl font-semibold">{cert.title}</h3>
                    <p className="my-2 leading-relaxed text-gray-700 dark:text-white/70">
                        {cert.org}
                    </p>
                    <a
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
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
                        alt="certification badge"
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
