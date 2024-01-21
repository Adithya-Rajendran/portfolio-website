import Featured from "@/components/blogs/featured";
import Latest from "@/components/blogs/latest";

import { getSlugs } from "@/context/markdown-posts";

export async function BlogName() {
    const slugsmd = await getSlugs();
    const posts = slugsmd.map((slug) => <div>{slug}</div>);

    return <div>{posts}</div>;
}

export default function Blogs() {
    return (
        <div className="flex-1 py-6 bg-gray-100 dark:bg-gray-900 rounded-lg mx-6">
            <main className="flex-1 py-6">
                <Featured />
                <Latest />
            </main>
        </div>
    );
}
