import dynamic from "next/dynamic";
import ActiveSectionContextProvider from "@/context/active-section-context";

// Defer header JS — not needed for initial render of /portfolio
const Header = dynamic(() => import("@/components/header"), { ssr: true });

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
