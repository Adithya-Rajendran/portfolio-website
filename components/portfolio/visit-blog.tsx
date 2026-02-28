"use client";

import SectionHeading from "../section-heading";
import { motion } from "motion/react";
import { Button } from "../ui/button";
import Link from "next/link";

export default function VisitBlogs() {
    return (
        <motion.section
            id="visit-blogs"
            className="mb-20 sm:mb-28 w-[min(100%,38rem)] text-center"
            initial={{
                opacity: 0,
            }}
            whileInView={{
                opacity: 1,
            }}
            transition={{
                duration: 1,
            }}
            viewport={{
                once: true,
            }}
        >
            <SectionHeading>Visit my Blogs</SectionHeading>

            <p className="text-slate-500 -mt-6 dark:text-slate-400 pb-10">
                Join me on my learning adventure as a tech enthusiast! Explore
                my blog to discover the fascinating topics I've been delving
                into and the projects I'm passionately tackling.
            </p>
            <Button asChild>
                <Link href="/blogs">Visit my Blogs</Link>
            </Button>
        </motion.section>
    );
}
