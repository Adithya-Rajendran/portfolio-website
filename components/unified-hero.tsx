import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";

interface UnifiedHeroProps {
    /** Tiny uppercase label above the avatar/title */
    eyebrow?: string;
    /** Centered avatar shown above the title (optional) */
    avatar?: StaticImageData | string;
    avatarAlt?: string;
    /** Status pill rendered above the title — e.g. "Available for work" */
    statusPill?: React.ReactNode;
    /** Display-font title */
    title: React.ReactNode;
    /** Accent-gradient subtitle below the title */
    subtitle?: React.ReactNode;
    /** Body copy below the subtitle */
    description?: React.ReactNode;
    /** CTAs rendered as a wrap row below the description */
    actions?: React.ReactNode;
    /** Social or secondary links rendered below the actions */
    meta?: React.ReactNode;
    className?: string;
}

/**
 * The single hero pattern used on every page (home, portfolio, blog,
 * 404, etc.). Samsung One UI-inspired: large centered avatar, big bold
 * display title, gradient subtitle, generous breathing room, soft
 * pill actions. Keep this hero stable so the site feels unified.
 */
export default function UnifiedHero({
    eyebrow,
    avatar,
    avatarAlt = "",
    statusPill,
    title,
    subtitle,
    description,
    actions,
    meta,
    className,
}: UnifiedHeroProps) {
    return (
        <section
            className={cn(
                "relative w-full px-4 pt-8 pb-16 sm:pt-12 sm:pb-20 text-center overflow-hidden",
                className,
            )}
        >
            <div className="mx-auto max-w-3xl flex flex-col items-center">
                {statusPill && (
                    <div className="mb-7 animate-fade-in">{statusPill}</div>
                )}

                {avatar && (
                    <div className="relative mb-7 animate-scale-fade-in">
                        <div
                            aria-hidden
                            className="absolute -inset-2 rounded-full bg-accent-halo opacity-40 blur-lg"
                        />
                        <Image
                            src={avatar}
                            alt={avatarAlt}
                            width={128}
                            height={128}
                            quality={75}
                            priority
                            fetchPriority="high"
                            loading="eager"
                            sizes="128px"
                            className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full object-cover ring-4 ring-white dark:ring-canvas-dark shadow-xl"
                        />
                    </div>
                )}

                {eyebrow && (
                    <div className="flex items-center gap-2 mb-4 animate-fade-in [animation-delay:120ms]">
                        <span className="inline-block w-6 h-px bg-accent-gradient" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
                            {eyebrow}
                        </p>
                        <span className="inline-block w-6 h-px bg-accent-gradient" />
                    </div>
                )}

                <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance leading-[1.05] animate-slide-up [animation-delay:160ms]">
                    {title}
                </h1>

                {subtitle && (
                    <p className="mt-4 text-lg sm:text-xl font-medium text-balance text-accent-gradient animate-slide-up [animation-delay:240ms]">
                        {subtitle}
                    </p>
                )}

                {description && (
                    <div className="mt-6 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed text-pretty animate-slide-up [animation-delay:320ms]">
                        {description}
                    </div>
                )}

                {actions && (
                    <div className="mt-9 flex flex-wrap items-center justify-center gap-3 animate-slide-up [animation-delay:400ms]">
                        {actions}
                    </div>
                )}

                {meta && (
                    <div className="mt-8 animate-fade-in [animation-delay:520ms]">
                        {meta}
                    </div>
                )}
            </div>
        </section>
    );
}

/**
 * The "Available for work" pill used in the hero — extracted so the
 * dark green status indicator stays consistent (it is intentionally not
 * theme-colored: green = available is universal).
 */
export function AvailabilityPill({ children }: { children: React.ReactNode }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full os-card px-4 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
            <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            {children}
        </div>
    );
}
