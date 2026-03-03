import Header from "@/components/header";
import ActiveSectionContextProvider from "@/context/active-section-context";

export default function PortfolioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ActiveSectionContextProvider>
            <Header />
            {children}
        </ActiveSectionContextProvider>
    );
}
