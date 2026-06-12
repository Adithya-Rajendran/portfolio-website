import SectionHeader from "@/components/section-header";
import PostCard from "@/components/blogs/post-card";
import type { Post as TPost } from "@/sanity.types";
import { getPostSlug } from "./utils";

interface FeaturedProps {
    posts: TPost[];
}

/**
 * Featured posts grid. Layout adapts to count:
 *   - 1 post  → single full-width hero card
 *   - 2 posts → 2-col equal grid
 *   - 3+ posts → 1 hero + remaining in a 3-col grid (no posts are dropped)
 */
export default function Featured({ posts: featuredPosts }: FeaturedProps) {
    if (!featuredPosts || featuredPosts.length === 0) return null;

    const [hero, ...rest] = featuredPosts;

    return (
        <section>
            <SectionHeader eyebrow="Featured" title="Reads I'm proud of" />

            {featuredPosts.length === 1 && hero && (
                <PostCard post={hero} variant="hero" />
            )}

            {featuredPosts.length === 2 && (
                <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
                    {featuredPosts.map((post) => (
                        <PostCard
                            key={getPostSlug(post)}
                            post={post}
                            variant="medium"
                        />
                    ))}
                </div>
            )}

            {featuredPosts.length >= 3 && (
                <div className="flex flex-col gap-5 sm:gap-6">
                    {hero && <PostCard post={hero} variant="hero" />}
                    <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {rest.map((post) => (
                            <PostCard
                                key={getPostSlug(post)}
                                post={post}
                                variant="side"
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
