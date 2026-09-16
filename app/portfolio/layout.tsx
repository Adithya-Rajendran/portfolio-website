import PortfolioNav from "@/components/portfolio/portfolio-nav";
import ActiveSectionContextProvider from "@/context/active-section-context";
import { getAllProjects, getProfile } from "@/lib/sanity-client";
import "@/app/journal-career.css";

export default async function PortfolioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [projects, profile] = await Promise.all([
        getAllProjects(),
        getProfile(),
    ]);
    return (
        <ActiveSectionContextProvider>
            <PortfolioNav
                showProjects={projects.length > 0}
                showExperience={Boolean(profile?.timeline?.length)}
                showSkills={Boolean(profile?.skillGroups?.length)}
                showCertifications={Boolean(profile?.credentials?.length)}
            />
            {children}
        </ActiveSectionContextProvider>
    );
}
