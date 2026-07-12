import Link from "next/link";
import { ArrowDown, FileText } from "lucide-react";
import { PageIntro } from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import type { ProfileData } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";

export default function Intro({
    profile,
    hasProjects,
}: {
    profile: ProfileData | null;
    hasProjects: boolean;
}) {
    return (
        <PageIntro
            id="home"
            className="scroll-mt-[100rem]"
            title="Work and experience."
            lead={profile?.headline || siteConfig.role}
            description={
                profile?.introduction ||
                "A straightforward record of the roles, projects, skills, and certifications that make up my professional work."
            }
            actions={
                <>
                    <Button asChild size="lg">
                        <Link href={hasProjects ? "#projects" : "#experience"}>
                            {hasProjects ? "View projects" : "View experience"}
                            <ArrowDown className="size-4" aria-hidden />
                        </Link>
                    </Button>
                    {profile?.resumeUrl && (
                        <Button asChild size="lg" variant="outline">
                            <Link href="/resume">
                                Résumé
                                <FileText className="size-4" aria-hidden />
                            </Link>
                        </Button>
                    )}
                </>
            }
        />
    );
}
