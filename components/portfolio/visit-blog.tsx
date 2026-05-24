import SectionHeading from "../section-heading";
import { Button } from "../ui/button";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";

export default function VisitBlogs() {
    return (
        <RevealOnScroll
            as="section"
            className="mb-20 sm:mb-28 w-[min(100%,38rem)] text-center"
        >
            <SectionHeading>Visit my Blogs</SectionHeading>

            <p className="text-slate-500 -mt-6 dark:text-slate-400 pb-10">
                Join me on my learning adventure as a tech enthusiast! Explore
                my blog to discover the fascinating topics I&apos;ve been delving
                into and the projects I&apos;m passionately tackling.
            </p>
            <Button asChild>
                <Link href="/blogs">Visit my Blogs</Link>
            </Button>
        </RevealOnScroll>
    );
}
