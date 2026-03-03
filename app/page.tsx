import HomeClient from "@/components/home-client";
import { getAllSkillCategories, getAllCertifications, getIntro } from "@/lib/sanity-client";

export default async function Home() {
    const [skillCategories, certifications, intro] = await Promise.all([
        getAllSkillCategories(),
        getAllCertifications(),
        getIntro(),
    ]);

    return (
        <HomeClient
            skillCategories={skillCategories as any}
            certifications={certifications as any}
            subtitle={intro?.subtitle}
            homeBio={intro?.homeBio as any}
        />
    );
}
