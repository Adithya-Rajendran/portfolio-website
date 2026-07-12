"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeSelector from "@/components/theme-selector";
import { primaryNavigation, siteRoutes } from "@/lib/navigation";

function isCurrent(
    pathname: string,
    match: (typeof primaryNavigation)[number]["match"],
) {
    if (match === "home") return pathname === "/";
    if (match === "work") return pathname.startsWith("/portfolio");
    if (match === "writing") return pathname.startsWith("/blog");
    if (match === "about") return pathname.startsWith("/about");
    if (match === "resume") return pathname.startsWith("/resume");
    return false;
}

export default function SiteHeader() {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuId = useId();
    const mobileWrapperRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;

        menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();

        const onPointerDown = (event: PointerEvent) => {
            if (!mobileWrapperRef.current?.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setMenuOpen(false);
            menuButtonRef.current?.focus();
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [menuOpen]);

    return (
        <header className="os-nav sticky top-0 z-[1000] h-16 rounded-none border-x-0 border-t-0">
            <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
                <Link
                    href={siteRoutes.home}
                    aria-label="Adithya Rajendran — home"
                    className="group flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
                >
                    <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-[0.65rem] border border-accent-soft bg-accent-soft font-term text-[0.7rem] font-bold uppercase tracking-[-0.08em] text-accent transition-colors group-hover:border-accent"
                    >
                        ar
                    </span>
                    <span className="truncate font-term text-[0.68rem] font-semibold tracking-[-0.035em] text-slate-900 dark:text-white sm:text-sm">
                        adithya-rajendran
                        <span className="text-accent">.com</span>
                    </span>
                </Link>

                <nav
                    aria-label="Primary navigation"
                    className="ml-auto hidden items-center gap-1 md:flex"
                >
                    {primaryNavigation.map((item) => {
                        const current = isCurrent(pathname, item.match);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={current ? "page" : undefined}
                                className={cn(
                                    "os-press rounded-full px-3.5 py-2 font-term text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]",
                                    current
                                        ? "border border-accent-soft bg-accent-soft text-accent"
                                        : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white",
                                )}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="hidden md:block">
                    <ThemeSelector />
                </div>

                <div
                    ref={mobileWrapperRef}
                    className="relative ml-auto md:hidden"
                >
                    <button
                        ref={menuButtonRef}
                        type="button"
                        aria-label={
                            menuOpen ? "Close navigation" : "Open navigation"
                        }
                        aria-expanded={menuOpen}
                        aria-controls={menuId}
                        onClick={() => setMenuOpen((open) => !open)}
                        className="os-press grid size-11 place-items-center rounded-full border border-slate-200/70 bg-white/55 text-slate-700 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                    >
                        {menuOpen ? (
                            <X className="size-[1.1rem]" aria-hidden />
                        ) : (
                            <Menu className="size-[1.1rem]" aria-hidden />
                        )}
                    </button>

                    {menuOpen && (
                        <div
                            ref={menuRef}
                            id={menuId}
                            className="os-card-raised absolute right-0 top-[calc(100%+0.65rem)] max-h-[calc(100svh-5.5rem)] w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[1.25rem] p-3"
                        >
                            <nav aria-label="Mobile navigation">
                                <ul className="grid gap-1">
                                    {primaryNavigation.map((item) => {
                                        const current = isCurrent(
                                            pathname,
                                            item.match,
                                        );
                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    aria-current={
                                                        current
                                                            ? "page"
                                                            : undefined
                                                    }
                                                    onClick={() =>
                                                        setMenuOpen(false)
                                                    }
                                                    className={cn(
                                                        "flex min-h-11 items-center justify-between rounded-xl px-3.5 font-term text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))]",
                                                        current
                                                            ? "bg-accent-soft text-accent"
                                                            : "text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-white/[0.05]",
                                                    )}
                                                >
                                                    {item.label}
                                                    {current && (
                                                        <span
                                                            aria-hidden
                                                            className="size-1.5 rounded-full bg-accent"
                                                        />
                                                    )}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </nav>

                            <ThemeSelector
                                variant="inline"
                                className="mt-3 border-t border-slate-200/70 pt-4 dark:border-white/10"
                            />
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
