import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
import heroImg from "@/public/hero.webp";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import UnifiedHero from "@/components/unified-hero";
import { Button } from "@/components/ui/button";

const portableTextComponents = createPortableTextStyles("intro");

interface IntroProps {
    body?: PortableTextBlock[] | null;
    subtitle?: string | null;
}

export default function Intro({ body, subtitle }: IntroProps) {
    return (
        <section id="home" className="scroll-mt-[100rem]">
            <UnifiedHero
                eyebrow="Portfolio"
                avatar={heroImg}
                avatarAlt="Portrait of Adithya Rajendran"
                title={
                    <>
                        Adithya{" "}
                        <span className="text-accent-gradient">
                            Rajendran
                        </span>
                    </>
                }
                subtitle={subtitle ?? undefined}
                description={
                    body ? (
                        <PortableText
                            value={body}
                            components={portableTextComponents}
                        />
                    ) : null
                }
                actions={
                    <>
                        <Button asChild size="lg" className="group gap-2">
                            <Link href="/portfolio#contact">
                                Contact me
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            size="lg"
                            className="gap-2"
                        >
                            <a href="/resume">
                                Download CV
                                <Download className="w-4 h-4" />
                            </a>
                        </Button>
                    </>
                }
                meta={
                    <div className="flex items-center justify-center gap-3">
                        <a
                            href="https://www.linkedin.com/in/adithya-rajendran/"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="LinkedIn"
                            className="os-card os-hover inline-flex items-center justify-center w-11 h-11 rounded-full text-slate-600 dark:text-slate-300"
                        >
                            <FaLinkedin className="w-4 h-4" />
                        </a>
                        <a
                            href="https://github.com/Adithya-Rajendran"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub"
                            className="os-card os-hover inline-flex items-center justify-center w-11 h-11 rounded-full text-slate-600 dark:text-slate-300"
                        >
                            <FaGithub className="w-4 h-4" />
                        </a>
                    </div>
                }
            />
        </section>
    );
}
