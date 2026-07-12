import PortfolioNav from "@/components/portfolio/portfolio-nav";
import ActiveSectionContextProvider from "@/context/active-section-context";
import { getAllProjects } from "@/lib/sanity-client";
import { hasVisibleItems } from "@/lib/content-rules";

export default async function PortfolioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const projects = await getAllProjects();

    return (
        <ActiveSectionContextProvider>
            <PortfolioNav showProjects={hasVisibleItems(projects)} />
            {children}
        </ActiveSectionContextProvider>
    );
}
