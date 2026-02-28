import Link from "next/link";
import { getSlugs, getPostContent } from "@/components/blogs/markdown-posts";
import Image from "next/image";
import { PostType } from "@/lib/types";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";

export default async function Latest() {
    const slugs = await getSlugs();

    if (!slugs || slugs.length === 0) {
        return null;
    }

    const allPostsPromises = slugs.map((slug) => getPostContent(slug));
    const allPostsUnfiltered = await Promise.all(allPostsPromises);
    const allPosts = allPostsUnfiltered.filter(
        (post) => post !== undefined
    ) as PostType[];

    const sortedPosts = allPosts.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
    });

    const currentDate = new Date(); // cannot consolidate or it will try to convert PST dates into PST
    const currentDatePST = new Date(
        currentDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
    );

    // Filter posts that are less than or equal to the current date or have undefined dates
    const availablePosts = sortedPosts.filter((post) => {
        const postDateObj = post.date ? new Date(post.date) : null;
        return !postDateObj || postDateObj <= currentDatePST;
    });

    return (
        <section className="container mx-auto px-6">
            <h2 className="text-2xl font-bold mb-4">Latest Posts</h2>
            <Carousel>
                <CarouselContent className="flex flex-col sm:flex-row gap-6 pb-6">
                    {availablePosts.map((post) => (
                        <CarouselItem
                            key={post.slug}
                            className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow flex-shrink-0 w-full xl:basis-1/4 lg:basis-1/3 md:basis-1/2 sm:w-80"
                        >
                            <Image
                                src={post.image}
                                alt={post.title}
                                width="350"
                                height="200"
                                style={{
                                    objectFit: "scale-down",
                                }}
                                loading="lazy"
                                className="h-64"
                            />
                            <div className="p-6">
                                <h3 className="text-xl font-bold mb-2">
                                    {post.title}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-4">
                                    {post.date}
                                </p>
                                <Link
                                    className="text-blue-700 hover:underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                    href={`blogs/${post.slug}`}
                                    aria-label={`Read more about ${post.title}`}
                                    title={`Read more about ${post.title}`}
                                >
                                    Explore: {post.title}
                                </Link>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
            </Carousel>
        </section>
    );
}
