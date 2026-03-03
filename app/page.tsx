"use cache";

import { cacheLife } from "next/cache";
import HomeClient from "@/components/home-client";
import { getAllSkillCategories, getAllCertifications } from "@/lib/sanity-client";

export default async function Home() {
    cacheLife("days");

    const [skillCategories, certifications] = await Promise.all([
        getAllSkillCategories(),
        getAllCertifications(),
    ]);

    return (
        <HomeClient
            skillCategories={skillCategories}
            certifications={certifications}
        />
    );
}
