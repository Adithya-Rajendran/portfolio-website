import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const CONTEXT_NAV_LABEL_CLASSES =
    "shrink-0 font-term text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-accent sm:text-xs";

export const CONTEXT_NAV_ITEM_CLASSES =
    "os-press inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 font-term text-[0.72rem] font-medium transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] sm:text-[0.78rem]";

interface ContextNavProps {
    ariaLabel: string;
    identity: ReactNode;
    children: ReactNode;
    collapseIdentityOnMobile?: boolean;
}

/** Structural frame shared by the Blog and Portfolio contextual navigation. */
export function ContextNav({
    ariaLabel,
    identity,
    children,
    collapseIdentityOnMobile = false,
}: ContextNavProps) {
    return (
        <nav
            aria-label={ariaLabel}
            className="os-subnav sticky top-16 z-[900] h-12 border-x-0"
        >
            <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
                <div
                    className={cn(
                        "contents",
                        collapseIdentityOnMobile && "max-sm:hidden",
                    )}
                >
                    {identity}
                    <span
                        aria-hidden
                        className="h-4 w-px shrink-0 bg-slate-300/80 dark:bg-white/10"
                    />
                </div>
                {children}
            </div>
        </nav>
    );
}
