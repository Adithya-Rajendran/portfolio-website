import Link from "next/link";
import { cacheLife } from "next/cache";
import { siteConfig } from "@/lib/config";
import { getProfile } from "@/lib/sanity-client";
import { getProfileLink } from "@/lib/profile-content";
import { footerNavigation } from "@/lib/navigation";

async function getYear(): Promise<number> {
    "use cache";
    cacheLife({ stale: 86400, revalidate: 86400, expire: 31536000 });
    return new Date().getFullYear();
}

export default async function Footer() {
    const [year, profile] = await Promise.all([getYear(), getProfile()]);
    const github = getProfileLink(profile, "github");
    return (
        <footer className="journal-container">
            <div className="journal-footer">
                <small>
                    © {year} {siteConfig.author}
                </small>
                <nav aria-label="Footer navigation">
                    {footerNavigation.map(({ href, label }) => (
                        <Link key={href} href={href}>
                            {label}
                        </Link>
                    ))}
                    <a href="/feed.xml" aria-label="Follow via RSS">
                        RSS <span aria-hidden>↗</span>
                    </a>
                    {github && (
                        <a
                            href={github.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            GitHub ↗
                        </a>
                    )}
                </nav>
            </div>
        </footer>
    );
}
