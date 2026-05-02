import ActiveSectionContextProvider from "@/context/active-section-context";
import Header from "@/components/header";

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
