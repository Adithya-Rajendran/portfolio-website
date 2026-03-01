export function HeroSection() {
    return (
        <section className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-muted-foreground mb-8">
                <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Available for opportunities
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground text-balance">
                Adithya Rajendran
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed text-pretty">
                Cloud Field Engineer &middot; Cybersecurity Enthusiast &middot; Builder
            </p>
        </section>
    );
}
