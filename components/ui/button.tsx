import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-slate-950",
    {
        variants: {
            variant: {
                default:
                    "text-white shadow-accent hover:shadow-accent bg-accent-gradient hover:brightness-110",
                destructive:
                    "bg-red-500 text-slate-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-slate-50 dark:hover:bg-red-900/90",
                outline:
                    "border border-slate-200 bg-white/70 backdrop-blur-md text-slate-800 hover:border-accent-soft hover:text-accent dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]",
                glass:
                    "glass text-slate-800 hover:text-accent glow-hover dark:text-slate-100",
                secondary:
                    "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]",
                ghost: "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.05] dark:hover:text-white",
                link: "text-accent underline-offset-4 hover:underline rounded-md",
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
