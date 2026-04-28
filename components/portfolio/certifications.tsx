"use client";

import React from "react";
import { useSectionInView } from "@/lib/hooks";
import SectionHeading from "../section-heading";
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
        <section ref={ref} id="certs" className="scroll-mt-28 mb-28">
            <SectionHeading>My Certification</SectionHeading>
            <ul>
                {certifications.map((cert) => (
                    <li key={cert._id}>
                        <Certification {...cert} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
