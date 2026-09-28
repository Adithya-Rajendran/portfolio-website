import StudioClient from "./studio-client";

export default function StudioPage() {
    const configured = Boolean(process.env.NEXT_PUBLIC_STORE_SANITY_PROJECT_ID);

    if (!configured) {
        // Inline styles: the site's Tailwind stylesheet is not loaded under
        // /studio (see app/studio/layout.tsx).
        return (
            <main
                style={{
                    display: "grid",
                    placeItems: "center",
                    minHeight: "100vh",
                    padding: "1.5rem",
                    background: "#020617",
                    color: "#f1f5f9",
                }}
            >
                <div
                    style={{
                        maxWidth: "36rem",
                        padding: "2rem",
                        border: "1px solid rgb(255 255 255 / 0.1)",
                        borderRadius: "1rem",
                        background: "rgb(255 255 255 / 0.04)",
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            color: "#6ee7b7",
                            fontFamily: "var(--font-ibm-plex-mono), monospace",
                            fontSize: "0.75rem",
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                        }}
                    >
                        Sanity Studio
                    </p>
                    <h1
                        style={{
                            margin: "1rem 0 0",
                            fontSize: "1.875rem",
                            fontWeight: 600,
                        }}
                    >
                        Studio is not configured.
                    </h1>
                    <p
                        style={{
                            margin: "1rem 0 0",
                            lineHeight: 1.75,
                            color: "#cbd5e1",
                        }}
                    >
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
