import Featured from "@/components/blogs/featured";
import Latest from "@/components/blogs/latest";

import { getSlugs } from "@/context/markdown-posts";

export async function BlogName() {
    const slugsmd = await getSlugs();
    const posts = slugsmd.map((slug) => <div>{slug}</div>);

    return posts;
}

export default function Blogs() {
    return (
        <main className="flex-1 py-6">
            <Featured />
            <Latest />
        </main>
    );
}
