import Link from "next/link";
import type { Metadata } from "next";
import TagChips from "@/components/blogs/tag-chips";
import ArchiveList from "@/components/blogs/archive-list";
import {
    getPostSlug,
    readingTimeFromWordCount,
} from "@/components/blogs/utils";
import { collectTags } from "@/lib/tags";
import { getAllPosts, getProfile } from "@/lib/sanity-client";
import { getWritingDescription } from "@/lib/profile-content";
import { siteConfig } from "@/lib/config";

export async function generateMetadata(): Promise<Metadata> {
    const description = getWritingDescription(await getProfile());
    return {
        title: "Writing archive",
        description,
        alternates: { canonical: `${siteConfig.url}/blog/archive` },
        openGraph: {
            title: `Writing archive | ${siteConfig.author}`,
            description,
            url: `${siteConfig.url}/blog/archive`,
        },
        twitter: {
            card: "summary_large_image",
            title: `Writing archive | ${siteConfig.author}`,
            description,
        },
    };
}

export default async function ArchivePage() {
    const allPosts = await getAllPosts();
    const posts = allPosts
        .filter((post) => getPostSlug(post))
        .map((post) => ({
            slug: getPostSlug(post),
            title: post.title || "",
            description: post.description || "",
            publishedAt: post.publishedAt || "",
            tags: post.tags ?? [],
            readingMinutes:
                post.wordCount > 0
                    ? readingTimeFromWordCount(post.wordCount)
                    : null,
        }));
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="journal-page journal-container journal-writing"
        >
            <header className="journal-writing-intro">
                <p className="journal-eyebrow">The complete notebook</p>
                <h1 className="journal-title">A trail of ideas.</h1>
                <p className="journal-description">
                    Search the writing, follow a topic, or see where curiosity
                    has led.
                </p>
            </header>
            <TagChips
                tags={collectTags(allPosts)}
                className="journal-archive-tags"
            />
            {posts.length ? (
                <ArchiveList posts={posts} />
            ) : (
                <div className="journal-empty">
                    <h2>Nothing to search yet.</h2>
                    <p>Published notes will appear here.</p>
                    <Link href="/blog" className="journal-link">
                        Back to writing →
                    </Link>
                </div>
            )}
        </main>
    );
}
