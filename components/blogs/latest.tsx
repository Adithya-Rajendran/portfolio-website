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

function formatDate(dateStr?: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

export default function Latest({ posts: allPosts }: LatestProps) {
    if (!allPosts || allPosts.length === 0) {
        return null;
    }

    const items = allPosts.map((post) => {
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
                    className="group block rounded-xl overflow-hidden border border-white/8 bg-white/[0.03] transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 h-full"
                >
                    {imageUrl && (
                        <div className="relative aspect-[5/3] overflow-hidden">
                            <Image
                                src={imageUrl}
                                alt={post.image?.alt || post.title || ""}
                                width={400}
                                height={240}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                loading="lazy"
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
    });

    return (
        <section className="container mx-auto px-6 mb-16">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-6">
                Latest Posts
            </h2>
            <Carousel>
                <CarouselContent className="flex flex-col sm:flex-row gap-6 pb-6">
                    {items}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
            </Carousel>
        </section>
    );
}
