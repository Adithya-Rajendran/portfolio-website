import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getAllPosts, type PostMeta } from "@/lib/sanity-client";
import { selectNextPosts } from "@/lib/related-posts";
import { formatDate } from "@/components/blogs/utils";

export default async function ArticleContinuation({
    currentPost,
}: {
    currentPost: PostMeta;
}) {
    const nextPosts = selectNextPosts(await getAllPosts(), currentPost);

    return (
        <aside
            className="journal-article-continuation"
            aria-label="Continue exploring"
        >
            {nextPosts.length > 0 && (
                <section aria-labelledby="journal-next-heading">
                    <div className="journal-section-heading">
                        <h2 id="journal-next-heading">Keep exploring.</h2>
                        <Link href="/blog" className="journal-link">
                            All writing <ArrowUpRight size={15} aria-hidden />
                        </Link>
                    </div>
                    <ul className="journal-next-posts">
                        {nextPosts.map((post) => (
                            <li key={post._id}>
                                <Link href={`/blog/${post.slug}`}>
                                    <time
                                        className="journal-next-date"
                                        dateTime={post.publishedAt}
                                    >
                                        {formatDate(post.publishedAt)}
                                    </time>
                                    <span className="journal-next-title">
                                        {post.title}
                                    </span>
                                    <ArrowUpRight size={19} aria-hidden />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <nav
                className="journal-article-actions"
                aria-label="Beyond this article"
            >
                <p>Beyond the notebook</p>
                <div>
                    {nextPosts.length === 0 && (
                        <Link href="/blog" className="journal-link">
                            All writing <ArrowUpRight size={15} aria-hidden />
                        </Link>
                    )}
                    <Link href="/portfolio" className="journal-link">
                        Explore my work <ArrowUpRight size={15} aria-hidden />
                    </Link>
                    <Link href="/portfolio#contact" className="journal-link">
                        Get in touch <ArrowUpRight size={15} aria-hidden />
                    </Link>
                </div>
            </nav>
        </aside>
    );
}
