import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-slate-950 dark:focus-visible:ring-indigo-400",
    {
        variants: {
            variant: {
                default:
                    "text-white shadow-lg shadow-indigo-500/25 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/40 dark:from-indigo-500 dark:to-violet-500 dark:hover:from-indigo-400 dark:hover:to-violet-400",
                destructive:
                    "bg-red-500 text-slate-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-slate-50 dark:hover:bg-red-900/90",
                outline:
                    "border border-slate-200 bg-white/70 backdrop-blur-md text-slate-800 hover:border-indigo-300 hover:bg-white hover:text-indigo-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08] dark:hover:border-indigo-400/40 dark:hover:text-white",
                glass:
                    "glass text-slate-800 hover:text-indigo-700 glow-hover dark:text-slate-100 dark:hover:text-white",
                secondary:
                    "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]",
                ghost: "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.05] dark:hover:text-white",
                link: "text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400 rounded-md",
            },
            size: {
                default: "h-10 px-5 py-2",
                sm: "h-9 px-4",
                lg: "h-12 px-7",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

export interface ButtonProps
    extends
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    },
);
Button.displayName = "Button";

export { Button, buttonVariants };
