import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-accent-soft text-accent border-accent-soft",
                secondary:
                    "bg-slate-50 text-slate-700 border-slate-200 dark:bg-white/[0.04] dark:text-slate-300 dark:border-white/10",
                /** Primary category color (theme c1) */
                c1: "bg-c1-soft text-accent border-c1-soft",
                /** Secondary category color (theme c2) */
                c2: "bg-c2-soft text-c2 border-c2-soft",
                /** Tertiary category color (theme c3) */
                c3: "bg-c3-soft text-c3 border-c3-soft",
                outline:
                    "text-slate-700 border-slate-200 dark:text-slate-200 dark:border-white/10",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

export interface BadgeProps
    extends
        React.HTMLAttributes<HTMLSpanElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <span
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
