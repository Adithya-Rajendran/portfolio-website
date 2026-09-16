import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CareerSectionHeading from "@/components/portfolio/section-heading";
import { formatDate } from "@/components/blogs/utils";
import type { PostListItem } from "@/lib/sanity-client";

export default function EngineeringWriting({
    posts,
}: {
    posts: PostListItem[];
}) {
    const publishedPosts = posts.filter((post) => post.slug);
    if (!publishedPosts.length) return null;
    return (
        <section id="engineering-writing" className="career-section">
            <CareerSectionHeading
                title="Engineering, in writing."
                description="A closer look at the experiments, decisions, and lessons behind the work."
            />
            <div className="career-writing-list">
                {publishedPosts.slice(0, 3).map((post) => (
                    <article key={post._id}>
                        <p className="career-meta">
                            <time dateTime={post.publishedAt}>
                                {formatDate(post.publishedAt)}
                            </time>
                        </p>
                        <h3>
                            <Link href={`/blog/${post.slug}`}>
                                {post.title}{" "}
                                <ArrowUpRight size={17} aria-hidden />
                            </Link>
                        </h3>
                        {post.description && (
                            <p className="career-summary">{post.description}</p>
                        )}
                    </article>
                ))}
                <Link href="/blog" className="journal-link">
                    All writing <ArrowUpRight size={16} aria-hidden />
                </Link>
            </div>
        </section>
    );
}
