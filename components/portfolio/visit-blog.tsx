"use client";

import SectionHeading from "../section-heading";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import Link from "next/link";

export default function VisitBlogs() {
    return (
        <motion.section
            id="Visit Blogs"
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

            <p className="text-gray-700 -mt-6 dark:text-white/80 pb-10">
                Join me on my learning adventure as a tech enthusiast! Explore
                my blog to discover the fascinating topics I've been delving
                into and the projects I'm passionately tackling.
            </p>
            <Button className=" bg-amber-600 dark:bg-amber-600" asChild>
                <Link href="/blogs">Visit my Blogs</Link>
            </Button>
        </motion.section>
    );
}
