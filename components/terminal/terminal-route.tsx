import type { ReactNode } from "react";
import { PAGE_CONTAINER_CLASSES } from "@/components/page-shell";
import TerminalSection from "@/components/terminal/terminal-section";
import { cn } from "@/lib/utils";

interface TerminalRouteProps {
    path: string;
    command: string;
    children: ReactNode;
    className?: string;
    promptClassName?: string;
    bodyClassName?: string;
}

/** One consistent prompt/reveal frame for the site's editorial routes. */
export function TerminalRoute({
    path,
    command,
    children,
    className,
    promptClassName,
    bodyClassName,
}: TerminalRouteProps) {
    return (
        <TerminalSection
            as="div"
            path={path}
            command={command}
            promptVariant="compact"
            animatePrompt
            className={className}
            promptClassName={cn(
                PAGE_CONTAINER_CLASSES,
                "route-prompt mb-6 pt-12 sm:pt-16 lg:pt-20",
                promptClassName,
            )}
            bodyClassName={bodyClassName}
        >
            {children}
        </TerminalSection>
    );
}
