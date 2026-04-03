import Featured from "@/components/blogs/featured";
import Latest from "@/components/blogs/latest";
import { getFeaturedPosts, getAllPosts } from "@/lib/sanity-client";

export default async function Blogs() {
    const [featuredPosts, allPosts] = await Promise.all([
        getFeaturedPosts(),
        getAllPosts(),
    ]);

    return (
        <main className="flex-1 pt-16 pb-12">
            <Featured posts={featuredPosts as any} />
            <Latest posts={allPosts as any} />
        </main>
    );
}
