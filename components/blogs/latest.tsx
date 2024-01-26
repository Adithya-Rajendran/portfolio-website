import Link from "next/link";

import { getAllPosts } from "@/context/markdown-posts";
import Image from "next/image";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";

export default async function Latest() {
    const sortedPosts = await getAllPosts();

    const currentDate = new Date().getTime();

    // Filter posts that are less than or equal to the current date or have undefined dates
    const availablePosts = sortedPosts.filter((post) => {
        return !post.date || new Date(post.date).getTime() <= currentDate;
    });

    return (
        <section className="container mx-auto px-6">
            <h2 className="text-2xl font-bold mb-4">Latest Posts</h2>
            <div>
                <Carousel>
                    <CarouselContent className="flex flex-col sm:flex-row gap-6 pb-6">
                        {availablePosts.map((post) => (
                            <CarouselItem
                                key={post.slug}
                                className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow flex-shrink-0 w-full sm:w-80 basis-1/4 md:basis-1/3"
                            >
                                <Image
                                    src={post.image}
                                    alt={post.title}
                                    width="350"
                                    height="200"
                                    loading="lazy"
                                />
                                <div className="p-6">
                                    <h3 className="text-xl font-bold mb-2">
                                        {post.title}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                                        {post.date}
                                    </p>
                                    <Link
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                        href={`blogs/${post.slug}`}
                                    >
                                        Read More
                                    </Link>
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                </Carousel>
            </div>
        </section>
    );
}
