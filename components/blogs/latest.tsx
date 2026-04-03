import Link from "next/link";
import Image from "next/image";
import { urlForImage } from "@/lib/sanity-image";
import type { Post as TPost } from "@/sanity.types";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";

interface LatestProps {
    posts: TPost[];
}

export default function Latest({ posts: allPosts }: LatestProps) {
    if (!allPosts || allPosts.length === 0) {
        return (
            <section className="container mx-auto px-6">
                <h2 className="text-2xl font-bold mb-4">Latest Posts</h2>
                <p className="text-slate-500 dark:text-slate-400">
                    No posts published yet. Create your first post in the Sanity
                    Studio.
                </p>
            </section>
        );
    }

    return (
        <section className="container mx-auto px-6">
            <h2 className="text-2xl font-bold mb-4">Latest Posts</h2>
            <Carousel>
                <CarouselContent className="flex flex-col sm:flex-row gap-6 pb-6">
                    {allPosts.map((post) => {
                        const imageUrl = post.image
                            ? urlForImage(post.image)
                                  .width(350)
                                  .height(200)
                                  .fit("crop")
                                  .auto("format")
                                  .url()
                            : null;
                        return (
                            <CarouselItem
                                key={post.slug?.current || post._id}
                                className="flex-shrink-0 w-full xl:basis-1/4 lg:basis-1/3 md:basis-1/2 sm:w-80"
                            >
                                <Link
                                    href={`blogs/${post.slug?.current || ""}`}
                                    aria-label={`Read more about ${post.title || ""}`}
                                    title={`Read more about ${post.title || ""}`}
                                    className="block bg-white border border-emerald-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:shadow-emerald-100 transition-shadow dark:bg-white/[0.03] dark:border-white/8 dark:hover:shadow-none h-full"
                                >
                                    {imageUrl && (
                                        <Image
                                            src={imageUrl}
                                            alt={
                                                post.image?.alt || post.title || ""
                                            }
                                            width={350}
                                            height={200}
                                            style={{
                                                objectFit: "scale-down",
                                            }}
                                            loading="lazy"
                                            className="h-64"
                                        />
                                    )}
                                    <div className="p-6">
                                        <h3 className="text-xl font-bold mb-2">
                                            {post.title || ""}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-500 mb-4">
                                            {post.date || ""}
                                        </p>
                                        <span className="text-emerald-700 hover:underline hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">
                                            {"Explore: "}
                                            {post.title || ""}
                                        </span>
                                    </div>
                                </Link>
                            </CarouselItem>
                        );
                    })}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
            </Carousel>
        </section>
    );
}
