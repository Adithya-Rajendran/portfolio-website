"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export default function SubmitBtn() {
    const { pending } = useFormStatus();

    return (
        <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="min-h-11 px-5"
        >
            {pending ? "Sending…" : "Send message"}
        </Button>
    );
}
