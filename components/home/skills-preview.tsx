"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { variantIcons, variantStyles } from "./constants";
import type { SanitySkillCategoryType } from "@/lib/types";

interface SkillsPreviewProps {
    skillCategories: SanitySkillCategoryType[];
}

export default function SkillsPreview({ skillCategories }: SkillsPreviewProps) {
    if (skillCategories.length === 0) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-[64rem] pb-20"
        >
            <h2 className="text-2xl font-bold text-center mb-10 text-slate-900 dark:text-slate-100">
                Skills &amp; Expertise
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {skillCategories.map((category) => {
                    const styles =
                        variantStyles[category.colorVariant] ||
                        variantStyles.emerald;
                    const icon =
                        variantIcons[category.colorVariant] ||
                        variantIcons.emerald;
                    return (
                        <SkillCard
                            key={category._id}
                            icon={icon}
                            title={category.title}
                            skills={category.skills}
                            variant={styles.badgeVariant}
                            accentColor={styles.accentColor}
                            bgColor={styles.bgColor}
                            iconBorder={styles.iconBorder}
                        />
                    );
                })}
            </div>
        </motion.section>
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
    skills: string[];
    variant: "cyber" | "cyan" | "violet";
    accentColor: string;
    bgColor: string;
    iconBorder: string;
}) {
    return (
        <div className="rounded-xl border border-emerald-200 bg-white p-6 hover:shadow-md hover:shadow-emerald-100 transition-shadow dark:border-white/8 dark:bg-white/[0.03] dark:hover:shadow-none">
            <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${bgColor} ${accentColor} border ${iconBorder} mb-4`}
            >
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
