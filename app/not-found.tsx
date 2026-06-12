import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import UnifiedHero from "@/components/unified-hero";

export default function NotFound() {
    return (
        <main className="flex flex-col items-center justify-center min-h-[70vh] w-full">
            <UnifiedHero
                title={
                    <span className="text-accent-gradient animate-gradient-text">
                        404
                    </span>
                }
                subtitle="Page Not Found"
                description={
                    <p>
                        The page you are looking for doesn't exist or has been
                        moved.
                    </p>
                }
                actions={
                    <Button asChild size="lg" className="group gap-2">
                        <Link href="/">
                            Go back home
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </Button>
                }
            />
        </main>
    );
}
