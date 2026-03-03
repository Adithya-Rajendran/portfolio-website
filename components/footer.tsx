import React from "react";

export default function Footer() {
    return (
        <footer className="mb-10 px-4 text-center text-slate-500 dark:text-slate-500">
            <small className="mb-2 block text-xs">
                &copy; {new Date().getFullYear()} Adithya. All rights reserved.
            </small>
            <p className="text-xs">
                <span className="font-semibold">About this website:</span> built
                with React &amp; Next.js (App Router &amp; Server Actions), TypeScript,
                Tailwind CSS, Motion, Nodemailer, Vercel hosting.
            </p>
        </footer>
    );
}
