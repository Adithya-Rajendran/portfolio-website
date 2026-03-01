"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { BsArrowRight, BsGithub, BsLinkedin, BsShieldLock } from "react-icons/bs";
import { FaBriefcase, FaPenNib, FaCode, FaServer } from "react-icons/fa";
import { HiDownload } from "react-icons/hi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    devSkillsData,
    cyberSkillsData,
    devopskillsData,
    certData,
} from "@/lib/data";

import heroImg from "@/public/hero.webp";

export default function Home() {
    return (
        <main className="flex flex-col items-center px-4">
            {/* Hero Section */}
            <section className="flex flex-col items-center justify-center min-h-[85vh] text-center relative w-full">
                <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-50 dark:opacity-100" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8"
                >
                    <div className="relative w-28 h-28 mx-auto">
                        <Image
                            src={heroImg}
                            alt="Adithya Rajendran"
                            fill
                            quality={95}
                            priority
                            className="rounded-full object-cover border-2 border-emerald-400 shadow-lg shadow-emerald-300/30 dark:border-emerald-500/30 dark:shadow-emerald-500/10"
                        />
                        <div className="absolute inset-0 rounded-full ring-2 ring-emerald-300 ring-offset-2 ring-offset-[#f0fdf4] dark:ring-emerald-400/20 dark:ring-offset-[#0a0f1a]" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <Badge variant="cyber" className="mb-6 text-sm px-4 py-1">
                        Available for opportunities
                    </Badge>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-5xl sm:text-7xl font-bold mb-6 tracking-tight"
                >
                    <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 dark:from-emerald-400 dark:via-cyan-300 dark:to-emerald-400 bg-clip-text text-transparent animate-gradient-text">
                        Adithya Rajendran
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-[36rem] mx-auto mb-10 leading-relaxed"
                >
                    Cloud Field Engineer / Cybersecurity Enthusiast / Builder
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex flex-wrap items-center justify-center gap-3"
                >
                    <Button asChild size="lg" className="gap-2">
                        <Link href="/portfolio">
                            View Portfolio
                            <BsArrowRight className="transition-transform group-hover:translate-x-1" />
                        </Link>
                    </Button>

                    <Button asChild variant="outline" size="lg" className="gap-2">
                        <Link href="/blogs">
                            Read Blog
                        </Link>
                    </Button>

                    <Button asChild variant="outline" size="lg" className="gap-2">
                        <Link href="/portfolio#contact">
                            Contact Me
                        </Link>
                    </Button>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="flex items-center gap-4 mt-8"
                >
                    <a
                        href="https://linkedin.com/in/adithya-rajendran"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                        aria-label="LinkedIn profile"
                    >
                        <BsLinkedin className="text-xl" />
                    </a>
                    <a
                        href="https://github.com/Adithya-Rajendran"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                        aria-label="GitHub profile"
                    >
                        <BsGithub className="text-xl" />
                    </a>
                    <a
                        href="/resume.pdf"
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                    >
                        <HiDownload className="text-base" />
                        Resume
                    </a>
                </motion.div>
            </section>

            {/* Brief About */}
            <motion.section
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="max-w-[52rem] w-full py-20"
            >
                <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-400 text-center">
                    I am a Cloud Field Engineer at{" "}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Canonical</span>,
                    specializing in deploying and optimizing cloud infrastructure with{" "}
                    <span className="font-semibold text-teal-700 dark:text-cyan-400">OpenStack</span>,{" "}
                    <span className="font-semibold text-teal-700 dark:text-cyan-400">Kubernetes</span>, and{" "}
                    <span className="font-semibold text-teal-700 dark:text-cyan-400">Ubuntu</span> systems.
                    With a deep passion for cybersecurity, I hold certifications including{" "}
                    <span className="font-semibold text-violet-700 dark:text-violet-400">AWS Solutions Architect</span> and{" "}
                    <span className="font-semibold text-violet-700 dark:text-violet-400">CompTIA Security+</span>.
                </p>
            </motion.section>

            {/* Skills Preview */}
            <motion.section
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-[64rem] pb-20"
            >
                <h2 className="text-2xl font-bold text-center mb-10 text-slate-900 dark:text-slate-100">
                    Skills & Expertise
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SkillCard
                        icon={<FaCode className="text-xl" />}
                        title="Development"
                        skills={devSkillsData}
                        variant="cyber"
                        accentColor="text-emerald-600 dark:text-emerald-400"
                        bgColor="bg-emerald-50 dark:bg-emerald-500/10"
                        iconBorder="border-emerald-200 dark:border-emerald-500/20"
                    />
                    <SkillCard
                        icon={<BsShieldLock className="text-xl" />}
                        title="Cybersecurity"
                        skills={[...cyberSkillsData]}
                        variant="cyan"
                        accentColor="text-cyan-600 dark:text-cyan-400"
                        bgColor="bg-cyan-50 dark:bg-cyan-500/10"
                        iconBorder="border-cyan-200 dark:border-cyan-500/20"
                    />
                    <SkillCard
                        icon={<FaServer className="text-xl" />}
                        title="Infrastructure"
                        skills={[...devopskillsData]}
                        variant="violet"
                        accentColor="text-violet-600 dark:text-violet-400"
                        bgColor="bg-violet-50 dark:bg-violet-500/10"
                        iconBorder="border-violet-200 dark:border-violet-500/20"
                    />
                </div>
            </motion.section>

            {/* Featured Certifications */}
            <motion.section
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-[64rem] pb-20"
            >
                <h2 className="text-2xl font-bold text-center mb-10 text-slate-900 dark:text-slate-100">
                    Certifications
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {certData.map((cert, i) => (
                        <motion.a
                            key={i}
                            href={cert.verify}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            className="group flex flex-col items-center gap-4 rounded-xl border border-emerald-200 bg-white p-6 transition-all hover:shadow-lg hover:shadow-emerald-100 hover:border-emerald-400 dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-emerald-500/30 dark:hover:shadow-emerald-500/5"
                        >
                            <div className="relative w-20 h-20">
                                <Image
                                    src={cert.badge}
                                    alt={cert.title}
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-sm text-emerald-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                    {cert.title}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                    {cert.org}
                                </p>
                            </div>
                        </motion.a>
                    ))}
                </div>
            </motion.section>

            {/* Navigation Cards */}
            <motion.section
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-[64rem] pb-28"
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Link
                        href="/portfolio"
                        className="group relative rounded-xl border border-emerald-200 bg-white p-8 sm:p-10 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100 hover:border-emerald-400 dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-emerald-500/30 dark:hover:shadow-emerald-500/5"
                    >
                        <div className="relative">
                            <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                                <FaBriefcase className="text-xl" />
                            </div>
                            <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                                Portfolio
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                Experience, projects, certifications, and skills in
                                cloud engineering and cybersecurity.
                            </p>
                            <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium group-hover:gap-3 transition-all">
                                Explore
                                <BsArrowRight className="transition-transform group-hover:translate-x-1" />
                            </span>
                        </div>
                    </Link>

                    <Link
                        href="/blogs"
                        className="group relative rounded-xl border border-teal-200 bg-white p-8 sm:p-10 transition-all duration-300 hover:shadow-lg hover:shadow-teal-100 hover:border-teal-400 dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-cyan-500/30 dark:hover:shadow-cyan-500/5"
                    >
                        <div className="relative">
                            <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20">
                                <FaPenNib className="text-xl" />
                            </div>
                            <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                                Blogs
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                Insights and write-ups on cybersecurity, homelabs,
                                and technology explorations.
                            </p>
                            <span className="inline-flex items-center gap-2 text-teal-600 dark:text-cyan-400 font-medium group-hover:gap-3 transition-all">
                                Read
                                <BsArrowRight className="transition-transform group-hover:translate-x-1" />
                            </span>
                        </div>
                    </Link>
                </div>
            </motion.section>
        </main>
    );
}

function SkillCard({
    icon,
    title,
    skills,
    variant,
    accentColor,
    bgColor,
    iconBorder,
}: {
    icon: React.ReactNode;
    title: string;
    skills: readonly string[];
    variant: "cyber" | "cyan" | "violet";
    accentColor: string;
    bgColor: string;
    iconBorder: string;
}) {
    return (
        <div className="rounded-xl border border-emerald-200 bg-white p-6 hover:shadow-md hover:shadow-emerald-100 transition-shadow dark:border-white/8 dark:bg-white/[0.03] dark:hover:shadow-none">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${bgColor} ${accentColor} border ${iconBorder} mb-4`}>
                {icon}
            </div>
            <h3 className={`font-semibold mb-4 ${accentColor}`}>{title}</h3>
            <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                    <Badge key={i} variant={variant} className="text-xs">
                        {skill}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
