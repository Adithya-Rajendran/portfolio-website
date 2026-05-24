"use client";

import React from "react";
import { useSectionInView } from "@/lib/hooks";
import SectionHeader from "@/components/section-header";
import Certification from "./certification";
import type { Certification as TCertification } from "@/sanity.types";

interface CertificationsProps {
    certifications: TCertification[];
}

export default function Certifications({
    certifications,
}: CertificationsProps) {
    const { ref } = useSectionInView("Certs", 0.5);

    return (
        <section ref={ref} id="certs" className="scroll-mt-28">
            <SectionHeader
                eyebrow="Certifications"
                title="Continuously certified"
                description="Industry credentials that map to the work I do every day."
            />
            <ul className="grid gap-4 sm:gap-5 sm:grid-cols-2">
                {certifications.map((cert) => (
                    <li key={cert._id}>
                        <Certification {...cert} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
