import Featured from "@/components/blogs/featured";
import Latest from "@/components/blogs/latest";
import { getAllPosts } from "@/context/markdown-posts";

export default async function Blogs() {
    const allPosts = await getAllPosts();
    const featured = ["ffuf", "nmap", "test"];
    const featuredPosts = allPosts.filter((post) =>
        featured.includes(post.slug)
    );
    return (
        <main className="flex-1 py-6">
            <Featured featuredPosts={featuredPosts} />
            <Latest />
        </main>
    );
}
