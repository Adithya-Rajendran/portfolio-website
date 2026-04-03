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
import { formatDate, cardClasses } from "./utils";

interface LatestProps {
    posts: TPost[];
}

export default function Latest({ posts: allPosts }: LatestProps) {
    if (!allPosts || allPosts.length === 0) return null;

    return (
        <section className="container mx-auto px-6 mb-16">
            <h2 className={cardClasses.sectionLabel}>Latest Posts</h2>
            <Carousel>
                <CarouselContent className="flex flex-col sm:flex-row gap-6 pb-6">
                    {allPosts.map((post) => {
                        const slug = (post.slug as unknown as string) || "";
                        const imageUrl = post.image
                            ? urlForImage(post.image)
                                  .width(400)
                                  .height(240)
                                  .fit("crop")
                                  .auto("format")
                                  .url()
                            : null;
                        return (
                            <CarouselItem
                                key={slug || post._id}
                                className="flex-shrink-0 w-full xl:basis-1/4 lg:basis-1/3 md:basis-1/2 sm:w-80"
                            >
                                <Link
                                    href={`/blogs/${slug}`}
                                    aria-label={`Read more about ${post.title || ""}`}
                                    title={`Read more about ${post.title || ""}`}
                                    className={`h-full ${cardClasses.base}`}
                                >
                                    {imageUrl && (
                                        <div className="relative aspect-[5/3] overflow-hidden">
                                            <Image
                                                src={imageUrl}
                                                alt={post.image?.alt || post.title || ""}
                                                width={400}
                                                height={240}
                                                className={cardClasses.imageHover}
                                                loading="lazy"
                                                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                            />
                                        </div>
                                    )}
                                    <div className="p-5">
                                        <h3 className="text-base font-semibold mb-1.5 text-slate-100 group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2">
                                            {post.title || ""}
                                        </h3>
                                        {post.description && (
                                            <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                                {post.description}
                                            </p>
                                        )}
                                        <span className="text-xs text-slate-500">
                                            {formatDate(post.date)}
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
