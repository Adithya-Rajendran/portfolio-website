"use client";

import React from "react";
import { certData } from "@/lib/data";
import { useSectionInView } from "@/lib/hooks";
import SectionHeading from "../section-heading";
import Certification from "./certification";

export default function Certifications() {
    const { ref } = useSectionInView("Certs", 0.5);

    return (
        <section ref={ref} id="certs" className="scroll-mt-28 mb-28">
            <SectionHeading>My Certification</SectionHeading>
            <div>
                {certData.map((cert) => (
                    <Certification key={cert.title} {...cert} />
                ))}
            </div>
        </section>
    );
}
