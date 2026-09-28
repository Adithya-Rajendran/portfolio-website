import ActiveSectionContextProvider from "@/context/active-section-context";
import "@/app/journal-blog.css";
import "@/app/journal-career.css";

/**
 * Shared scroll-spy state for the portfolio pages. Each page renders its
 * own PortfolioNav variant, so nothing here depends on the pathname.
 */
export default function PortfolioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ActiveSectionContextProvider>{children}</ActiveSectionContextProvider>
    );
}
