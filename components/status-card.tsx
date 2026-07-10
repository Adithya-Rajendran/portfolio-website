import { IconPill } from "@/components/ui/icon-pill";

/**
 * Centered os-card status/empty state: squircle icon, heading, body copy,
 * optional actions row. Used by the blog empty state and the newsletter
 * confirmation pages.
 */
export function StatusCard({
    icon,
    color = "c1",
    heading,
    headingAs: Heading = "h2",
    children,
    actions,
}: {
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    color?: "c1" | "c2" | "c3";
    heading: string;
    /** h1 on standalone pages, h2 inside a page that already has one. */
    headingAs?: "h1" | "h2";
    children: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <div className="os-card p-10 sm:p-14 text-center">
            <div className="flex justify-center">
                <IconPill icon={icon} color={color} size="lg" />
            </div>
            <Heading className="mt-6 font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
                {heading}
            </Heading>
            <p className="mt-3 text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {children}
            </p>
            {actions && (
                <div className="mt-7 flex justify-center">{actions}</div>
            )}
        </div>
    );
}
