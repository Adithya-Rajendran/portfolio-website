import Link from "next/link"

export default function Featured() {
 
    return (
        <section className="container mx-auto px-6 mb-12">
        <h2 className="text-2xl font-bold mb-4">Featured Posts</h2>
        <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
            <img
            alt="Blog post thumbnail"
            className="w-full h-96 object-cover"
            height="200"
            src="/placeholder.svg"
            style={{
                aspectRatio: "700/200",
                objectFit: "cover",
            }}
            width="700"
            />
            <div className="p-6">
            <h3 className="text-2xl font-bold mb-2">Blog Post Page</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">This page is stil a work in progress...</p>
            <Link
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                href="#"
            >
                Read More
            </Link>
            </div>
        </div>
        <div className="md:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow mb-6">
            <img
                alt="Blog post thumbnail"
                className="w-full h-48 object-cover"
                height="200"
                src="/placeholder.svg"
                style={{
                aspectRatio: "350/200",
                objectFit: "cover",
                }}
                width="350"
            />
            <div className="p-6">
                <h3 className="text-xl font-bold mb-2">Blog Post Title</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">This is a short excerpt from the blog post...</p>
                <Link
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                href="#"
                >
                Read More
                </Link>
            </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
            <img
                alt="Blog post thumbnail"
                className="w-full h-48 object-cover"
                height="200"
                src="/placeholder.svg"
                style={{
                aspectRatio: "350/200",
                objectFit: "cover",
                }}
                width="350"
            />
            <div className="p-6">
                <h3 className="text-xl font-bold mb-2">Blog Post Title</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">This is a short excerpt from the blog post...</p>
                <Link
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                href="#"
                >
                Read More
                </Link>
            </div>
            </div>
        </div>
        </div>
        </section>
    )
}