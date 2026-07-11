import Header from "@/components/header";
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
            <Header showProjects={hasVisibleItems(projects)} />
            {children}
        </ActiveSectionContextProvider>
    );
}
