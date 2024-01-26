import Featured from "@/components/blogs/featured";
import Latest from "@/components/blogs/latest";

export default function Blogs() {
    return (
        <main className="flex-1 py-6">
            <Featured />
            <Latest />
        </main>
    );
}
