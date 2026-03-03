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
            skillCategories={skillCategories}
            certifications={certifications}
            resumeUrl={intro?.resumeUrl}
        />
    );
}
