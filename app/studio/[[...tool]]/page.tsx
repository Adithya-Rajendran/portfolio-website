import StudioClient from "./studio-client";

export default function StudioPage() {
    const configured = Boolean(process.env.NEXT_PUBLIC_STORE_SANITY_PROJECT_ID);

    if (!configured) {
        return (
            <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100">
                <div className="max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-8">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-300">
                        Sanity Studio
                    </p>
                    <h1 className="mt-4 text-3xl font-semibold">
                        Studio is not configured.
                    </h1>
                    <p className="mt-4 leading-7 text-slate-300">
                        Add the public Sanity project ID to this environment,
                        then rebuild the site. The public routes can still use
                        local fixtures for visual development without opening a
                        misconfigured Studio.
                    </p>
                </div>
            </main>
        );
    }

    return <StudioClient />;
}
