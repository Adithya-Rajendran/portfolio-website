import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import UnifiedHero, { AvailabilityPill } from "@/components/unified-hero";
import heroImg from "@/public/hero.webp";

interface HeroContentProps {
    subtitle?: string | null;
    available?: boolean | null;
}

export default function HeroContent({ subtitle, available }: HeroContentProps) {
    return (
        <UnifiedHero
            avatar={heroImg}
            avatarAlt="Adithya Rajendran"
            statusPill={
                available ? (
                    <AvailabilityPill>
                        Available for cloud & security work
                    </AvailabilityPill>
                ) : undefined
            }
            title={
                <>
                    <span className="text-slate-900 dark:text-white">
                        Hi, I&apos;m{" "}
                    </span>
                    <span className="text-accent-gradient animate-gradient-text">
                        Adithya Rajendran
                    </span>
                </>
            }
            subtitle="Cloud Field Engineer @ Canonical"
            description={
                <p>
                    {subtitle ||
                        "Building resilient infrastructure, breaking it apart for fun, and writing about cybersecurity, homelabs, and the systems behind every clean abstraction."}
                </p>
            }
            actions={
                <>
                    <Button asChild size="lg" className="group gap-2">
                        <Link href="/portfolio">
                            View Portfolio
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </Button>
                    <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="gap-2"
                    >
                        <Link href="/blogs">Read the Blog</Link>
                    </Button>
                </>
            }
            meta={
                <div className="flex items-center justify-center gap-5">
                    <a
                        href="https://www.linkedin.com/in/adithya-rajendran"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-accent dark:text-slate-400 transition-colors"
                        aria-label="LinkedIn profile"
                    >
                        <FaLinkedin className="w-5 h-5" />
                    </a>
                    <a
                        href="https://github.com/Adithya-Rajendran"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-accent dark:text-slate-400 transition-colors"
                        aria-label="GitHub profile"
                    >
                        <FaGithub className="w-5 h-5" />
                    </a>
                    <span
                        aria-hidden
                        className="w-px h-4 bg-slate-300 dark:bg-white/10"
                    />
                    <a
                        href="/resume"
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-accent dark:text-slate-400 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Resume
                    </a>
                </div>
            }
        />
    );
}
