"use client";

import { useFormStatus } from "react-dom";

export default function SubmitBtn() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="font-term text-sm font-bold rounded-row px-4 py-2.5 border border-accent bg-accent-soft text-accent transition-colors hover:bg-accent hover:text-white dark:hover:text-slate-900 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]"
        >
            {pending ? "[ sending… ]" : "[ send ]"}
        </button>
    );
}
