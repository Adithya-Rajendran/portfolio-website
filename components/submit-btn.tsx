"use client";

import { useFormStatus } from "react-dom";

export default function SubmitBtn() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="min-h-11 rounded-full border border-accent bg-accent px-5 text-sm font-bold text-on-accent transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
        >
            {pending ? "Sending…" : "Send message"}
        </button>
    );
}
