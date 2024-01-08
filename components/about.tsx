"use client";

import React from "react";
import SectionHeading from "./section-heading";
import { motion } from "framer-motion";
import { useSectionInView } from "@/lib/hooks";

export default function About() {
  const { ref } = useSectionInView("About");

  return (
    <motion.section
      ref={ref}
      className="mb-28 max-w-[45rem] text-center leading-8 sm:mb-40 scroll-mt-28"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.175 }}
      id="about"
    >
      <SectionHeading>About me</SectionHeading>
      <p className="mb-3">
        After graduating with a degree in{" "}
        <span className="font-medium">Computer Science</span>, I continued to pursue my
        passion for cybersecurity and programming. I completed industry-standard certifications namely,{" "}
        <span className="font-medium">CompTIA Security+</span>.{" "} and {" "}
        <span className="font-medium">AWS Solutions Architect</span>.{" "}
        I am currenty pursuing the OffSec Certified Professional (OSCP).
        <span className="italic">My favorite part of computing</span> is the
        problem-solving aspect. I <span className="underline">love</span> the
        feeling of figuring out a solution to a problem. I am currently looking for a{" "}
        <span className="font-medium">full-time position</span>.
      </p>

      <p>
        <span className="italic">When I'm not coding</span>, I enjoy playing
        video games, watching movies, and tinkering in my home-lab. I also enjoy{" "}
        <span className="font-medium">learning new things</span>. I am currently
        learning about{" "}
        <span className="font-medium">photography</span>.
      </p>
    </motion.section>
  );
}
