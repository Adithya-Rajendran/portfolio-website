import Link from "next/link"

export default function Latest() {
 
    return (
        <section className="container mx-auto px-6">
          <h2 className="text-2xl font-bold mb-4">Latest Posts</h2>
          <div className="flex flex-col sm:flex-row overflow-x-scroll gap-6 pb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow flex-shrink-0 w-full sm:w-80">
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
                <p className="text-gray-500 dark:text-gray-400 mb-4">January 13, 2024</p>
                <Link
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                  href="#"
                >
                  Read More
                </Link>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow flex-shrink-0 w-full sm:w-80">
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
                <p className="text-gray-500 dark:text-gray-400 mb-4">January 13, 2024</p>
                <Link
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                  href="#"
                >
                  Read More
                </Link>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow flex-shrink-0 w-full sm:w-80">
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
                <p className="text-gray-500 dark:text-gray-400 mb-4">January 13, 2024</p>
                <Link
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                  href="#"
                >
                  Read More
                </Link>
              </div>
            </div>
          </div>
        </section>
    )
}